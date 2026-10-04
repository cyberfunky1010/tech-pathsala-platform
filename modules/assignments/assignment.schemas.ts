import { z } from "zod";

export const assignmentQuerySchema = z.object({
  classLevel: z.coerce.number().int().min(9).max(12).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export const createAssignmentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional(),
  subjectId: z.string().uuid(),
  classLevel: z.number().int().min(9).max(12),
  scope: z.enum(["GLOBAL", "SCHOOL"]),
  dueAt: z.string().datetime({ offset: true }),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  streamIds: z.array(z.string().uuid()).max(3).default([]),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
