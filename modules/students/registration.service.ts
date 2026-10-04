import { prisma } from "@/lib/db/prisma";
import type {
  ApproveRegistrationRequestInput,
  CreateRegistrationRequestInput,
} from "./registration.schemas";

type UserContext = Awaited<ReturnType<typeof import("@/lib/auth/current-user").getCurrentUserContext>>;

export async function createRegistrationRequest(
  authUser: { id: string; email?: string },
  input: CreateRegistrationRequestInput,
) {
  const existing = await prisma.registrationRequest.findFirst({
    where: { authUserId: authUser.id, status: "PENDING" },
  });
  if (existing) throw new Error("REQUEST_EXISTS");

  return prisma.registrationRequest.create({
    data: {
      authUserId: authUser.id,
      email: authUser.email ?? "",
      ...input,
    },
    select: { id: true, status: true, createdAt: true },
  });
}

export async function listRegistrationRequests(context: UserContext) {
  if (!context.roles.includes("SCHOOL_ADMIN") && !context.roles.includes("CENTRAL_ADMIN")) {
    throw new Error("FORBIDDEN");
  }
  if (context.workspace.mode === "SCHOOL_ADMIN" && !context.schoolIds.includes(context.workspace.schoolId)) {
    throw new Error("FORBIDDEN");
  }
  if (context.workspace.mode === "CENTRAL_ADMIN" && !context.roles.includes("CENTRAL_ADMIN")) {
    throw new Error("FORBIDDEN");
  }
  return prisma.registrationRequest.findMany({
    where: {
      status: "PENDING",
      ...(context.workspace.mode === "CENTRAL_ADMIN"
        ? {}
        : { schoolCode: await getSchoolCode(context.workspace.schoolId) }),
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      schoolCode: true,
      academicYearName: true,
      admissionNumber: true,
      classLevel: true,
      streamId: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

async function getSchoolCode(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { schoolCode: true },
  });
  if (!school) throw new Error("FORBIDDEN");
  return school.schoolCode;
}

export async function approveRegistrationRequest(
  requestId: string,
  input: ApproveRegistrationRequestInput,
  context: UserContext,
) {
  if (!context.roles.includes("SCHOOL_ADMIN") && !context.roles.includes("CENTRAL_ADMIN")) {
    throw new Error("FORBIDDEN");
  }
  if (context.workspace.mode === "CENTRAL_ADMIN" && !context.roles.includes("CENTRAL_ADMIN")) {
    throw new Error("FORBIDDEN");
  }
  if (context.workspace.mode === "SCHOOL_ADMIN" && !context.schoolIds.includes(context.workspace.schoolId)) {
    throw new Error("FORBIDDEN");
  }
  const request = await prisma.registrationRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING") throw new Error("NOT_FOUND");

  const schoolCode = context.workspace.mode === "SCHOOL_ADMIN"
    ? await getSchoolCode(context.workspace.schoolId)
    : input.schoolCode;
  if (context.workspace.mode === "SCHOOL_ADMIN" && request.schoolCode !== schoolCode) {
    throw new Error("FORBIDDEN");
  }
  const school = await prisma.school.findUnique({ where: { schoolCode } });
  const year = await prisma.academicYear.findUnique({ where: { name: input.academicYearName } });
  const role = await prisma.role.findUnique({ where: { name: "STUDENT" } });
  if (!school) throw new Error("SCHOOL_NOT_FOUND");
  if (!year) throw new Error("ACADEMIC_YEAR_NOT_FOUND");
  if (!role) throw new Error("STUDENT_ROLE_NOT_CONFIGURED");
  if (context.workspace.mode === "SCHOOL_ADMIN" && school.id !== context.workspace.schoolId) {
    throw new Error("FORBIDDEN");
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { id: request.authUserId },
      create: { id: request.authUserId, email: request.email, username: request.fullName, status: "ACTIVE" },
      update: { email: request.email, username: request.fullName, status: "ACTIVE" },
    });
    const profile = await tx.studentProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });
    try {
      await tx.studentEnrollment.create({
        data: {
          studentId: profile.id,
          schoolId: school.id,
          academicYearId: year.id,
          admissionNumber: input.admissionNumber,
          classLevel: input.classLevel,
          streamId: input.streamId,
          status: "ACTIVE",
        },
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new Error("DUPLICATE_ENROLLMENT");
      }
      throw error;
    }
    return tx.registrationRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", reviewedById: context.id, reviewedAt: new Date() },
      select: { id: true, status: true },
    });
  });
  return result;
}
