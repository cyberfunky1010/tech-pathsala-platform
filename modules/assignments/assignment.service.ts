import { prisma } from "@/lib/db/prisma";
import type { CreateAssignmentInput } from "./assignment.schemas";
import { randomUUID } from "node:crypto";
import { ASSIGNMENT_BUCKET, getSupabaseAdminClient } from "@/lib/storage/supabase-admin";

type UserContext = Awaited<ReturnType<typeof import("@/lib/auth/current-user").getCurrentUserContext>>;

function visibleScope(context: UserContext) {
  return [
    { scope: "GLOBAL" as const },
    ...(context.schoolIds.length
      ? [{ scope: "SCHOOL" as const, schoolId: { in: [...new Set(context.schoolIds)] } }]
      : []),
  ];
}

function canCreate(scope: CreateAssignmentInput["scope"], context: UserContext) {
  return scope === "GLOBAL"
    ? context.roles.includes("CENTRAL_ADMIN")
    : context.roles.includes("CENTRAL_ADMIN") || context.roles.includes("SCHOOL_ADMIN");
}

export async function listAssignments(
  context: UserContext,
  filters: { classLevel?: number; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" },
) {
  const studentEnrollment = context.studentProfile?.enrollments[0];
  const isStudent = context.roles.includes("STUDENT") && Boolean(studentEnrollment);
  const assignments = await prisma.assignment.findMany({
    where: {
      AND: [
        { OR: visibleScope(context) },
        ...(isStudent
          ? [{
              status: "PUBLISHED" as const,
              classLevel: studentEnrollment?.classLevel,
              OR: [
                { streams: { none: {} } },
                ...(studentEnrollment?.streamId
                  ? [{ streams: { some: { streamId: studentEnrollment.streamId } } }]
                  : []),
              ],
            }]
          : [{
              ...(filters.classLevel ? { classLevel: filters.classLevel } : {}),
              ...(filters.status ? { status: filters.status } : {}),
            }]),
      ],
    },
    include: {
      subject: { select: { name: true } },
      _count: { select: { files: true, submissions: true } },
      submissions: isStudent && studentEnrollment?.studentId
        ? {
            where: { studentId: studentEnrollment.studentId },
            select: { status: true, submittedAt: true, isLate: true, marks: true },
          }
        : true,
    },
    orderBy: { dueAt: "asc" },
  });

  return assignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    subjectId: assignment.subjectId,
    subjectName: assignment.subject.name,
    classLevel: assignment.classLevel,
    scope: assignment.scope,
    schoolId: assignment.schoolId,
    dueAt: assignment.dueAt.toISOString(),
    status: assignment.status,
    fileCount: assignment._count.files,
    submissionCount: assignment._count.submissions,
    submission: "submissions" in assignment ? assignment.submissions[0] ?? null : null,
  }));
}

export async function submitAssignment(
  assignmentId: string,
  context: UserContext,
) {
  const student = context.studentProfile;
  const enrollment = student?.enrollments[0];
  if (!context.roles.includes("STUDENT") || !student || !enrollment) throw new Error("FORBIDDEN");

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      status: "PUBLISHED",
      AND: [
        { OR: visibleScope(context) },
        {
          classLevel: enrollment.classLevel,
          OR: [
            { streams: { none: {} } },
            ...(enrollment.streamId ? [{ streams: { some: { streamId: enrollment.streamId } } }] : []),
          ],
        },
      ],
      classLevel: enrollment.classLevel,
    },
    select: { id: true, dueAt: true },
  });
  if (!assignment) throw new Error("NOT_FOUND");

  const submittedAt = new Date();
  const isLate = submittedAt > assignment.dueAt;
  return prisma.assignmentSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
    create: {
      assignmentId,
      studentId: student.id,
      submittedAt,
      isLate,
      status: "SUBMITTED",
    },
    update: {
      submittedAt,
      isLate,
      status: "SUBMITTED",
    },
    select: { id: true, submittedAt: true, isLate: true, status: true },
  });
}

export async function uploadSubmissionFile(
  assignmentId: string,
  file: File,
  context: UserContext,
) {
  const student = context.studentProfile;
  if (!context.roles.includes("STUDENT") || !student) throw new Error("FORBIDDEN");
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
    select: { id: true },
  });
  if (!submission) throw new Error("SUBMISSION_REQUIRED");

  const safeName = file.name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "upload";
  const storagePath = `submissions/${submission.id}/${randomUUID()}-${safeName}`;
  const storage = getSupabaseAdminClient().storage.from(ASSIGNMENT_BUCKET);
  const upload = await storage.upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upload.error) throw new Error("FILE_UPLOAD_FAILED");

  try {
    return await prisma.submissionFile.create({
      data: {
        submissionId: submission.id,
        storagePath,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      },
      select: { id: true, originalName: true, mimeType: true, fileSize: true },
    });
  } catch (error) {
    await storage.remove([storagePath]);
    throw error;
  }
}

