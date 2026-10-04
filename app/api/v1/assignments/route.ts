import { NextRequest } from "next/server";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { assignmentQuerySchema, createAssignmentSchema } from "@/modules/assignments/assignment.schemas";
import { createAssignment, listAssignments } from "@/modules/assignments/assignment.service";

export const dynamic = "force-dynamic";

function handleError(error: unknown, action: "read" | "create") {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  if (error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED") return apiError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured yet.");
  if (error instanceof Error && error.message === "USER_NOT_PROVISIONED") return apiError(403, "USER_NOT_PROVISIONED", "Your account is not connected to a PathSala profile.");
  if (error instanceof Error && error.message === "FORBIDDEN") return apiError(403, "FORBIDDEN", "You do not have permission to manage assignments.");
  if (error instanceof Error && error.message === "SCHOOL_SCOPE_REQUIRED") return apiError(403, "SCHOOL_SCOPE_REQUIRED", "Your account is not assigned to a school.");
  return apiError(500, `ASSIGNMENTS_${action.toUpperCase()}_FAILED`, `Assignments could not be ${action === "read" ? "loaded" : "created"}.`);
}

export async function GET(request: NextRequest) {
  const result = assignmentQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!result.success) return apiError(400, "INVALID_QUERY", "Please check the assignment filters.", result.error.flatten());
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Assignments are not connected yet.");
  try {
    return apiData(await listAssignments(await getCurrentUserContext(), result.data));
  } catch (error) {
    return handleError(error, "read");
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  const result = createAssignmentSchema.safeParse(body);
  if (!result.success) return apiError(422, "VALIDATION_ERROR", "Please correct the assignment fields.", result.error.flatten());
  if (result.data.scope === "SCHOOL" && "schoolId" in (body as Record<string, unknown>)) {
    return apiError(400, "SCHOOL_SCOPE_MUST_BE_DERIVED", "School scope is derived from the authenticated user.");
  }
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Assignments cannot be saved yet.");
  try {
    return apiData(await createAssignment(result.data, await getCurrentUserContext()), 201);
  } catch (error) {
    return handleError(error, "create");
  }
}
