import { NextRequest } from "next/server";
import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDatabaseConfig()) {
    return apiError(503, "DATABASE_NOT_CONFIGURED", "Subjects are not connected yet.");
  }

  try {
    const subjects = await prisma.subject.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
    return apiData(subjects);
  } catch {
    return apiError(500, "SUBJECTS_READ_FAILED", "Subjects could not be loaded.");
  }
}

const createSubjectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),
});

export async function POST(request: NextRequest) {
  if (!hasDatabaseConfig()) {
    return apiError(503, "DATABASE_NOT_CONFIGURED", "Subjects are not connected yet.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = createSubjectSchema.safeParse(body);
  if (!result.success) {
    return apiError(422, "VALIDATION_ERROR", "Enter a subject name and an alphanumeric subject code.", result.error.flatten());
  }

  try {
    const context = await getCurrentUserContext();
    if (!context.roles.includes("SCHOOL_ADMIN") && !context.roles.includes("CENTRAL_ADMIN")) {
      return apiError(403, "FORBIDDEN", "Only administrators can create subjects.");
    }

    const subject = await prisma.subject.create({
      data: {
        name: result.data.name,
        code: result.data.code.toUpperCase(),
        status: "PUBLISHED",
      },
      select: { id: true, name: true, code: true },
    });
    return apiData(subject, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    }
    if (error instanceof Error && error.message === "USER_NOT_PROVISIONED") {
      return apiError(403, "USER_NOT_PROVISIONED", "Your account is not connected to a PathSala profile.");
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return apiError(409, "SUBJECT_ALREADY_EXISTS", "A subject with this code already exists.");
    }
    return apiError(500, "SUBJECT_CREATE_FAILED", "The subject could not be created.");
  }
}
