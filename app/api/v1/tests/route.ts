import { NextRequest } from "next/server";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { createTestSchema, testQuerySchema } from "@/modules/tests/test.schemas";
import { createTest, listStudentTests, listTests } from "@/modules/tests/test.service";

export const dynamic = "force-dynamic";

function handleError(error: unknown, action: "read" | "create") {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  if (message === "SUPABASE_NOT_CONFIGURED") return apiError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured yet.");
  if (message === "USER_NOT_PROVISIONED") return apiError(403, "USER_NOT_PROVISIONED", "Your account is not connected to a PathSala profile.");
  if (message === "FORBIDDEN") return apiError(403, "FORBIDDEN", "You do not have permission to manage tests.");
  if (message === "SCHOOL_SCOPE_REQUIRED") return apiError(403, "SCHOOL_SCOPE_REQUIRED", "School Admins can only create school tests.");
  if (message === "INVALID_SCHOOL") return apiError(403, "INVALID_SCHOOL", "Select a school assigned to this workspace.");
  if (message === "SUBJECT_NOT_FOUND") return apiError(422, "SUBJECT_NOT_FOUND", "Select a published subject.");
  if (message === "QUESTIONS_REQUIRED") return apiError(422, "QUESTIONS_REQUIRED", "Add at least one question before making a test live.");
  return apiError(500, `TESTS_${action.toUpperCase()}_FAILED`, `Tests could not be ${action === "read" ? "loaded" : "created"}.`);
}

export async function GET(request: NextRequest) {
  const result = testQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!result.success) return apiError(400, "INVALID_QUERY", "Please check the test filters.", result.error.flatten());
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Tests are not connected yet.");
  try {
    const context = await getCurrentUserContext();
    return apiData(context.roles.includes("STUDENT") ? await listStudentTests(context) : await listTests(context, result.data));
  } catch (error) { return handleError(error, "read"); }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  const result = createTestSchema.safeParse(body);
  if (!result.success) return apiError(422, "VALIDATION_ERROR", "Please correct the test fields.", result.error.flatten());
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Tests cannot be saved yet.");
  try { return apiData(await createTest(result.data, await getCurrentUserContext()), 201); } catch (error) { return handleError(error, "create"); }
}
