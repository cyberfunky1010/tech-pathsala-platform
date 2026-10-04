import { z } from "zod";

const questionOptionSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  isCorrect: z.boolean(),
});

export const createQuestionSchema = z.object({
  text: z.string().trim().min(1).max(10000),
  marks: z.number().finite().positive().max(1000).default(1),
  options: z.array(questionOptionSchema).max(10).optional(),
}).superRefine((value, context) => {
  if (value.options && value.options.length > 0) {
    if (value.options.length < 2) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Add at least two options." });
    }
    if (!value.options.some((option) => option.isCorrect)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Mark at least one correct option." });
    }
  }
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
