import { prisma } from "@/lib/db/prisma";
import type { CreateTestInput, UpdateTestInput } from "./test.schemas";

type UserContext = Awaited<ReturnType<typeof import("@/lib/auth/current-user").getCurrentUserContext>>;

function canManage(context: UserContext) {
  return context.roles.includes("SCHOOL_ADMIN") || context.roles.includes("CENTRAL_ADMIN");
}

function visibleScopes(context: UserContext) {
  if (context.workspace.mode === "SCHOOL_ADMIN") {
    return [
      { scope: "GLOBAL" as const },
      { scope: "SCHOOL" as const, schoolId: context.workspace.schoolId },
    ];
  }
  return [{ scope: "GLOBAL" as const, createdById: context.id }];
}

function visibleTestWhere(context: UserContext) {
  return { OR: visibleScopes(context) };
}

export async function listTests(
  context: UserContext,
  filters: { classLevel?: number; status?: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED" | "ARCHIVED" },
) {
  if (!canManage(context)) throw new Error("FORBIDDEN");
  const now = new Date();
  await prisma.test.updateMany({
    where: {
      endsAt: { lte: now },
      status: { in: ["SCHEDULED", "LIVE"] },
    },
    data: { status: "ENDED" },
  });
  const tests = await prisma.test.findMany({
    where: {
      AND: [
        { OR: visibleScopes(context) },
        { status: { notIn: ["ENDED", "ARCHIVED"] } },
        ...(filters.classLevel ? [{ classLevel: filters.classLevel }] : []),
        ...(filters.status ? [{ status: filters.status }] : []),
      ],
    },
    include: { subject: { select: { name: true } }, school: { select: { name: true } }, _count: { select: { questions: true } } },
    orderBy: { startsAt: "desc" },
  });
  return tests.map((test) => ({
    id: test.id, title: test.title, description: test.description, subjectId: test.subjectId,
    subjectName: test.subject.name, classLevel: test.classLevel, scope: test.scope, schoolId: test.schoolId,
    schoolName: test.school?.name ?? null, durationSeconds: test.durationSeconds,
    startsAt: test.startsAt.toISOString(), endsAt: test.endsAt.toISOString(), status: test.status,
    randomizeQuestions: test.randomizeQuestions, randomizeOptions: test.randomizeOptions,
    questionCount: test.questionCount, createdQuestionCount: test._count.questions,
  }));
}

export async function createTest(input: CreateTestInput, context: UserContext) {
  if (!canManage(context)) throw new Error("FORBIDDEN");
  if (input.status === "LIVE") throw new Error("QUESTIONS_REQUIRED");
  let schoolId: string | null = null;
  if (context.workspace.mode === "SCHOOL_ADMIN") {
    if (input.scope !== "SCHOOL") throw new Error("SCHOOL_SCOPE_REQUIRED");
    schoolId = context.workspace.schoolId;
    if (!context.schoolIds.includes(schoolId)) throw new Error("FORBIDDEN");
  } else {
    if (input.scope === "SCHOOL") {
      if (!input.schoolId || !context.schoolIds.includes(input.schoolId)) throw new Error("INVALID_SCHOOL");
      schoolId = input.schoolId;
    }
  }
  const subject = await prisma.subject.findFirst({ where: { id: input.subjectId, status: "PUBLISHED" }, select: { id: true } });
  if (!subject) throw new Error("SUBJECT_NOT_FOUND");
  return prisma.test.create({
    data: {
      title: input.title, description: input.description || null, subjectId: input.subjectId,
      classLevel: input.classLevel, scope: input.scope, schoolId, durationSeconds: input.durationSeconds,
      startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), status: input.status,
      randomizeQuestions: input.randomizeQuestions, randomizeOptions: input.randomizeOptions,
      questionCount: input.questionCount, createdById: context.id,
    },
    select: { id: true, title: true, scope: true, schoolId: true, status: true, startsAt: true, endsAt: true },
  });
}

export async function deleteTest(testId: string, context: UserContext) {
  if (!canManage(context)) throw new Error("FORBIDDEN");
  const test = await prisma.test.findFirst({
    where: { id: testId, createdById: context.id, ...visibleTestWhere(context) },
    select: { id: true },
  });
  if (!test) throw new Error("NOT_FOUND");
  const attemptCount = await prisma.testAttempt.count({ where: { testId: test.id } });
  if (attemptCount > 0) {
    await prisma.test.update({ where: { id: test.id }, data: { status: "ARCHIVED" } });
    return { archived: true };
  }
  await prisma.test.delete({ where: { id: test.id } });
  return { archived: false };
}

export async function updateTest(testId: string, input: UpdateTestInput, context: UserContext) {
  if (!canManage(context)) throw new Error("FORBIDDEN");
  const test = await prisma.test.findFirst({
    where: { id: testId, createdById: context.id, ...visibleTestWhere(context) },
    select: { id: true },
  });
  if (!test) throw new Error("NOT_FOUND");
  if (input.status === "LIVE") {
    const questionCount = await prisma.question.count({ where: { testId: test.id } });
    if (questionCount === 0) throw new Error("QUESTIONS_REQUIRED");
  }
  return prisma.test.update({
    where: { id: test.id },
    data: { status: input.status },
    select: { id: true, status: true },
  });
}

