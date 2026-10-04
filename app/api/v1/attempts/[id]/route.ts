import { NextRequest } from "next/server";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { getStudentAttempt, saveStudentAnswer, submitStudentAttempt } from "@/modules/tests/test.service";
import { z } from "zod";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
const answerSchema = z.object({ questionId: z.string().uuid(), selectedOptionId: z.string().uuid().nullable() });

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  if (message === "FORBIDDEN") return apiError(403, "FORBIDDEN", "This attempt does not belong to you.");
  if (message === "NOT_FOUND") return apiError(404, "NOT_FOUND", "Attempt not found.");
  if (message === "ATTEMPT_NOT_ACTIVE") return apiError(409, "ATTEMPT_NOT_ACTIVE", "This attempt is no longer active.");
  if (message === "ATTEMPT_EXPIRED") return apiError(409, "ATTEMPT_EXPIRED", "Your attempt timer has expired.");
  if (message === "INVALID_QUESTION" || message === "INVALID_OPTION") return apiError(422, "INVALID_ANSWER", "That answer is not valid for this attempt.");
  return apiError(500, "ATTEMPT_OPERATION_FAILED", "The attempt could not be updated.");
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Tests are not connected yet.");
  try { return apiData(await getStudentAttempt((await params).id, await getCurrentUserContext())); }
  catch (error) { return handleError(error); }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  const result = answerSchema.safeParse(body);
  if (!result.success) return apiError(422, "VALIDATION_ERROR", "Choose a valid option.", result.error.flatten());
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Tests are not connected yet.");
  try {
    return apiData(await saveStudentAnswer((await params).id, result.data.questionId, result.data.selectedOptionId, await getCurrentUserContext()));
  } catch (error) { return handleError(error); }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Tests are not connected yet.");
  try { return apiData(await submitStudentAttempt((await params).id, await getCurrentUserContext())); }
  catch (error) { return handleError(error); }
}
