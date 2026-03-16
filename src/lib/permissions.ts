import { auth } from "./auth.js";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response, NextFunction } from "express";
import {error} from "better-auth/api";

type Permission = Record<string, string[]>;

interface PermissionCheckOptions {
    permissions: Permission;
    allowCreatorAllPermissions?: boolean;
}

async function getActiveMember(organizationId: string, headers: any) {
    const authApi = auth.api as any;
    const membersResponse = await authApi.listMembers({
        headers,
        query: { organizationId }
    });
    
    if (membersResponse?.members) {
        const currentUserId = (await auth.api.getSession({ headers }))?.user?.id;
        const membership = membersResponse.members.find(
            (m: any) => m.userId === currentUserId
        );
        return membership;
    }
    return null;
}

function getOrgRoles(authInstance: any) {
    const plugins = authInstance.options?.plugins;
    if (!plugins) return null;
    
    for (const plugin of plugins) {
        if (plugin?.roles) {
            return plugin.roles;
        }
    }
    return null;
}

async function checkPermission(req: Request, options: PermissionCheckOptions): Promise<boolean> {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session || !session.session) {
            return false;
        }

        if (session.session.activeOrganizationId) {
            try {
                const headers = fromNodeHeaders(req.headers);
                const authApi = auth.api as any;
                
                const membership = await getActiveMember(
                    session.session.activeOrganizationId,
                    headers
                );

                if (membership) {
                    const role = membership.role;
                    
                    const roles = getOrgRoles(auth);
                    
                    if (roles && role) {
                        const roleDef = roles[role];
                        if (roleDef) {
                            const result = roleDef.authorize(options.permissions);
                            if (result.success) {
                                return true;
                            }
                        }
                    }
                    
                    if (options.allowCreatorAllPermissions && role === "admin") {
                        return true;
                    }
                }
            } catch (e) {
                console.error("Error checking member permissions:", e);
            }
        }

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

export function checkOptionalPermission(permissions: Permission) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const hasAccess = await checkPermission(req, { permissions });
        (req as any).hasPermission = hasAccess;
        next();
    };
}

export async function getUserRole(req: Request): Promise<string | null> {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session || !session.session) {
            return null;
        }

        if (session.session.activeOrganizationId) {
            try {
                const headers = fromNodeHeaders(req.headers);
                
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

        return (session.user as any).role || null;
    } catch (error) {
        console.error("Get user role error:", error);
        return null;
    }
}
