import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { listStudentResults } from "@/modules/tests/test.service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Results are not connected yet.");
  try {
    return apiData(await listStudentResults(await getCurrentUserContext()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    if (message === "SUPABASE_NOT_CONFIGURED") return apiError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured yet.");
    if (message === "USER_NOT_PROVISIONED") return apiError(403, "USER_NOT_PROVISIONED", "Your account is not connected to a student profile.");
    if (message === "FORBIDDEN") return apiError(403, "FORBIDDEN", "Only students can view test results.");
    return apiError(500, "RESULTS_READ_FAILED", "Results could not be loaded.");
  }
}
