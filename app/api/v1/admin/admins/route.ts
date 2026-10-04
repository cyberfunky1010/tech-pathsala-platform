import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { createAdminSchema, updateAdminAssignmentSchema } from "@/modules/admin/admin.schemas";
import { inviteAdmin, listAdminManagementData, updateAdminAssignment } from "@/modules/admin/admin.service";

export async function GET() {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Admin management is not connected yet.");
  try {
    return apiData(await listAdminManagementData(await getCurrentUserContext()));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in.");
    if (error instanceof Error && (error.message === "USER_NOT_PROVISIONED" || error.message === "FORBIDDEN")) return apiError(403, "FORBIDDEN", "Only a Central Admin in Central Admin workspace can manage administrators.");
    return apiError(500, "ADMIN_LIST_FAILED", "Administrators could not be loaded.");
  }
}

export async function POST(request: Request) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Admin management is not connected yet.");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  const result = createAdminSchema.safeParse(body);
  if (!result.success) return apiError(422, "VALIDATION_ERROR", "Provide an email, role, and managed school.", result.error.flatten());
  try {
    return apiData(await inviteAdmin(result.data, await getCurrentUserContext()), 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, message, "Please sign in.");
    if (message === "FORBIDDEN") return apiError(403, message, "Only a Central Admin in Central Admin workspace can create administrators.");
    if (message === "REFERENCE_NOT_FOUND") return apiError(422, message, "Select an existing active school.");
    if (message === "ALREADY_ASSIGNED") return apiError(409, message, "This user already has that administrator role.");
    if (message === "CENTRAL_ADMIN_SCHOOL_EXISTS") return apiError(409, message, "A Central Admin can have only one active managed school.");
    if (message === "STORAGE_NOT_CONFIGURED") return apiError(503, message, "Supabase service-role configuration is required for invitations.");
    if (message === "INVITE_FAILED") return apiError(502, message, "The administrator invitation could not be sent.");
    return apiError(500, "ADMIN_CREATE_FAILED", "Administrator could not be created.");
  }
}

export async function PATCH(request: Request) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Admin management is not connected yet.");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  const result = updateAdminAssignmentSchema.safeParse(body);
  if (!result.success) return apiError(422, "VALIDATION_ERROR", "Provide a valid assignment action.", result.error.flatten());
  const adminId = new URL(request.url).searchParams.get("adminId");
  if (!adminId) return apiError(422, "VALIDATION_ERROR", "An administrator is required.");
  try {
    return apiData(await updateAdminAssignment(adminId, result.data, await getCurrentUserContext()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, message, "Please sign in.");
    if (message === "FORBIDDEN") return apiError(403, message, "Only a Central Admin in Central Admin workspace can manage administrators.");
    if (message === "NOT_FOUND") return apiError(404, message, "The active school assignment was not found.");
    if (message === "REFERENCE_NOT_FOUND") return apiError(422, message, "Select an existing active school.");
    if (message === "ACTIVE_ASSIGNMENT_EXISTS") return apiError(409, message, "This administrator already has another active school assignment.");
    if (message === "CENTRAL_ADMIN_REQUIRES_SCHOOL") return apiError(409, message, "A Central Admin must keep one managed school. Reassign instead of ending the assignment.");
    return apiError(500, "ADMIN_ASSIGNMENT_UPDATE_FAILED", "The school assignment could not be updated.");
  }
}
