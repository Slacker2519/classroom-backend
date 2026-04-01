import express from "express";
import { db } from "../db/index.js";
import { classes, departments, subjects } from "../db/schema/index.js";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { user } from "../db/schema/auth.js";
import { requirePermission } from "../lib/permissions.js";
import { auth } from "../lib/auth.js";

const router = express.Router();

const classReadPermission = requirePermission({ class: ["read"] });
const classCreatePermission = requirePermission({ class: ["create"] });

async function canUpdateClass(req: Request, classId: number): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session || !session.session) return false;

  const userRole = (session.user as any).role;
  const userId = session.user.id;

  if (userRole === "admin") return true;

  if (userRole === "teacher") {
    const [classRecord] = await db
      .select({ teacherId: classes.teacherId })
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);

    return classRecord?.teacherId === userId;
  }

  return false;
}

router.get("/", classReadPermission, async (req, res) => {
  try {
    const { search, subject, teacher, page = 1, limit = 10 } = req.query;

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
          ilike(classes.name, `%${search}%`),
          ilike(classes.inviteCode, `%${search}%`),
        ),
      );
    }

    if (subject) {
      const deptPattern = `%${String(subject).replace(/[%_]/g, "\\$&")}%`;
      filterConditions.push(ilike(subjects.name, deptPattern));
    }

    if (teacher) {
      const deptPattern = `%${String(teacher).replace(/[%_]/g, "\\$&")}%`;
      filterConditions.push(ilike(user.name, deptPattern));
    }

    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(classes)
      .leftJoin(subjects, eq(classes.subjectId, subjects.id))
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const classesList = await db
      .select({
        ...getTableColumns(classes),
        subject: { ...getTableColumns(subjects) },
        teacher: { ...getTableColumns(user) },
      })
      .from(classes)
      .leftJoin(subjects, eq(classes.subjectId, subjects.id))
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(whereClause)
      .orderBy(desc(classes.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: classesList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (e) {
    console.error(`GET /classes error: ${e}`);
    res.status(500).json({ error: "Failed to get classes" });
  }
});

router.get("/:id", classReadPermission, async (req, res) => {
  const classId = Number(req.params.id);

  if (!Number.isFinite(classId))
    return res.status(400).json({ error: "No Class found." });

  const [classDetails] = await db
    .select({
      ...getTableColumns(classes),
      subject: {
        ...getTableColumns(subjects),
      },
      department: {
        ...getTableColumns(departments),
      },
      teacher: {
        ...getTableColumns(user),
      },
    })
    .from(classes)
    .leftJoin(subjects, eq(classes.subjectId, subjects.id))
    .leftJoin(user, eq(classes.teacherId, user.id))
    .leftJoin(departments, eq(subjects.departmentId, departments.id))
    .where(eq(classes.id, classId));

  if (!classDetails) return res.status(404).json({ error: "Class not found" });

  res.status(200).json({ data: classDetails });
});

router.post("/", classCreatePermission, async (req, res) => {
  try {
    const [createdClass] = await db
      .insert(classes)
      .values({
        ...req.body,
        inviteCode: Math.random().toString(36).substring(2, 9),
        schedules: [],
      })
      .returning({ id: classes.id });

    if (!createdClass) {
      throw new Error("Failed to create class");
    }

    res.status(201).json({ data: createdClass });
  } catch (e) {
    console.error(`POST /classes error: ${e}`);
    res.status(500).json({ error: e });
  }
});

router.put("/:id", async (req, res) => {
  const classId = Number(req.params.id);

  if (!Number.isFinite(classId)) {
    return res.status(400).json({ error: "Invalid class ID" });
  }

  const canUpdate = await canUpdateClass(req as any, classId);
  if (!canUpdate) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "You don't have permission to update this class",
    });
  }

  const { name, description, departmentId, subjectId, capacity, status } =
    req.body;

  try {
    const [updated] = await db
      .update(classes)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(departmentId !== undefined && { departmentId }),
        ...(subjectId !== undefined && { subjectId }),
        ...(capacity !== undefined && { capacity }),
        ...(status !== undefined && { status }),
      })
      .where(eq(classes.id, classId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Class not found" });
    }

    res.status(200).json({ data: updated });
  } catch (e) {
    console.error(`PUT /classes/:id error: ${e}`);
    res.status(500).json({ error: "Failed to update class" });
  }
});

export default router;
