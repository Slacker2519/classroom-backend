import express from "express";
import { db } from "../db/index.js";
import { classJoinRequests, classes, enrollments } from "../db/schema/index.js";
import { eq, and } from "drizzle-orm";
import { auth } from "../lib/auth.js";
import { requirePermission } from "../lib/permissions.js";
import { user } from "../db/schema/auth.js";

const router = express.Router();

async function getSessionUser(req: any) {
  const session = await auth.api.getSession({
    headers: req.headers as any,
  });
  return session;
}

router.post("/", requirePermission({ class: ["join"] }), async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session || !session.session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const studentId = session.user.id;
    const { classId } = req.body;

    if (!classId) {
      return res.status(400).json({ error: "classId is required" });
    }

    const [existingEnrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.classId, classId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);

    if (existingEnrollment) {
      return res.status(409).json({ error: "Already enrolled in this class" });
    }

    const [existingRequest] = await db
      .select()
      .from(classJoinRequests)
      .where(
        and(
          eq(classJoinRequests.classId, classId),
          eq(classJoinRequests.studentId, studentId),
        ),
      )
      .limit(1);

    if (existingRequest) {
      if (existingRequest.status === "pending") {
        return res.status(409).json({ error: "Join request already pending" });
      }

      await db
        .update(classJoinRequests)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(classJoinRequests.id, existingRequest.id));
      return res
        .status(200)
        .json({ data: { ...existingRequest, status: "pending" } });
    }

    const [newRequest] = await db
      .insert(classJoinRequests)
      .values({ classId, studentId, status: "pending" })
      .returning();

    res.status(201).json({ data: newRequest });
  } catch (e) {
    console.error(`POST /class-join-requests error: ${e}`);
    res.status(500).json({ error: "Failed to submit join request" });
  }
});

router.get("/", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session || !session.session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { classId, status } = req.query;
    const userId = session.user.id;
    const userRole = (session.user as any).role;

    if (!classId) {
      return res.status(400).json({ error: "classId is required" });
    }

    const classIdNum = Number(classId);
    if (!Number.isFinite(classIdNum)) {
      return res.status(400).json({ error: "Invalid classId" });
    }

    if (userRole !== "admin") {
      if (userRole === "teacher") {
        const [classRecord] = await db
          .select({ teacherId: classes.teacherId })
          .from(classes)
          .where(eq(classes.id, classIdNum))
          .limit(1);
        if (classRecord?.teacherId !== userId) {
          return res.status(403).json({ error: "Forbidden" });
        }
      } else {
        const conditions = [
          eq(classJoinRequests.classId, classIdNum),
          eq(classJoinRequests.studentId, userId),
        ];
        if (status) {
          conditions.push(eq(classJoinRequests.status, status as any));
        }
        const requests = await db
          .select({
            id: classJoinRequests.id,
            classId: classJoinRequests.classId,
            studentId: classJoinRequests.studentId,
            status: classJoinRequests.status,
            createdAt: classJoinRequests.createdAt,
            updatedAt: classJoinRequests.updatedAt,
            student: { id: user.id, name: user.name, email: user.email },
          })
          .from(classJoinRequests)
          .leftJoin(user, eq(classJoinRequests.studentId, user.id))
          .where(and(...conditions))
          .orderBy(classJoinRequests.createdAt);

        return res.status(200).json({ data: requests });
      }
    }

    const conditions = [eq(classJoinRequests.classId, classIdNum)];
    if (status) {
      conditions.push(eq(classJoinRequests.status, status as any));
    }

    const requests = await db
      .select({
        id: classJoinRequests.id,
        classId: classJoinRequests.classId,
        studentId: classJoinRequests.studentId,
        status: classJoinRequests.status,
        createdAt: classJoinRequests.createdAt,
        updatedAt: classJoinRequests.updatedAt,
        student: { id: user.id, name: user.name, email: user.email },
      })
      .from(classJoinRequests)
      .leftJoin(user, eq(classJoinRequests.studentId, user.id))
      .where(and(...conditions))
      .orderBy(classJoinRequests.createdAt);

    res.status(200).json({ data: requests });
  } catch (e) {
    console.error(`GET /class-join-requests error: ${e}`);
    res.status(500).json({ error: "Failed to get join requests" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session || !session.session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const requestId = Number(req.params.id);
    if (!Number.isFinite(requestId)) {
      return res.status(400).json({ error: "Invalid request ID" });
    }

    const { status } = req.body;
    if (!["accepted", "declined"].includes(status)) {
      return res
        .status(400)
        .json({ error: "Status must be 'accepted' or 'declined'" });
    }

    const userId = session.user.id;
    const userRole = (session.user as any).role;

    const [joinRequest] = await db
      .select()
      .from(classJoinRequests)
      .where(eq(classJoinRequests.id, requestId))
      .limit(1);

    if (!joinRequest) {
      return res.status(404).json({ error: "Join request not found" });
    }

    if (userRole !== "admin") {
      const [classRecord] = await db
        .select({ teacherId: classes.teacherId })
        .from(classes)
        .where(eq(classes.id, joinRequest.classId))
        .limit(1);
      if (classRecord?.teacherId !== userId) {
        return res.status(403).json({
          error: "Only the class teacher or admin can respond to join request",
        });
      }
    }

    const [updated] = await db
      .update(classJoinRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(classJoinRequests.id, requestId))
      .returning();

    if (status === "accepted") {
      await db
        .insert(enrollments)
        .values({
          classId: joinRequest.classId,
          studentId: joinRequest.studentId,
        })
        .onConflictDoNothing();
    }

    res.status(200).json({ data: updated });
  } catch (e) {
    console.error(`PATCH /class-join-requests/:id error: ${e}`);
    res.status(500).json({ error: "Failed to update join request" });
  }
});

export default router;
