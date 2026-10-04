import { NextRequest } from "next/server";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { updateLearningMaterialSchema } from "@/modules/learning-material/material.schemas";
import {
  deleteLearningMaterial,
  getLearningMaterial,
  updateLearningMaterial,
} from "@/modules/learning-material/material.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown, action: "read" | "update" | "delete") {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
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
    return apiError(403, "FORBIDDEN", "You do not have permission to manage this material.");
  }
  if (error instanceof Error && error.message === "SCOPE_IMMUTABLE") {
    return apiError(422, "SCOPE_IMMUTABLE", "Learning material scope cannot be changed.");
  }
  return apiError(500, `LEARNING_MATERIAL_${action.toUpperCase()}_FAILED`, `Learning material could not be ${action === "read" ? "loaded" : `${action}d`}.`);
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  if (!hasDatabaseConfig()) {
    return apiError(503, "DATABASE_NOT_CONFIGURED", "Learning material is not connected yet.");
  }

  try {
    const context = await getCurrentUserContext();
    return apiData(await getLearningMaterial((await params).id, context));
  } catch (error) {
    return errorResponse(error, "read");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = updateLearningMaterialSchema.safeParse(body);
  if (!result.success) {
    return apiError(422, "VALIDATION_ERROR", "Please correct the learning material fields.", result.error.flatten());
  }
  if (!hasDatabaseConfig()) {
    return apiError(503, "DATABASE_NOT_CONFIGURED", "Learning material cannot be updated yet.");
  }

  try {
    const context = await getCurrentUserContext();
    return apiData(await updateLearningMaterial((await params).id, result.data, context));
  } catch (error) {
    return errorResponse(error, "update");
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!hasDatabaseConfig()) {
    return apiError(503, "DATABASE_NOT_CONFIGURED", "Learning material cannot be deleted yet.");
  }

  try {
    const context = await getCurrentUserContext();
    await deleteLearningMaterial((await params).id, context);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, "delete");
  }
}
