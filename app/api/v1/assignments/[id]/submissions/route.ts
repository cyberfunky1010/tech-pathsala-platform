import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  listAssignmentSubmissions,
  submitAssignment,
} from "@/modules/assignments/assignment.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Submissions are not connected yet.");
  try {
    return apiData(await listAssignmentSubmissions((await params).id, await getCurrentUserContext()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, message, "Please sign in to view submissions.");
    if (message === "USER_NOT_PROVISIONED" || message === "FORBIDDEN") return apiError(403, message, "You do not have permission to view these submissions.");
    if (message === "NOT_FOUND") return apiError(404, message, "Assignment was not found.");
    return apiError(500, "SUBMISSIONS_READ_FAILED", "Submissions could not be loaded.");
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Submissions are not connected yet.");
  try {
    const submission = await submitAssignment((await params).id, await getCurrentUserContext());
    return apiData({ ...submission, submittedAt: submission.submittedAt?.toISOString() }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in to submit.");
    if (error instanceof Error && error.message === "USER_NOT_PROVISIONED") return apiError(403, "USER_NOT_PROVISIONED", "Your account is not connected to a PathSala profile.");
    if (error instanceof Error && error.message === "FORBIDDEN") return apiError(403, "FORBIDDEN", "Only eligible students can submit assignments.");
    if (error instanceof Error && error.message === "NOT_FOUND") return apiError(404, "NOT_FOUND", "Assignment was not found or is not available.");
    return apiError(500, "SUBMISSION_CREATE_FAILED", "Your submission could not be saved.");
  }
}
