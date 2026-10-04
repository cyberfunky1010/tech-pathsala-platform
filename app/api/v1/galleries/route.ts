import { NextRequest } from "next/server";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { createGallerySchema, galleryQuerySchema } from "@/modules/gallery/gallery.schemas";
import { createGallery, listGalleries } from "@/modules/gallery/gallery.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Gallery is not connected yet.");
  const parsed = galleryQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) return apiError(400, "INVALID_QUERY", "Please check the gallery filters.");
  try {
    let context;
    if (parsed.data.type !== "PUBLIC") { try { context = await getCurrentUserContext(); } catch (error) { if (parsed.data.type === "SCHOOL") throw error; } }
    return apiData(await listGalleries(parsed.data, context));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, message, "Please sign in to view school galleries.");
    if (message === "USER_NOT_PROVISIONED") return apiError(403, message, "Your account is not provisioned.");
    return apiError(500, "GALLERY_READ_FAILED", "Gallery could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Gallery is not connected yet.");
  let form: FormData;
  try { form = await request.formData(); } catch { return apiError(400, "INVALID_MULTIPART_FORM", "Upload gallery data as multipart form data."); }
  const parsed = createGallerySchema.safeParse({ title: form.get("title"), description: form.get("description") || undefined, type: form.get("type"), schoolId: form.get("schoolId") || undefined });
  if (!parsed.success) return apiError(422, "VALIDATION_ERROR", "Please provide a title and valid gallery type.", parsed.error.flatten());
  const files = form.getAll("files").filter((value): value is File => value instanceof File);
  try { return apiData(await createGallery(parsed.data, files, await getCurrentUserContext()), 201); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, message, "Please sign in.");
    if (message === "FORBIDDEN") return apiError(403, message, "You cannot manage this gallery.");
    if (message === "SCHOOL_SCOPE_REQUIRED") return apiError(422, message, "Choose a school assigned to your administrator account.");
    if (message === "FILES_REQUIRED" || message === "INVALID_FILE" || message === "TOO_MANY_FILES") return apiError(422, message, "Add up to 30 image files, each smaller than 10 MB.");
    if (message === "STORAGE_NOT_CONFIGURED") return apiError(503, message, "Gallery storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment and restart the app.");
    if (message === "FILE_UPLOAD_FAILED") return apiError(502, message, "The image could not be uploaded to gallery storage. Check that the gallery bucket exists in Supabase.");
    return apiError(500, "GALLERY_CREATE_FAILED", "Gallery could not be created.");
  }
}
