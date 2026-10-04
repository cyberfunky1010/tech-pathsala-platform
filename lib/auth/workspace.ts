import { cookies } from "next/headers";
import type { RoleName } from "@prisma/client";

export const WORKSPACE_COOKIE = "pathsala_workspace";

export type Workspace =
  | { mode: "CENTRAL_ADMIN" }
  | { mode: "SCHOOL_ADMIN"; schoolId: string };

export type WorkspaceOption = Workspace & { label: string };

export async function getRequestedWorkspace(): Promise<Workspace | null> {
  const value = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  if (value === "CENTRAL_ADMIN") return { mode: "CENTRAL_ADMIN" };
  if (value?.startsWith("SCHOOL_ADMIN:")) {
    return { mode: "SCHOOL_ADMIN", schoolId: value.slice("SCHOOL_ADMIN:".length) };
  }
  return null;
}

export function workspaceCookieValue(workspace: Workspace) {
  return workspace.mode === "CENTRAL_ADMIN"
    ? "CENTRAL_ADMIN"
    : `SCHOOL_ADMIN:${workspace.schoolId}`;
}

export function resolveWorkspace(
  roles: RoleName[],
  schoolIds: string[],
  requested: Workspace | null,
): Workspace {
  if (requested?.mode === "SCHOOL_ADMIN" && roles.includes("SCHOOL_ADMIN") && schoolIds.includes(requested.schoolId)) {
    return requested;
  }
  if (requested?.mode === "CENTRAL_ADMIN" && roles.includes("CENTRAL_ADMIN")) {
    return requested;
  }
  if (roles.includes("CENTRAL_ADMIN")) return { mode: "CENTRAL_ADMIN" };
  if (roles.includes("SCHOOL_ADMIN") && schoolIds[0]) {
    return { mode: "SCHOOL_ADMIN", schoolId: schoolIds[0] };
  }
  return { mode: "SCHOOL_ADMIN", schoolId: schoolIds[0] ?? "" };
}
