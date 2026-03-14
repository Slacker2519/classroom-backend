/**
 * Permission Middleware for API Routes
 * 
 * This middleware provides role-based access control for API routes.
 * It integrates with the access-control setup in access-control.ts.
 */

import { auth } from "./auth.js";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response, NextFunction } from "express";

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
                // Get member info to check role - use type assertion for auth.api
                const authApi = auth.api as any;
                const memberResponse = await authApi.getMember({
                    headers: fromNodeHeaders(req.headers),
                    params: {
                        organizationId: session.session.activeOrganizationId,
                        memberId: session.user.id,
                    }
                });

                if (memberResponse?.member) {
                    const role = memberResponse.member.role;
                    
                    // Get the access control from auth options
                    const ac = (auth as any).options?.plugins?.[0]?.ac;
                    const roles = (auth as any).options?.plugins?.[0]?.roles;
                    
                    if (ac && roles && role) {
                        const roleDef = roles[role];
                        if (roleDef) {
                            // Check if role has the required permission
                            const result = roleDef.authorize(options.permissions);
                            return result.success;
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
                const authApi = auth.api as any;
                const member = await authApi.getMember({
                    headers: fromNodeHeaders(req.headers),
                    params: {
                        organizationId: session.session.activeOrganizationId,
                        memberId: session.user.id,
                    }
                });
                
                if (member?.member) {
                    return member.member.role;
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
