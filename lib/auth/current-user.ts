import { createSupabaseServerClient } from "./supabase-server";
import { prisma } from "@/lib/db/prisma";
import { getRequestedWorkspace, resolveWorkspace } from "./workspace";

export async function getCurrentUserContext() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("UNAUTHENTICATED");
  }

  const user = await prisma.user.findUnique({
    where: { id: data.user.id },
    include: {
      roles: { include: { role: true } },
      adminAssignments: { where: { endedAt: null } },
      studentProfile: {
        include: { enrollments: { where: { status: "ACTIVE" }, include: { academicYear: true } } },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new Error("USER_NOT_PROVISIONED");
  }

  const roles = user.roles.map(({ role }) => role.name);
  const schoolIds = [
    ...user.adminAssignments.map((assignment) => assignment.schoolId),
    ...(user.studentProfile?.enrollments.map((enrollment) => enrollment.schoolId) ?? []),
  ];

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    roles,
    schoolIds,
    workspace: resolveWorkspace(roles, schoolIds, await getRequestedWorkspace()),
    adminAssignments: user.adminAssignments.map((assignment) => ({
      schoolId: assignment.schoolId,
      status: assignment.status,
    })),
    studentProfile: user.studentProfile,
  };
}
