import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { createRegistrationRequestSchema } from "@/modules/students/registration.schemas";
import { createRegistrationRequest } from "@/modules/students/registration.service";

export async function POST(request: Request) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Registration is not connected yet.");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  const result = createRegistrationRequestSchema.safeParse(body);
  if (!result.success) return apiError(422, "VALIDATION_ERROR", "Please correct your registration details.", result.error.flatten());
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return apiError(401, "UNAUTHENTICATED", "Please sign in before requesting approval.");
    const requestRecord = await createRegistrationRequest({ id: data.user.id, email: data.user.email }, result.data);
    return apiData({ ...requestRecord, createdAt: requestRecord.createdAt.toISOString() }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_EXISTS") return apiError(409, "REQUEST_EXISTS", "You already have a pending registration request.");
    if (error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED") return apiError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured yet.");
    return apiError(500, "REGISTRATION_CREATE_FAILED", "Registration request could not be saved.");
  }
}
