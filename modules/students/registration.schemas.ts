import { z } from "zod";

export const createRegistrationRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  schoolCode: z.string().trim().min(1).max(40),
  academicYearName: z.string().trim().min(1).max(40),
  admissionNumber: z.string().trim().min(1).max(40),
  classLevel: z.number().int().min(9).max(12),
  streamId: z.string().uuid().optional(),
});

export const approveRegistrationRequestSchema = z.object({
  schoolCode: z.string().trim().min(1).max(40),
  academicYearName: z.string().trim().min(1).max(40),
  admissionNumber: z.string().trim().min(1).max(40),
  classLevel: z.number().int().min(9).max(12),
  streamId: z.string().uuid().optional(),
});

export type CreateRegistrationRequestInput = z.infer<typeof createRegistrationRequestSchema>;
export type ApproveRegistrationRequestInput = z.infer<typeof approveRegistrationRequestSchema>;
