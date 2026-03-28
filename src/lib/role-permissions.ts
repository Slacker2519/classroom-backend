export const ROLE_PERMISSIONS = {
  admin: {
    subject: ["create", "read", "update", "delete"],
    department: ["create", "read", "update", "delete"],
    class: ["create", "read", "update", "delete", "join"],
    profile: ["create", "read", "update", "delete"],
    student: ["read", "delete"],
    invitation: ["create", "cancel", "read"],
  },
  teacher: {
    subject: ["read"],
    department: ["read"],
    class: ["create", "read", "update", "delete", "join"],
    profile: ["create", "read", "update", "delete"],
    student: ["read"],
    teacher: ["read"],
    invitation: ["create", "read"],
  },
  student: {
    subject: ["read"],
    department: ["read"],
    class: ["read", "join"],
    profile: ["create", "read", "update", "delete"],
    teacher: ["read"],
  },
} as const;
