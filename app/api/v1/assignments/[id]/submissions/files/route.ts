import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { uploadSubmissionFile } from "@/modules/assignments/assignment.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabaseConfig()) return apiError(503, "DATABASE_NOT_CONFIGURED", "Submission uploads are not connected yet.");
  let formData: FormData;
  try { formData = await request.formData(); } catch { return apiError(400, "INVALID_MULTIPART_FORM", "Upload a file using multipart form data."); }
  const value = formData.get("file");
  if (!(value instanceof File)) return apiError(422, "FILE_REQUIRED", "Choose a file to upload.");
  try {
    const file = await uploadSubmissionFile((await params).id, value, await getCurrentUserContext());
    return apiData(file, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, "UNAUTHENTICATED", "Please sign in to upload.");
    if (message === "USER_NOT_PROVISIONED" || message === "FORBIDDEN") return apiError(403, message, "You do not have permission to upload this file.");
    if (message === "STORAGE_NOT_CONFIGURED") return apiError(503, message, "File storage is not configured yet.");
    if (message === "SUBMISSION_REQUIRED") return apiError(409, message, "Submit the assignment before uploading your work.");
    if (message === "FILE_TOO_LARGE") return apiError(413, message, "Files must be smaller than 10 MB.");
    if (message === "FILE_UPLOAD_FAILED") return apiError(502, message, "The file could not be uploaded.");
    return apiError(500, "FILE_METADATA_SAVE_FAILED", "The uploaded file could not be saved.");
  }
}
