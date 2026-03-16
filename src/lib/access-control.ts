import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc, memberAc } from "better-auth/plugins/organization/access";

const statements = {
  ...defaultStatements,
  
  class: ["create", "read", "update", "delete", "join"],
  subject: ["create", "read", "update", "delete"],
  department: ["create", "read", "update", "delete"],
  profile: ["create", "read", "update", "delete"],
  student: ["read"],
  teacher: ["read"],
  invitation: ["create", "cancel", "read"],
} as const;

export const ac = createAccessControl(statements);

export const adminRole = ac.newRole({
  ...adminAc.statements,
  class: ["create", "read", "update", "delete", "join"],
  subject: ["create", "read", "update", "delete"],
  department: ["create", "read", "update", "delete"],
  profile: ["create", "read", "update", "delete"],
  student: ["read"],
  teacher: ["read"],
  invitation: ["create", "cancel", "read"],
});

export const teacherRole = ac.newRole({
  // Include basic member permissions
  ...memberAc.statements,
  // Class permissions (teacher can manage their own classes)
  class: ["create", "read", "update", "delete", "join"],
  // Read-only for subjects and departments
  subject: ["read"],
  department: ["read"],
  // Profile permissions (teacher can manage their own profile)
  profile: ["create", "read", "update", "delete"],
  // Can read student info
  student: ["read"],
  invitation: ["create", "read"],
});

/**
 * Student role:
 * - Can CRUD their own profile
 * - Can read classes, subjects, departments
 * - Can join classes via invite code
 */
export const studentRole = ac.newRole({
  // Include basic member permissions
  ...memberAc.statements,
  // Class permissions (read + join via invite)
  class: ["read", "join"],
  // Read-only for subjects and departments
  subject: ["read"],
  department: ["read"],
  // Profile permissions (student can manage their own profile)
  profile: ["create", "read", "update", "delete"],
  // Can read teacher info
  teacher: ["read"],
});

/**
 * Export all roles for use in auth configuration
 */
export const roles = {
  admin: adminRole,
  teacher: teacherRole,
  student: studentRole,
} as const;

/**
 * TypeScript type for role names
 */
export type RoleName = keyof typeof roles;
