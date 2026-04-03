import express from "express";
import { db } from "../db/index.js";
import { enrollments, user } from "../db/schema/index.js";
import { eq, and } from "drizzle-orm";
import { auth } from "../lib/auth.js";

const router = express.Router();

router.get("/", async (req: any, res: express.Response) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });
    if (!session || !session.session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { classId, studentId } = req.query as {
      classId?: string;
      studentId?: string;
    };

    const conditions = [];
    if (classId) {
      const classIdNum = Number(classId);
      if (Number.isFinite(classIdNum)) {
        conditions.push(eq(enrollments.classId, classIdNum));
      }
    }
    if (studentId) {
      conditions.push(eq(enrollments.studentId, studentId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        classId: enrollments.classId,
        studentId: enrollments.studentId,
        createdAt: enrollments.createdAt,
        student: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(enrollments)
      .leftJoin(user, eq(enrollments.studentId, user.id))
      .where(whereClause);

    res.status(200).json({ data: results });
  } catch (e) {
    console.error(`GET /enrollments error: ${e}`);
    res.status(500).json({ error: "Failed to get enrollments" });
  }
});

export default router;
