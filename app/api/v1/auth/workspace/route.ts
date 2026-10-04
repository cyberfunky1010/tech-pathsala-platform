import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { workspaceCookieValue, type Workspace } from "@/lib/auth/workspace";

export async function POST(request: Request) {
  let body: { mode?: string; schoolId?: string };
  try {
    body = await request.json() as { mode?: string; schoolId?: string };
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const workspace: Workspace | null = body.mode === "CENTRAL_ADMIN"
    ? { mode: "CENTRAL_ADMIN" }
    : body.mode === "SCHOOL_ADMIN" && body.schoolId
      ? { mode: "SCHOOL_ADMIN", schoolId: body.schoolId }
      : null;
  if (!workspace) return apiError(422, "INVALID_WORKSPACE", "Choose a valid workspace.");

  try {
    const context = await getCurrentUserContext();
    const allowed =
      workspace.mode === "CENTRAL_ADMIN"
        ? context.roles.includes("CENTRAL_ADMIN")
        : context.roles.includes("SCHOOL_ADMIN") && context.schoolIds.includes(workspace.schoolId);
    if (!allowed) return apiError(403, "FORBIDDEN", "You do not have access to this workspace.");

    const response = NextResponse.json({ data: { workspace } });
    response.cookies.set("pathsala_workspace", workspaceCookieValue(workspace), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return apiError(401, "UNAUTHENTICATED", "Please sign in.");
    }
    return apiError(500, "WORKSPACE_UPDATE_FAILED", "Workspace could not be changed.");
  }
}
