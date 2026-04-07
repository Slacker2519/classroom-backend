import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { user, classes, enrollments } from "../db/schema/index.js";
import { db } from "../db/index.js";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { requirePermission } from "../lib/permissions.js";

const router = express.Router();

const userReadPermission = requirePermission({ profile: ["read"] });
const userCreatePermission = requirePermission({ profile: ["create"] });

async function getSessionUser(req: any) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  return session;
}

router.get("/", userReadPermission, async (req, res) => {
  try {
    const { search, role, page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(
      Math.max(1, parseInt(String(limit), 10) || 10),
      100,
    );

    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    if (search) {
      filterConditions.push(
        or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`)),
      );
    }

    if (role) {
      filterConditions.push(eq(user.role, role as any));
    }

    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const usersList = await db
      .select({
        ...getTableColumns(user),
      })
      .from(user)
      .where(whereClause)
      .orderBy(desc(user.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: usersList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (e) {
    console.error(`Get /users error: ${e}`);
    res.status(500).json({ error: "Failed to get users" });
  }
});

router.post("/", userCreatePermission, async (req, res) => {
  try {
    const { name, email, password, role, image } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error:
          "Missing required fields: name, email, password and role are required",
      });
    }

    if (role === "admin") {
      return res.status(403).json({
        error: "This endpoint cannot assign the global admin role",
      });
    }

    const signupResponse = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        role: role,
        image: image || null,
      },
      headers: fromNodeHeaders(req.headers),
    });

    if (!signupResponse || !signupResponse.user) {
      throw new Error("Failed to create user account");
    }

    res.status(201).json({ data: signupResponse.user });
  } catch (e: any) {
    console.error(`POST /users error: ${e}`);
    if (e.status === 400 || e.name === "BetterAuthError") {
      return res
        .status(400)
        .json({ error: e.message || "Failed to create user" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/user", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session || !session.session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = session.user.id;

    const [userRecord] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userRecord) {
      return res.status(404).json({ error: "User not found" });
    }

    let classesList: any[] = [];

    if (userRecord.role === "student") {
      classesList = await db
        .select({
          id: classes.id,
          name: classes.name,
          status: classes.status,
        })
        .from(enrollments)
        .innerJoin(classes, eq(enrollments.classId, classes.id))
        .where(eq(enrollments.studentId, userId));
    } else if (userRecord.role === "teacher") {
      classesList = await db
        .select({
          id: classes.id,
          name: classes.name,
          status: classes.status,
        })
        .from(classes)
        .where(eq(classes.teacherId, userId));
    }

    res.status(200).json({
      data: {
        ...userRecord,
        classes: classesList,
      },
    });
  } catch (e) {
    console.error(`GET /user error: ${e}`);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

router.patch("/user", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session || !session.session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = session.user.id;
    const { name, image } = req.body;

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (image !== undefined) updates.image = image;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const [updated] = await db
      .update(user)
      .set(updates)
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
      });

    res.status(200).json({ data: updated });
  } catch (e) {
    console.error(`PATCH /user error: ${e}`);
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

router.delete("/user", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session || !session.session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = session.user.id;

    await db.delete(user).where(eq(user.id, userId));

    res.status(200).json({ data: { message: "Account deleted successfully" } });
  } catch (e) {
    console.error(`DELETE /user error: ${e}`);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
