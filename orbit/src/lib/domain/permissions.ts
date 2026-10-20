import type { MemberRole } from "./types";

export const PERMISSIONS = [
  "missions:read",
  "missions:write",
  "missions:execute",
  "approvals:decide",
  "records:read",
  "records:write",
  "work_items:write",
  "reports:write",
  "email:draft",
  "email:send",
  "integrations:manage",
  "policies:manage",
  "org:manage",
  "audit:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<MemberRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS.filter((p) => p !== "org:manage"),
  member: [
    "missions:read",
    "missions:write",
    "missions:execute",
    "records:read",
    "records:write",
    "work_items:write",
    "reports:write",
    "email:draft",
    "audit:read",
  ],
  viewer: ["missions:read", "records:read", "audit:read"],
};

export function hasPermission(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: MemberRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export class PermissionError extends Error {
  constructor(readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionError";
  }
}

export function requirePermission(role: MemberRole, permission: Permission): void {
  if (!hasPermission(role, permission)) throw new PermissionError(permission);
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  viewer: "Leitor",
};
