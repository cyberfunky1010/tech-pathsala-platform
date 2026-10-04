import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { approveRegistrationRequestSchema } from "@/modules/students/registration.schemas";
import { approveRegistrationRequest } from "@/modules/students/registration.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Approval is not connected yet.");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  const result = approveRegistrationRequestSchema.safeParse(body);
  if (!result.success) return apiError(422, "VALIDATION_ERROR", "Please provide valid enrollment details.", result.error.flatten());
  try {
    return apiData(await approveRegistrationRequest((await params).id, result.data, await getCurrentUserContext()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, message, "Please sign in.");
    if (message === "USER_NOT_PROVISIONED" || message === "FORBIDDEN") return apiError(403, message, "You do not have permission to approve this request.");
    if (message === "NOT_FOUND") return apiError(404, message, "Registration request was not found.");
    if (message === "SCHOOL_NOT_FOUND") return apiError(422, message, "The submitted school ID was not found or is inactive.");
    if (message === "ACADEMIC_YEAR_NOT_FOUND") return apiError(422, message, "The submitted academic year is not configured. Use the current academic year shown by your school.");
    if (message === "STUDENT_ROLE_NOT_CONFIGURED") return apiError(500, message, "Student approval is not configured correctly. The STUDENT role is missing.");
    if (message === "DUPLICATE_ENROLLMENT") return apiError(409, message, "That admission number is already enrolled for this school and academic year.");
    return apiError(500, "REGISTRATION_APPROVAL_FAILED", "Registration could not be approved.");
  }
}
