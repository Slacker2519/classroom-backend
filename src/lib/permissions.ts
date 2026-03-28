import { auth } from "./auth.js";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response, NextFunction } from "express";
import { ROLE_PERMISSIONS } from "./role-permissions.js";

type Permission = Record<string, string[]>;

interface PermissionCheckOptions {
  permissions: Permission;
}

async function checkPermission(
  req: Request,
  options: PermissionCheckOptions,
): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session || !session.session) return false;

  const userRole = (session.user as any).role as keyof typeof ROLE_PERMISSIONS;
  const permissions = ROLE_PERMISSIONS[userRole];

  if (!permissions) return false;

  const required = options.permissions;
  for (const [resource, actions] of Object.entries(required)) {
    const allowed = permissions[resource] || [];
    const hasAllActions = actions.every((action) => allowed.includes(action));
    if (!hasAllActions) return false;
  }

  return true;
}

export function requirePermission(permissions: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const hasAccess = await checkPermission(req, { permissions });

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

    if (!session || !session.session) return null;

    return (session.user as any).role || null;
  } catch (error) {
    return null;
  }
}
