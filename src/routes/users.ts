import express from "express";
import {and, desc, eq, getTableColumns, ilike, or, sql} from "drizzle-orm";
import {user} from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

// Get all users with optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, role, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100); // Max 100 records per page

        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        // If a search query exists, filter by user name OR email
        if (search) {
            filterConditions.push(
                or (
                    ilike(user.name, `%${search}%`),
                    ilike(user.email, `%${search}%`)
                )
            );
        }

        // If a role filter exists, match the role exactly
        if (role) {
            filterConditions.push(eq(user.role, role as any));
        }

        // Combine all filters using AND if any exist
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(user)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const usersList = await db
            .select({
                ...getTableColumns(user),
            }).from(user)
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
            }
        })
    } catch (e) {
        console.error(`Get /users error: ${e}`);
        res.status(500).json({ error: "Failed to get users" });
    }
})

// Create a new user
router.post("/", async (req, res) => {
    try {
        const { name, email, role, image } = req.body;

        if (!name || !email || !role) {
            return res.status(400).json({
                error: "Missing required fields: name, email and role are required"
            });
        }

        const userId = crypto.randomUUID();

        const [createdUser] = await db
            .insert(user)
            .values({
                id: userId,
                name,
                email,
                role: role || "student",
                image: image || null,
                emailVerified: false,
            })
            .returning();

        if (!createdUser) {
            throw new Error("Failed to create user");
        }

        res.status(201).json({ data: createdUser });
    } catch (e: any) {
        console.error(`POST /users error: ${e}`);
        if (e.code === '23505') { // Unique violation in Postgres
            return res.status(400).json({ error: "User with this email already exists" });
        }
        res.status(500).json({ error: "Failed to create user" });
    }
});

export default router;
