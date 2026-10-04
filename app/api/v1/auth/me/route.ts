import { apiData, apiError } from "@/lib/api/response";
import { hasDatabaseConfig } from "@/lib/config";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDatabaseConfig()) {
    return apiError(503, "DATABASE_NOT_CONFIGURED", "Account details are not connected yet.");
  }

  try {
    const context = await getCurrentUserContext();
    const enrollment = context.studentProfile?.enrollments[0] ?? null;
    const enrolledSchool = enrollment
      ? await prisma.school.findUnique({
          where: { id: enrollment.schoolId },
          select: { name: true },
        })
      : null;
    const assignedSchools = context.adminAssignments.length
      ? await prisma.school.findMany({
          where: { id: { in: context.adminAssignments.map((assignment) => assignment.schoolId) } },
          select: { id: true, schoolCode: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];
    return apiData({
      id: context.id,
      email: context.email,
      username: context.username,
      roles: context.roles,
      workspace: context.workspace,
      workspaces: [
        ...(context.roles.includes("CENTRAL_ADMIN")
          ? [{ mode: "CENTRAL_ADMIN", label: "Central Admin" }]
          : []),
        ...(context.roles.includes("SCHOOL_ADMIN")
          ? assignedSchools.map((school) => ({
              mode: "SCHOOL_ADMIN",
              schoolId: school.id,
              label: `School Admin · ${school.name}`,
            }))
          : []),
      ],
      accountType: context.roles.includes("CENTRAL_ADMIN")
        ? "Central Admin"
        : context.roles.includes("SCHOOL_ADMIN")
          ? "School Admin"
          : context.roles.includes("STUDENT")
            ? "Student"
            : "No role assigned",
      student: enrollment
        ? {
              name: context.username,
              classLevel: enrollment.classLevel,
              admissionNumber: enrollment.admissionNumber,
              academicYear: enrollment.academicYear.name,
              schoolId: enrollment.schoolId,
            schoolName: enrolledSchool?.name ?? null,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return apiError(401, "UNAUTHENTICATED", "Please sign in to view your account.");
    }
    if (error instanceof Error && error.message === "USER_NOT_PROVISIONED") {
      return apiError(403, "USER_NOT_PROVISIONED", "Your account has not been provisioned in PathSala yet.");
    }
    if (error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED") {
      return apiError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured yet.");
    }
    return apiError(500, "ACCOUNT_READ_FAILED", "Account details could not be loaded.");
  }
}
