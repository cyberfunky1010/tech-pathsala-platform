import { z } from "zod";

export const learningMaterialQuerySchema = z.object({
  subjectId: z.string().uuid().optional(),
  classLevel: z.coerce.number().int().min(9).max(12).optional(),
  search: z.string().trim().max(100).optional(),
});

export const createLearningMaterialSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional(),
  subjectId: z.string().uuid(),
  classLevel: z.number().int().min(9).max(12),
  scope: z.enum(["GLOBAL", "SCHOOL"]),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  streamIds: z.array(z.string().uuid()).max(3).default([]),
});

export const updateLearningMaterialSchema = createLearningMaterialSchema
  .partial()
  .extend({
    streamIds: z.array(z.string().uuid()).max(3).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type CreateLearningMaterialInput = z.infer<
  typeof createLearningMaterialSchema
>;
export type UpdateLearningMaterialInput = z.infer<
  typeof updateLearningMaterialSchema
>;
