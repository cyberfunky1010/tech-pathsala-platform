import { z } from "zod";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { evaluateSubmission } from "@/modules/assignments/assignment.service";

const schema = z.object({ marks: z.number().min(0), maxMarks: z.number().positive(), feedback: z.string().trim().max(5000).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Evaluation is not connected yet.");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  const result = schema.safeParse(body);
  if (!result.success) return apiError(422, "VALIDATION_ERROR", "Enter valid marks and feedback.", result.error.flatten());
  try {
    const evaluation = await evaluateSubmission((await params).id, result.data, await getCurrentUserContext());
    return apiData({ ...evaluation, evaluatedAt: evaluation.evaluatedAt?.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, message, "Please sign in to evaluate.");
    if (message === "USER_NOT_PROVISIONED" || message === "FORBIDDEN") return apiError(403, message, "You do not have permission to evaluate this submission.");
    if (message === "NOT_FOUND") return apiError(404, message, "Submission was not found.");
    if (message === "INVALID_MARKS") return apiError(422, message, "Marks must be between zero and the maximum marks.");
    return apiError(500, "EVALUATION_FAILED", "The evaluation could not be saved.");
  }
}
