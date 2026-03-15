import express from "express";
import {and, desc, eq, getTableColumns, ilike, inArray, or, sql} from "drizzle-orm";
import {user} from "../db/schema/index.js";
import { db } from "../db/index.js";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { requirePermission } from "../lib/permissions.js";

const router = express.Router();

// Permission middleware for user routes
const userReadPermission = requirePermission({ profile: ["read"] });
const userCreatePermission = requirePermission({ profile: ["create"] });

// Get all users with optional search, filtering and pagination
// Results are scoped to the caller's active organization
router.get("/", userReadPermission, async (req, res) => {
    try {
        const { search, role, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100); // Max 100 records per page

        const offset = (currentPage - 1) * limitPerPage;

        // Get the current session to find the active organization
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session || !session.session) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Get members of the active organization to scope results
        let orgMemberUserIds: string[] = [];
        
        if (session.session.activeOrganizationId) {
            try {
                const authApi = auth.api as any;
                const membersResponse = await authApi.listMembers({
                    headers: fromNodeHeaders(req.headers),
                    query: { organizationId: session.session.activeOrganizationId }
                });
                
                if (membersResponse?.members) {
                    orgMemberUserIds = membersResponse.members.map((m: any) => m.userId);
                }
            } catch (e) {
                console.error("Error fetching organization members:", e);
                return res.status(500).json({
                    error: "Failed to resolve organization members",
                });
            }
        }

        // If no organization or no members found, return empty result
        if (orgMemberUserIds.length === 0) {
            return res.status(200).json({
                data: [],
                pagination: {
                    page: currentPage,
                    limit: limitPerPage,
                    total: 0,
                    totalPages: 0,
                }
            });
        }

        const filterConditions = [];

        // Filter to only organization members
        filterConditions.push(inArray(user.id, orgMemberUserIds));

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
router.post("/", userCreatePermission, async (req, res) => {
    try {
        const { name, email, password, role, image } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({
                error: "Missing required fields: name, email, password and role are required"
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
            return res.status(400).json({ error: e.message || "Failed to create user" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
