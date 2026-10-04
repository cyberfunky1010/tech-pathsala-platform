import { prisma } from "@/lib/db/prisma";
import { getSupabaseAdminClient } from "@/lib/storage/supabase-admin";
import type { CreateAdminInput, UpdateAdminAssignmentInput } from "./admin.schemas";

type UserContext = Awaited<ReturnType<typeof import("@/lib/auth/current-user").getCurrentUserContext>>;

function requireCentralWorkspace(context: UserContext) {
  if (!context.roles.includes("CENTRAL_ADMIN") || context.workspace.mode !== "CENTRAL_ADMIN") {
    throw new Error("FORBIDDEN");
  }
}

export async function listAdminManagementData(context: UserContext) {
  requireCentralWorkspace(context);
  const [schools, admins] = await Promise.all([
    prisma.school.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, schoolCode: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: { name: { in: ["CENTRAL_ADMIN", "SCHOOL_ADMIN"] } } } } },
      select: {
        id: true,
        email: true,
        status: true,
        roles: { select: { role: { select: { name: true } } } },
        adminAssignments: {
          select: { id: true, status: true, startedAt: true, endedAt: true, school: { select: { id: true, name: true, schoolCode: true } } },
        },
      },
      orderBy: { email: "asc" },
    }),
  ]);

  return {
    schools,
    admins: admins.map((admin) => ({
      id: admin.id,
      email: admin.email,
      status: admin.status,
      roles: admin.roles.map(({ role }) => role.name),
      assignments: admin.adminAssignments,
    })),
  };
}

export async function updateAdminAssignment(
  adminId: string,
  input: UpdateAdminAssignmentInput,
  context: UserContext,
) {
  requireCentralWorkspace(context);
  const assignment = await prisma.schoolAdminAssignment.findUnique({
    where: { id: input.assignmentId },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });
  if (!assignment || assignment.userId !== adminId || assignment.endedAt) throw new Error("NOT_FOUND");
  const isCentralAdmin = assignment.user.roles.some(({ role }) => role.name === "CENTRAL_ADMIN");
  if (input.action === "END" && isCentralAdmin) throw new Error("CENTRAL_ADMIN_REQUIRES_SCHOOL");

  if (input.action === "REASSIGN") {
    const school = await prisma.school.findFirst({ where: { id: input.schoolId, status: "ACTIVE" } });
    if (!school) throw new Error("REFERENCE_NOT_FOUND");
    const activeAssignment = await prisma.schoolAdminAssignment.findFirst({
      where: { userId: adminId, endedAt: null, id: { not: assignment.id } },
    });
    if (activeAssignment) throw new Error("ACTIVE_ASSIGNMENT_EXISTS");
    return prisma.$transaction(async (tx) => {
      const endedAt = new Date();
      await tx.schoolAdminAssignment.update({
        where: { id: assignment.id },
        data: { endedAt, status: "ENDED" },
      });
      return tx.schoolAdminAssignment.create({
        data: { userId: adminId, schoolId: school.id, status: "ACTIVE" },
        select: { id: true, school: { select: { id: true, name: true, schoolCode: true } } },
      });
    });
  }

  return prisma.schoolAdminAssignment.update({
    where: { id: assignment.id },
    data: { endedAt: new Date(), status: "ENDED" },
    select: { id: true },
  });
}

export async function inviteAdmin(input: CreateAdminInput, context: UserContext) {
  requireCentralWorkspace(context);
  const school = await prisma.school.findUnique({ where: { id: input.schoolId } });
  const roles = await prisma.role.findMany({
    where: { name: { in: input.role === "CENTRAL_ADMIN" ? ["CENTRAL_ADMIN", "SCHOOL_ADMIN"] : ["SCHOOL_ADMIN"] } },
  });
  if (!school || roles.length !== (input.role === "CENTRAL_ADMIN" ? 2 : 1)) throw new Error("REFERENCE_NOT_FOUND");

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    include: { roles: { include: { role: true } }, adminAssignments: { where: { endedAt: null } } },
  });
  if (existing?.roles.some(({ role: assignedRole }) => assignedRole.name === input.role)) {
    throw new Error("ALREADY_ASSIGNED");
  }
  if (input.role === "CENTRAL_ADMIN" && existing?.adminAssignments.length) {
    throw new Error("CENTRAL_ADMIN_SCHOOL_EXISTS");
  }

  const { data, error } = await getSupabaseAdminClient().auth.admin.inviteUserByEmail(input.email);
  if (error) throw new Error("INVITE_FAILED");
  const userId = data.user?.id;
  if (!userId) throw new Error("INVITE_FAILED");

  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: userId },
      create: { id: userId, email: input.email, status: "ACTIVE" },
      update: { email: input.email, status: "ACTIVE" },
    });
    for (const role of roles) {
      await tx.userRole.create({ data: { userId, roleId: role.id } });
    }
    await tx.schoolAdminAssignment.create({
      data: {
        userId,
        schoolId: school.id,
        status: "ACTIVE",
      },
    });
  });

  return { email: input.email, role: input.role, school: { id: school.id, name: school.name } };
}