function studentEnrollment(context: UserContext) {
  if (!context.roles.includes("STUDENT")) throw new Error("FORBIDDEN");
  const enrollment = context.studentProfile?.enrollments[0];
  if (!context.studentProfile || !enrollment) throw new Error("FORBIDDEN");
  return { student: context.studentProfile, enrollment };
}

function availableTestWhere(testId: string | undefined, context: UserContext, now: Date) {
  const { enrollment } = studentEnrollment(context);
  return {
    ...(testId ? { id: testId } : {}),
    status: "LIVE" as const,
    startsAt: { lte: now },
    endsAt: { gt: now },
    classLevel: enrollment.classLevel,
    OR: [
      { scope: "GLOBAL" as const },
      { scope: "SCHOOL" as const, schoolId: enrollment.schoolId },
    ],
    AND: [
      {
        OR: [
          { streams: { none: {} } },
          ...(enrollment.streamId ? [{ streams: { some: { streamId: enrollment.streamId } } }] : []),
        ],
      },
    ],
  };
}

export async function listStudentTests(context: UserContext) {
  const { student } = studentEnrollment(context);
  const now = new Date();
  const tests = await prisma.test.findMany({
    where: availableTestWhere(undefined, context, now),
    include: {
      subject: { select: { name: true } },
      attempts: { where: { studentId: student.id }, select: { id: true, status: true, startedAt: true, expiresAt: true, submittedAt: true } },
      _count: { select: { questions: true } },
    },
    orderBy: { endsAt: "asc" },
  });
  return tests.map((test) => ({ ...test, startsAt: test.startsAt.toISOString(), endsAt: test.endsAt.toISOString(), attempt: test.attempts[0] ? { ...test.attempts[0], startedAt: test.attempts[0].startedAt.toISOString(), expiresAt: test.attempts[0].expiresAt.toISOString(), submittedAt: test.attempts[0].submittedAt?.toISOString() ?? null } : null, attempts: undefined }));
}

