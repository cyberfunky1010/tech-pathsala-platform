import { prisma } from "@/lib/db/prisma";
import type { CreateQuestionInput } from "./question.schemas";

type UserContext = Awaited<ReturnType<typeof import("@/lib/auth/current-user").getCurrentUserContext>>;

function canManage(context: UserContext) {
  return context.roles.includes("SCHOOL_ADMIN") || context.roles.includes("CENTRAL_ADMIN");
}

function visibleTestWhere(context: UserContext) {
  if (context.workspace.mode === "SCHOOL_ADMIN") {
    return {
      OR: [
        { scope: "GLOBAL" as const },
        { scope: "SCHOOL" as const, schoolId: context.workspace.schoolId },
      ],
    };
  }
  return { scope: "GLOBAL" as const, createdById: context.id };
}

async function getManageableTest(testId: string, context: UserContext) {
  if (!canManage(context)) throw new Error("FORBIDDEN");
  const test = await prisma.test.findFirst({
    where: { id: testId, ...visibleTestWhere(context) },
    select: { id: true, title: true, questionCount: true },
  });
  if (!test) throw new Error("NOT_FOUND");
  return test;
}

export async function listQuestions(testId: string, context: UserContext) {
  await getManageableTest(testId, context);
  return prisma.question.findMany({
    where: { testId },
    select: {
      id: true, text: true, marks: true, position: true,
      options: { select: { id: true, text: true, position: true, isCorrect: true }, orderBy: { position: "asc" } },
    },
    orderBy: { position: "asc" },
  });
}

export async function createQuestion(testId: string, input: CreateQuestionInput, context: UserContext) {
  const test = await getManageableTest(testId, context);
  const lastQuestion = await prisma.question.findFirst({
    where: { testId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const question = await prisma.question.create({
    data: {
      testId,
      text: input.text,
      marks: input.marks,
      position: (lastQuestion?.position ?? 0) + 1,
      options: input.options?.length
        ? { create: input.options.map((option, position) => ({ ...option, position: position + 1 })) }
        : undefined,
    },
    select: {
      id: true, text: true, marks: true, position: true,
      options: { select: { id: true, text: true, position: true, isCorrect: true }, orderBy: { position: "asc" } },
    },
  });
  return { test, question };
}
