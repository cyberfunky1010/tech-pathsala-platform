import { NextRequest } from "next/server";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { startStudentAttempt } from "@/modules/tests/test.service";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Tests are not connected yet.");
  try {
    return apiData(await startStudentAttempt((await params).id, await getCurrentUserContext()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    if (message === "USER_NOT_PROVISIONED" || message === "FORBIDDEN") return apiError(403, "FORBIDDEN", "You are not eligible for this test.");
    if (message === "NOT_FOUND") return apiError(404, "NOT_FOUND", "This test is not currently available.");
    return apiError(500, "TEST_ATTEMPT_START_FAILED", "The test attempt could not be started.");
  }
}
