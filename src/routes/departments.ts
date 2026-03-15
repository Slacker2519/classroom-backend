import express from "express";
import { db } from "../db/index.js";
import {departments, subjects} from "../db/schema/index.js";
import { and, desc, getTableColumns, ilike, sql } from "drizzle-orm";
import { requirePermission } from "../lib/permissions.js";

const router = express.Router();

// Permission middleware for department routes
const departmentReadPermission = requirePermission({ department: ["read"] });

router.get("/", departmentReadPermission, async (req, res) => {
    try {
        const { search, subject, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);

        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                ilike(departments.name, `%${search}%`)
            );
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(departments)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const departmentsList = await db
            .select({
                ...getTableColumns(departments),
            })
            .from(departments)
            .where(whereClause)
            .orderBy(desc(departments.createdAt), desc(departments.id))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: departmentsList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });
    } catch (e) {
        console.error(`GET /departments error: ${e}`);
        res.status(500).json({ error: "Failed to get departments" });
    }
});

export default router;
