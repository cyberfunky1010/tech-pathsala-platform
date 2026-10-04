import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { createLearningMaterialFileDownloadUrl } from "@/modules/learning-material/material.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  if (!hasDatabaseConfig()) {
    return apiError(503, "DATABASE_NOT_CONFIGURED", "File downloads are not connected yet.");
  }

  try {
    const { id, fileId } = await params;
    const url = await createLearningMaterialFileDownloadUrl(
      id,
      fileId,
      await getCurrentUserContext(),
    );
    return apiData({ url, expiresInSeconds: 300 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return apiError(401, message, "Please sign in to download this file.");
    if (message === "USER_NOT_PROVISIONED" || message === "FORBIDDEN") return apiError(403, message, "You do not have permission to download this file.");
    if (message === "NOT_FOUND") return apiError(404, message, "File was not found.");
    if (message === "STORAGE_NOT_CONFIGURED") return apiError(503, message, "File storage is not configured yet.");
    return apiError(502, "FILE_URL_FAILED", "A secure download link could not be created.");
  }
}
