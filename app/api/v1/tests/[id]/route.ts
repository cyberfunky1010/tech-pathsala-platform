import { NextRequest } from "next/server";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { updateTestSchema } from "@/modules/tests/test.schemas";
import { deleteTest, getStudentTest, updateTest } from "@/modules/tests/test.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  const result = updateTestSchema.safeParse(body);
  if (!result.success) return apiError(422, "VALIDATION_ERROR", "Choose a valid test status.", result.error.flatten());
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Tests cannot be updated yet.");
  try {
    return apiData(await updateTest((await params).id, result.data, await getCurrentUserContext()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    if (message === "USER_NOT_PROVISIONED" || message === "FORBIDDEN") return apiError(403, "FORBIDDEN", "You do not have permission to update this test.");
    if (message === "NOT_FOUND") return apiError(404, "NOT_FOUND", "This test was not found or was not created by you.");
    if (message === "QUESTIONS_REQUIRED") return apiError(422, "QUESTIONS_REQUIRED", "Add at least one question before making a test live.");
    return apiError(500, "TEST_UPDATE_FAILED", "The test could not be updated.");
  }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Tests are not connected yet.");
  try {
    return apiData(await getStudentTest((await params).id, await getCurrentUserContext()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    if (message === "USER_NOT_PROVISIONED" || message === "FORBIDDEN") return apiError(403, "FORBIDDEN", "You are not eligible for this test.");
    if (message === "NOT_FOUND") return apiError(404, "NOT_FOUND", "This test is not currently available.");
    return apiError(500, "TEST_READ_FAILED", "The test could not be loaded.");
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!hasDatabaseConfig()) {
    return apiError(503, "DATABASE_NOT_CONFIGURED", "Tests cannot be deleted yet.");
  }
  try {
    await deleteTest((await params).id, await getCurrentUserContext());
    return apiData({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    if (message === "USER_NOT_PROVISIONED") return apiError(403, "USER_NOT_PROVISIONED", "Your account is not connected to a PathSala profile.");
    if (message === "FORBIDDEN") return apiError(403, "FORBIDDEN", "You do not have permission to delete this test.");
    if (message === "NOT_FOUND") return apiError(404, "NOT_FOUND", "This test was not found or was not created by you.");
    return apiError(500, "TEST_DELETE_FAILED", "The test could not be deleted.");
  }
}