export async function listStudentResults(context: UserContext) {
  const { student } = studentEnrollment(context);
  const now = new Date();

  // An attempt that was left open past its deadline is still a result, but
  // should be persisted as expired before it is returned.
  await prisma.testAttempt.updateMany({
    where: { studentId: student.id, status: "IN_PROGRESS", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  const expiredAttempts = await prisma.testAttempt.findMany({
    where: { studentId: student.id, status: "EXPIRED" },
    select: { id: true },
  });
  for (const attempt of expiredAttempts) {
    await submitStudentAttempt(attempt.id, context);
  }

  const attempts = await prisma.testAttempt.findMany({
    where: {
      studentId: student.id,
      status: { in: ["SUBMITTED", "AUTO_SUBMITTED", "EXPIRED"] },
    },
    select: {
      id: true,
      status: true,
      marks: true,
      maxMarks: true,
      submittedAt: true,
      test: { select: { title: true, subject: { select: { name: true } } } },
    },
    orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
  });

  return attempts.map((attempt, index) => ({
    id: attempt.id,
    title: attempt.test.title,
    subject: attempt.test.subject.name,
    marks: attempt.marks,
    maxMarks: attempt.maxMarks,
    percentage: attempt.marks != null && attempt.maxMarks ? Math.round((attempt.marks / attempt.maxMarks) * 100) : null,
    attemptNumber: index + 1,
    completedBy: "You",
    status: attempt.status,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
  }));
}

export async function getStudentTest(testId: string, context: UserContext) {
  const { student } = studentEnrollment(context);
  const test = await prisma.test.findFirst({
    where: availableTestWhere(testId, context, new Date()),
    include: { subject: { select: { name: true } }, attempts: { where: { studentId: student.id }, select: { id: true, status: true, startedAt: true, expiresAt: true } }, _count: { select: { questions: true } } },
  });
  if (!test) throw new Error("NOT_FOUND");
  return { id: test.id, title: test.title, description: test.description, subjectName: test.subject.name, durationSeconds: test.durationSeconds, startsAt: test.startsAt.toISOString(), endsAt: test.endsAt.toISOString(), questionCount: test.questionCount ?? test._count.questions, attempt: test.attempts[0] ?? null };
}

export async function startStudentAttempt(testId: string, context: UserContext) {
  const { student } = studentEnrollment(context);
  const now = new Date();
  const test = await prisma.test.findFirst({ where: availableTestWhere(testId, context, now), include: { questions: { select: { id: true }, orderBy: { position: "asc" } } } });
  if (!test) throw new Error("NOT_FOUND");
  const existing = await prisma.testAttempt.findUnique({ where: { testId_studentId: { testId, studentId: student.id } }, select: { id: true, status: true, startedAt: true, expiresAt: true, submittedAt: true } });
  if (existing) {
    if (existing.status === "IN_PROGRESS" && existing.expiresAt <= now) {
      return prisma.testAttempt.update({ where: { id: existing.id }, data: { status: "EXPIRED" }, select: { id: true, status: true, startedAt: true, expiresAt: true, submittedAt: true } });
    }
    return existing;
  }
  const expiresAt = new Date(Math.min(now.getTime() + test.durationSeconds * 1000, test.endsAt.getTime()));
  const selected = test.questions.slice(0, test.questionCount ?? test.questions.length);
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.testAttempt.create({ data: { testId, studentId: student.id, startedAt: now, expiresAt, questions: { create: selected.map((question, index) => ({ questionId: question.id, displayOrder: index })) } }, select: { id: true, status: true, startedAt: true, expiresAt: true, submittedAt: true } });
    return attempt;
  });
}

function studentAttemptContext(context: UserContext) {
  const { student } = studentEnrollment(context);
  return student;
}

export async function getStudentAttempt(attemptId: string, context: UserContext) {
  const student = studentAttemptContext(context);
  const attempt = await prisma.testAttempt.findFirst({
    where: { id: attemptId, studentId: student.id },
    include: {
      test: { select: { id: true, title: true, durationSeconds: true } },
      questions: {
        orderBy: { displayOrder: "asc" },
        include: {
          question: {
            select: {
              id: true, text: true, marks: true, position: true,
              options: { select: { id: true, text: true, position: true }, orderBy: { position: "asc" } },
            },
          },
        },
      },
      answers: { select: { questionId: true, selectedOptionId: true } },
    },
  });
  if (!attempt) throw new Error("NOT_FOUND");
  if (attempt.status === "EXPIRED" || (attempt.status === "IN_PROGRESS" && attempt.expiresAt <= new Date())) {
    const finalized = await submitStudentAttempt(attempt.id, context);
    return { ...attempt, ...finalized, questions: attempt.questions, answers: attempt.answers };
  }
  return attempt;
}

export async function saveStudentAnswer(
  attemptId: string,
  questionId: string,
  selectedOptionId: string | null,
  context: UserContext,
) {
  const student = studentAttemptContext(context);
  const attempt = await prisma.testAttempt.findFirst({
    where: { id: attemptId, studentId: student.id },
    select: { id: true, status: true, expiresAt: true },
  });
  if (!attempt) throw new Error("NOT_FOUND");
  if (attempt.status !== "IN_PROGRESS") throw new Error("ATTEMPT_NOT_ACTIVE");
  if (attempt.expiresAt <= new Date()) {
    await prisma.testAttempt.update({ where: { id: attempt.id }, data: { status: "EXPIRED" } });
    throw new Error("ATTEMPT_EXPIRED");
  }
  const question = await prisma.attemptQuestion.findFirst({
    where: { attemptId, questionId },
    select: { questionId: true },
  });
  if (!question) throw new Error("INVALID_QUESTION");
  if (selectedOptionId) {
    const option = await prisma.questionOption.findFirst({ where: { id: selectedOptionId, questionId }, select: { id: true } });
    if (!option) throw new Error("INVALID_OPTION");
  }
  return prisma.studentAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: { attemptId, questionId, selectedOptionId },
    update: { selectedOptionId, answeredAt: new Date() },
    select: { questionId: true, selectedOptionId: true, updatedAt: true },
  });
}

export async function submitStudentAttempt(attemptId: string, context: UserContext) {
  const student = studentAttemptContext(context);
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.testAttempt.findFirst({
      where: { id: attemptId, studentId: student.id },
      include: {
        questions: { include: { question: { select: { id: true, marks: true, options: { select: { id: true, isCorrect: true } } } } } },
        answers: { select: { questionId: true, selectedOptionId: true } },
      },
    });
    if (!attempt) throw new Error("NOT_FOUND");
    if (attempt.status !== "IN_PROGRESS" && attempt.status !== "EXPIRED") {
      if (attempt.status === "SUBMITTED" || attempt.status === "AUTO_SUBMITTED") {
        return { id: attempt.id, status: attempt.status, submittedAt: attempt.submittedAt, marks: attempt.marks, maxMarks: attempt.maxMarks };
      }
      throw new Error("ATTEMPT_NOT_ACTIVE");
    }
    const expired = attempt.status === "EXPIRED" || attempt.expiresAt <= new Date();
    const answers = new Map(attempt.answers.map((answer) => [answer.questionId, answer.selectedOptionId]));
    let marks = 0;
    let maxMarks = 0;
    for (const item of attempt.questions) {
      maxMarks += item.question.marks;
      const selected = answers.get(item.questionId);
      if (selected && item.question.options.some((option) => option.id === selected && option.isCorrect)) marks += item.question.marks;
    }
    return tx.testAttempt.update({
      where: { id: attempt.id },
      data: { status: expired ? "AUTO_SUBMITTED" : "SUBMITTED", submittedAt: new Date(), marks, maxMarks },
      select: { id: true, status: true, submittedAt: true, marks: true, maxMarks: true },
    }).then((result) => ({ ...result, marks, maxMarks }));
  });
}
