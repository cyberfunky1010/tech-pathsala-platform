import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { listRegistrationRequests } from "@/modules/students/registration.service";

export async function GET() {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Registration requests are not connected yet.");
  try {
    const requests = await listRegistrationRequests(await getCurrentUserContext());
    return apiData(requests.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, message, "Please sign in.");
    if (message === "USER_NOT_PROVISIONED" || message === "FORBIDDEN") return apiError(403, message, "You do not have permission to view registration requests.");
    return apiError(500, "REGISTRATION_READ_FAILED", "Registration requests could not be loaded.");
  }
}
