import express from "express";
import { db } from "../db/index.js";
import {departments, subjects} from "../db/schema/index.js";
import {and, desc, eq, getTableColumns, ilike, or, sql} from "drizzle-orm";
import {error} from "better-auth/api";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { search, department, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100); // Max 100 records per page

        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or (
                    ilike(subjects.name, `%${search}%`),
                    ilike(subjects.code, `%${search}%`)
                )
            );
        }

        if (department) {
            const deptPattern = `%${String(department).replace(/[%_]/g, '\\$&')}%`;
            filterConditions.push(ilike(departments.name, deptPattern));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const subjectsList = await db
            .select({
                ...getTableColumns(subjects),
                department: { ...getTableColumns(departments)}
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
            }
        });
    } catch (e) {
        console.error(`Get /subjects error: ${e}`);
        res.status(500).json({ error: "Failed to get subjects" });
    }
});

router.post("/", async (req, res) => {
    try {
        const { departmentId, name, code, description } = req.body;

            if (!departmentId || !name || !code) {
            return res.status(400).json({
                    error: "Missing required fields: departmentId, name, and code are required"
                });
            }

            if (typeof departmentId !== 'number' || !Number.isInteger(departmentId)) {
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

export default router;