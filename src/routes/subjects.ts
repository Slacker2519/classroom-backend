import express from "express";
import { db } from "../db/index.js";
import { departments, subjects } from "../db/schema/index.js";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { requirePermission } from "../lib/permissions.js";

const router = express.Router();

const subjectReadPermission = requirePermission({ subject: ["read"] });
const subjectCreatePermission = requirePermission({ subject: ["create"] });
const subjectUpdatePermission = requirePermission({ subject: ["update"] });
const subjectDeletePermission = requirePermission({ subject: ["delete"] });

router.get("/", subjectReadPermission, async (req, res) => {
  try {
    const { search, department, page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(
      Math.max(1, parseInt(String(limit), 10) || 10),
      100,
    );

    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    if (search) {
      filterConditions.push(
        or(
          ilike(subjects.name, `%${search}%`),
          ilike(subjects.code, `%${search}%`),
        ),
      );
    }

    if (department) {
      const deptPattern = `%${String(department).replace(/[%_]/g, "\\$&")}%`;
      filterConditions.push(ilike(departments.name, deptPattern));
    }

    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const subjectsList = await db
      .select({
        ...getTableColumns(subjects),
        department: { ...getTableColumns(departments) },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(subjects.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: subjectsList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (e) {
    console.error(`Get /subjects error: ${e}`);
    res.status(500).json({ error: "Failed to get subjects" });
  }
});

router.post("/", subjectCreatePermission, async (req, res) => {
  try {
    const { departmentId, name, code, description } = req.body;

    if (!departmentId || !name || !code) {
      return res.status(400).json({
        error:
          "Missing required fields: departmentId, name, and code are required",
      });
    }

    if (typeof departmentId !== "number" || !Number.isInteger(departmentId)) {
      return res.status(400).json({ error: "departmentId must be an integer" });
    }

    const [createdSubject] = await db
      .insert(subjects)
      .values({ departmentId, name, code, description })
      .returning({ id: subjects.id });

    if (!createdSubject) {
      throw new Error("Failed to create subject");
    }

    res.status(201).json({ data: createdSubject });
  } catch (e) {
    console.error(`POST /subjects error: ${e}`);
    res.status(500).json({ error: "Failed to create subject" });
  }
});

router.put("/:id", subjectUpdatePermission, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid subject ID" });
    }

    const { departmentId, name, code, description } = req.body;

    if (
      departmentId === undefined &&
      name === undefined &&
      code === undefined &&
      description === undefined
    ) {
      return res.status(400).json({ error: "No fields to update" });
    }

    if (
      departmentId !== undefined &&
      (typeof departmentId !== "number" || !Number.isInteger(departmentId))
    ) {
      return res.status(400).json({ error: "departmentId must be an integer" });
    }

    if (departmentId !== undefined) {
      const [dept] = await db
        .select()
        .from(departments)
        .where(eq(departments.id, departmentId))
        .limit(1);
      if (!dept) {
        return res.status(400).json({ error: "Department not found" });
      }
    }

    if (name !== undefined) {
      const [existing] = await db
        .select()
        .from(subjects)
        .where(and(eq(subjects.name, name), sql`${subjects.id} != ${id}`))
        .limit(1);
      if (existing) {
        return res
          .status(400)
          .json({ error: "Subject with this name already exists" });
      }
    }

    const updateValues: Partial<typeof subjects.$inferInsert> = {};
    if (departmentId !== undefined) updateValues.departmentId = departmentId;
    if (name !== undefined) updateValues.name = name;
    if (code !== undefined) updateValues.code = code;
    if (description !== undefined) updateValues.description = description;

    const [updated] = await db
      .update(subjects)
      .set(updateValues)
      .where(eq(subjects.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Subject not found" });
    }

    res.status(200).json({ data: updated });
  } catch (e) {
    console.error(`PUT /subjects/:id error: ${e}`);
    res.status(500).json({ error: "Failed to update subject" });
  }
});

router.get("/:id", subjectReadPermission, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid subject ID" });
    }

    const [subject] = await db
      .select({
        ...getTableColumns(subjects),
        department: { ...getTableColumns(departments) },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(eq(subjects.id, id))
      .limit(1);

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    res.status(200).json({ data: subject });
  } catch (e) {
    console.error(`GET /subjects/:id error: ${e}`);
    res.status(500).json({ error: "Failed to get subject" });
  }
});

router.delete("/:id", subjectDeletePermission, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid subject ID" });
    }

    const [subjectRecord] = await db
      .select()
      .from(subjects)
      .where(eq(subjects.id, id))
      .limit(1);

    if (!subjectRecord) {
      return res.status(404).json({ error: "Subject not found" });
    }

    await db.delete(subjects).where(eq(subjects.id, id));
    res.status(204).end();
  } catch (e) {
    console.error(`DELETE /subjects/:id error: ${e}`);
    res.status(500).json({ error: "Failed to delete subject" });
  }
});

export default router;