export async function evaluateSubmission(
  submissionId: string,
  input: { marks: number; maxMarks: number; feedback?: string },
  context: UserContext,
) {
  if (!context.roles.includes("SCHOOL_ADMIN") && !context.roles.includes("CENTRAL_ADMIN")) {
    throw new Error("FORBIDDEN");
  }
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: { select: { scope: true, schoolId: true } } },
  });
  if (!submission) throw new Error("NOT_FOUND");
  if (submission.assignment.scope === "SCHOOL" && !context.schoolIds.includes(submission.assignment.schoolId ?? "")) {
    throw new Error("FORBIDDEN");
  }
  if (input.marks < 0 || input.marks > input.maxMarks || input.maxMarks <= 0) {
    throw new Error("INVALID_MARKS");
  }
  return prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      marks: input.marks,
      maxMarks: input.maxMarks,
      feedback: input.feedback,
      evaluatedById: context.id,
      evaluatedAt: new Date(),
      status: "EVALUATED",
    },
    select: { id: true, marks: true, maxMarks: true, feedback: true, evaluatedAt: true, status: true },
  });
}

export async function listAssignmentSubmissions(
  assignmentId: string,
  context: UserContext,
) {
  if (!context.roles.includes("SCHOOL_ADMIN") && !context.roles.includes("CENTRAL_ADMIN")) {
    throw new Error("FORBIDDEN");
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      OR: [
        { scope: "GLOBAL" },
        ...(context.schoolIds.length
          ? [{ scope: "SCHOOL" as const, schoolId: { in: [...new Set(context.schoolIds)] } }]
          : []),
      ],
    },
    select: { id: true },
  });
  if (!assignment) throw new Error("NOT_FOUND");

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      isLate: true,
      marks: true,
      maxMarks: true,
      feedback: true,
      student: {
        select: {
          id: true,
          user: { select: { email: true, username: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            select: { classLevel: true, admissionNumber: true },
          },
        },
      },
      files: {
        select: { id: true, originalName: true, mimeType: true, fileSize: true },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return submissions.map((submission) => ({
    id: submission.id,
    status: submission.status,
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    isLate: submission.isLate,
    marks: submission.marks,
    maxMarks: submission.maxMarks,
    feedback: submission.feedback,
    student: {
      id: submission.student.id,
      email: submission.student.user.email,
      username: submission.student.user.username,
      enrollment: submission.student.enrollments[0] ?? null,
    },
    files: submission.files,
  }));
}

export async function createSubmissionFileDownloadUrl(
  fileId: string,
  context: UserContext,
) {
  const file = await prisma.submissionFile.findUnique({
    where: { id: fileId },
    select: {
      storagePath: true,
      submission: {
        select: {
          studentId: true,
          assignment: { select: { scope: true, schoolId: true } },
        },
      },
    },
  });

  if (!file) throw new Error("NOT_FOUND");
  const canReadAsStudent =
    context.roles.includes("STUDENT") &&
    file.submission.studentId === context.studentProfile?.id;
  const canReadAsAdmin =
    (context.roles.includes("CENTRAL_ADMIN") ||
      context.roles.includes("SCHOOL_ADMIN")) &&
    (file.submission.assignment.scope === "GLOBAL" ||
      context.schoolIds.includes(file.submission.assignment.schoolId ?? ""));

  if (!canReadAsStudent && !canReadAsAdmin) throw new Error("FORBIDDEN");

  const { data, error } = await getSupabaseAdminClient()
    .storage
    .from(ASSIGNMENT_BUCKET)
    .createSignedUrl(file.storagePath, 300);
  if (error || !data?.signedUrl) throw new Error("FILE_URL_FAILED");
  return data.signedUrl;
}

export async function createAssignment(input: CreateAssignmentInput, context: UserContext) {
  if (!canCreate(input.scope, context)) throw new Error("FORBIDDEN");
  const schoolId = input.scope === "SCHOOL" ? context.schoolIds[0] : null;
  if (input.scope === "SCHOOL" && !schoolId) throw new Error("SCHOOL_SCOPE_REQUIRED");

  const assignment = await prisma.assignment.create({
    data: {
      title: input.title,
      description: input.description,
      subjectId: input.subjectId,
      classLevel: input.classLevel,
      scope: input.scope,
      schoolId,
      dueAt: new Date(input.dueAt),
      status: input.status,
      createdById: context.id,
      streams: input.streamIds.length
        ? { create: input.streamIds.map((streamId) => ({ streamId })) }
        : undefined,
    },
    include: { subject: { select: { name: true } }, _count: { select: { files: true, submissions: true } } },
  });

  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    subjectId: assignment.subjectId,
    subjectName: assignment.subject.name,
    classLevel: assignment.classLevel,
    scope: assignment.scope,
    schoolId: assignment.schoolId,
    dueAt: assignment.dueAt.toISOString(),
    status: assignment.status,
    fileCount: assignment._count.files,
    submissionCount: assignment._count.submissions,
  };
}
