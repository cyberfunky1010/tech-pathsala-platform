import { NextRequest } from "next/server";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { uploadLearningMaterialFile } from "@/modules/learning-material/material.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  if (!hasDatabaseConfig()) {
    return apiError(503, "DATABASE_NOT_CONFIGURED", "File uploads are not connected yet.");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError(400, "INVALID_MULTIPART_FORM", "Upload a file using multipart form data.");
  }

  const value = formData.get("file");
  if (!(value instanceof File)) {
    return apiError(422, "FILE_REQUIRED", "Choose a file to upload.");
  }

  try {
    const context = await getCurrentUserContext();
    const file = await uploadLearningMaterialFile((await params).id, value, context);
    return apiData(
      { ...file, createdAt: file.createdAt.toISOString() },
      201,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "STORAGE_NOT_CONFIGURED") {
      return apiError(503, "STORAGE_NOT_CONFIGURED", "File storage is not configured yet.");
    }
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return apiError(401, "UNAUTHENTICATED", "Please sign in to upload a file.");
    }
    if (error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED") {
      return apiError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured yet.");
    }
    if (error instanceof Error && error.message === "USER_NOT_PROVISIONED") {
      return apiError(403, "USER_NOT_PROVISIONED", "Your account is not connected to a PathSala profile.");
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return apiError(404, "NOT_FOUND", "Learning material was not found.");
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return apiError(403, "FORBIDDEN", "You do not have permission to upload to this material.");
    }
    if (error instanceof Error && error.message === "FILE_TOO_LARGE") {
      return apiError(413, "FILE_TOO_LARGE", "Files must be smaller than 10 MB.");
    }
    if (error instanceof Error && error.message === "FILE_UPLOAD_FAILED") {
      return apiError(502, "FILE_UPLOAD_FAILED", "The file could not be uploaded.");
    }
    return apiError(500, "FILE_METADATA_SAVE_FAILED", "The uploaded file could not be saved.");
  }
}
