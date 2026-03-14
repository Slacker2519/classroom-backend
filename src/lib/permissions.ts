/**
 * Permission Middleware for API Routes
 * 
 * This middleware provides role-based access control for API routes.
 * It integrates with the access-control setup in access-control.ts.
 */

import { auth } from "./auth.js";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response, NextFunction } from "express";
import {error} from "better-auth/api";

/**
 * Permission type - matches the permission structure in access-control.ts
 */
type Permission = Record<string, string[]>;

/**
 * Options for permission check
 */
interface PermissionCheckOptions {
    /** The permission to check (e.g., { class: ["create"] }) */
    permissions: Permission;
    /** Whether to allow the organization creator (owner) to have all permissions */
    allowCreatorAllPermissions?: boolean;
}

/**
 * Get the current user's membership record in the active organization
 */
async function getActiveMember(organizationId: string, headers: any) {
    const authApi = auth.api as any;
    // Use listMembers to find the current user's membership
    const membersResponse = await authApi.listMembers({
        headers,
        query: { organizationId }
    });
    
    // Find the current user's membership
    if (membersResponse?.members) {
        const currentUserId = (await auth.api.getSession({ headers }))?.user?.id;
        const membership = membersResponse.members.find(
            (m: any) => m.userId === currentUserId
        );
        return membership;
    }
    return null;
}

/**
 * Check if the current request has the required permission
 * 
 * @param req - Express request object
 * @param options - Permission check options
 * @returns Promise<boolean> - True if user has permission
 */
async function checkPermission(req: Request, options: PermissionCheckOptions): Promise<boolean> {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session || !session.session) {
            return false;
        }

        // If user has an active organization, check organization-level permissions
        if (session.session.activeOrganizationId) {
            try {
                const headers = fromNodeHeaders(req.headers);
                const authApi = auth.api as any;
                
                // Get the user's membership record in this organization
                const membership = await getActiveMember(
                    session.session.activeOrganizationId,
                    headers
                );

                if (membership) {
                    const role = membership.role;
                    
                    // Get the access control from auth options
                    const roles = (auth as any).options?.plugins?.[0]?.roles;
                    
                    if (roles && role) {
                        const roleDef = roles[role];
                        if (roleDef) {
                            const result = roleDef.authorize(options.permissions);
                            if (result.success) {
                                return true;
                            }
                        }
                    }
                    
                    // Owner/admin always has access
                    if (options.allowCreatorAllPermissions && role === "admin") {
                        return true;
                    }
                }
            } catch (e) {
                console.error("Error checking member permissions:", e);
            }
        }

        // If no active organization, check if user is admin
        const userRole = (session.user as any).role;
        if (userRole === "admin") {
            return true;
        }

        return false;
    } catch (error) {
        console.error("Permission check error:", error);
        return false;
    }
}

/**
 * Express middleware to require specific permissions
 * 
 * @param permissions - The permissions required to access the route
 * @param allowCreatorAllPermissions - Whether to allow organization creator full access
 * 
 * @example
 * // Require class:create permission
 * router.post("/", requirePermission({ class: ["create"] }), createClass);
 */
export function requirePermission(
    permissions: Permission,
    allowCreatorAllPermissions: boolean = true
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const hasAccess = await checkPermission(req, {
            permissions,
            allowCreatorAllPermissions,
        });

        if (!hasAccess) {
            return res.status(403).json({
                error: "FORBIDDEN",
                message: "You don't have permission to perform this action",
            });
        }

        next();
    };
}

/**
 * Optional permission check - adds permission info to request but doesn't block
 * 
 * @param permissions - The permissions to check
 */
export function checkOptionalPermission(permissions: Permission) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const hasAccess = await checkPermission(req, { permissions });
        (req as any).hasPermission = hasAccess;
        next();
    };
}

/**
 * Get current user's role in the active organization
 * 
 * @param req - Express request object
 * @returns The role name or null if not found
 */
export async function getUserRole(req: Request): Promise<string | null> {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session || !session.session) {
            return null;
        }

        // If user has an active organization, get their role from the membership
        if (session.session.activeOrganizationId) {
            try {
                const headers = fromNodeHeaders(req.headers);
                
                // Get the user's membership record
                const membership = await getActiveMember(
                    session.session.activeOrganizationId,
                    headers
                );
                
                if (membership) {
                    return membership.role;
                }
            } catch (e) {
                console.error("Error getting member:", e);
            }
        }

        // Fallback to user role
        return (session.user as any).role || null;
    } catch (error) {
        console.error("Get user role error:", error);
        return null;
    }
}
