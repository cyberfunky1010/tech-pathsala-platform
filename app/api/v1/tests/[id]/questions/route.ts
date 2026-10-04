import { NextRequest } from "next/server";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { createQuestionSchema } from "@/modules/tests/question.schemas";
import { createQuestion, listQuestions } from "@/modules/tests/question.service";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

function handleError(error: unknown, action: "read" | "create") {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  if (message === "SUPABASE_NOT_CONFIGURED") return apiError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured yet.");
  if (message === "USER_NOT_PROVISIONED") return apiError(403, "USER_NOT_PROVISIONED", "Your account is not connected to a PathSala profile.");
  if (message === "FORBIDDEN") return apiError(403, "FORBIDDEN", "You do not have permission to manage questions.");
  if (message === "NOT_FOUND") return apiError(404, "NOT_FOUND", "Test was not found in your active workspace.");
  return apiError(500, `QUESTIONS_${action.toUpperCase()}_FAILED`, `Questions could not be ${action === "read" ? "loaded" : "created"}.`);
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Questions are not connected yet.");
  try {
    return apiData(await listQuestions((await params).id, await getCurrentUserContext()));
  } catch (error) {
    return handleError(error, "read");
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  const result = createQuestionSchema.safeParse(body);
  if (!result.success) return apiError(422, "VALIDATION_ERROR", "Please correct the question and options.", result.error.flatten());
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Questions cannot be saved yet.");
  try {
    return apiData(await createQuestion((await params).id, result.data, await getCurrentUserContext()), 201);
  } catch (error) {
    return handleError(error, "create");
  }
}
