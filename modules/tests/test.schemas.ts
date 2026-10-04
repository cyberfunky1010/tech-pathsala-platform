import { z } from "zod";

const testStatus = z.enum(["DRAFT", "SCHEDULED", "LIVE", "ENDED", "ARCHIVED"]);

export const testQuerySchema = z.object({
  classLevel: z.coerce.number().int().min(9).max(12).optional(),
  status: testStatus.optional(),
});

export const createTestSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional(),
  subjectId: z.string().uuid(),
  classLevel: z.number().int().min(9).max(12),
  scope: z.enum(["GLOBAL", "SCHOOL"]),
  schoolId: z.string().uuid().optional(),
  durationSeconds: z.number().int().min(60).max(24 * 60 * 60),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  status: testStatus.default("DRAFT"),
  randomizeQuestions: z.boolean().default(true),
  randomizeOptions: z.boolean().default(true),
  questionCount: z.number().int().min(1).max(500).optional(),
}).superRefine((value, context) => {
  if (new Date(value.endsAt) <= new Date(value.startsAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "End time must be after start time." });
  }
  if (value.scope === "GLOBAL" && value.schoolId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["schoolId"], message: "Global tests cannot target a school." });
  }
});

export const updateTestSchema = z.object({
  status: testStatus,
});

export type UpdateTestInput = z.infer<typeof updateTestSchema>;

export type CreateTestInput = z.infer<typeof createTestSchema>;
