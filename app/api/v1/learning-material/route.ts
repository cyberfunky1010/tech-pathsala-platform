import { NextRequest } from "next/server";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  createLearningMaterialSchema,
  learningMaterialQuerySchema,
} from "@/modules/learning-material/material.schemas";
import {
  createLearningMaterial,
  listLearningMaterial,
} from "@/modules/learning-material/material.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const queryResult = learningMaterialQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!queryResult.success) {
    return apiError(400, "INVALID_QUERY", "Please check the learning material filters.", queryResult.error.flatten());
  }

  if (!hasDatabaseConfig()) {
    return apiError(
      503,
      "DATABASE_NOT_CONFIGURED",
      "Learning material is not connected yet. Add DATABASE_URL before using this endpoint.",
    );
  }

  try {
    const context = await getCurrentUserContext();
    const materials = await listLearningMaterial(context, queryResult.data);
    return apiData(materials);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return apiError(401, "UNAUTHENTICATED", "Please sign in to view learning material.");
    }
    if (error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED") {
      return apiError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured yet.");
    }
    if (error instanceof Error && error.message === "USER_NOT_PROVISIONED") {
      return apiError(403, "USER_NOT_PROVISIONED", "Your account is not connected to a PathSala profile.");
    }
    if (error instanceof Error && error.message === "LEARNING_MATERIAL_DATABASE_NOT_CONFIGURED") {
      return apiError(503, "DATABASE_NOT_CONFIGURED", "Learning material storage is not configured.");
    }
    return apiError(500, "LEARNING_MATERIAL_READ_FAILED", "Learning material could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = createLearningMaterialSchema.safeParse(body);
  if (!result.success) {
    return apiError(422, "VALIDATION_ERROR", "Please correct the learning material fields.", result.error.flatten());
  }

  if (result.data.scope === "SCHOOL" && "schoolId" in (body as Record<string, unknown>)) {
    return apiError(400, "SCHOOL_SCOPE_MUST_BE_DERIVED", "School scope is derived from the authenticated user.");
  }

  if (!hasDatabaseConfig()) {
    return apiError(
      503,
      "DATABASE_NOT_CONFIGURED",
      "Learning material cannot be saved yet. Add DATABASE_URL before using this endpoint.",
    );
  }

  try {
    const context = await getCurrentUserContext();
    const material = await createLearningMaterial(result.data, context);
    return apiData(material, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return apiError(401, "UNAUTHENTICATED", "Please sign in to create learning material.");
    }
    if (error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED") {
      return apiError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured yet.");
    }
    if (error instanceof Error && error.message === "USER_NOT_PROVISIONED") {
      return apiError(403, "USER_NOT_PROVISIONED", "Your account is not connected to a PathSala profile.");
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return apiError(403, "FORBIDDEN", "You do not have permission to create this material.");
    }
    if (error instanceof Error && error.message === "SCHOOL_SCOPE_REQUIRED") {
      return apiError(403, "SCHOOL_SCOPE_REQUIRED", "Your account is not assigned to a school.");
    }
    if (error instanceof Error && error.message === "LEARNING_MATERIAL_DATABASE_NOT_CONFIGURED") {
      return apiError(503, "DATABASE_NOT_CONFIGURED", "Learning material storage is not configured.");
    }
    return apiError(500, "LEARNING_MATERIAL_CREATE_FAILED", "Learning material could not be saved.");
  }
}
