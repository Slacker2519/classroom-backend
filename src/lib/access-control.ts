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
  ...memberAc.statements,
  class: ["create", "read", "update", "delete", "join"],
  subject: ["read"],
  department: ["read"],
  profile: ["create", "read", "update", "delete"],
  student: ["read"],
  invitation: ["create", "read"],
});

export const studentRole = ac.newRole({
  ...memberAc.statements,
  class: ["read", "join"],
  subject: ["read"],
  department: ["read"],
  profile: ["create", "read", "update", "delete"],
  teacher: ["read"],
});

export const roles = {
  admin: adminRole,
  teacher: teacherRole,
  student: studentRole,
} as const;

export type RoleName = keyof typeof roles;
