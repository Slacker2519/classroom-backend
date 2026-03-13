/**
 * Access Control Configuration for Classroom App
 * 
 * Roles:
 * - admin: Full access to everything
 * - teacher: CRUD on own classes, CRUD on own profile, read on subjects/departments/students
 * - student: CRUD on own profile, read on classes/subjects/departments, join class via invite
 */

import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc, memberAc } from "better-auth/plugins/organization/access";

/**
 * Define permission statements for all resources in the app
 * Each key is a resource, and the value is an array of allowed actions
 */
const statements = {
  // Include default organization statements and add custom ones
  ...defaultStatements,
  
  // Custom resources for classroom app
  class: ["create", "read", "update", "delete", "join"],
  subject: ["create", "read", "update", "delete"],
  department: ["create", "read", "update", "delete"],
  profile: ["create", "read", "update", "delete"],
  student: ["read"],
  teacher: ["read"],
  invitation: ["create", "cancel", "read"],
} as const;

/**
 * Create the access control instance
 */
export const ac = createAccessControl(statements);

/**
 * Admin role - Full access to everything
 * Uses adminAc.statements from better-auth + custom permissions
 */
export const adminRole = ac.newRole({
  // Include default admin permissions
  ...adminAc.statements,
  // Full access to all custom resources
  class: ["create", "read", "update", "delete", "join"],
  subject: ["create", "read", "update", "delete"],
  department: ["create", "read", "update", "delete"],
  profile: ["create", "read", "update", "delete"],
  student: ["read"],
  teacher: ["read"],
  invitation: ["create", "cancel", "read"],
});

/**
 * Teacher role:
 * - Can CRUD classes they create (own classes)
 * - Can CRUD their own profile
 * - Can read subjects, departments, students
 * - Can create invitations to invite students
 */
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
