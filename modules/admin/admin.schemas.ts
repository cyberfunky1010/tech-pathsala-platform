import { z } from "zod";

export const createAdminSchema = z.object({
  email: z.string().email(),
  role: z.enum(["CENTRAL_ADMIN", "SCHOOL_ADMIN"]),
  schoolId: z.string().uuid(),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;

export const updateAdminAssignmentSchema = z.object({
  action: z.enum(["END", "REASSIGN"]),
  assignmentId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (value.action === "REASSIGN" && !value.schoolId) {
    ctx.addIssue({ code: "custom", path: ["schoolId"], message: "A replacement school is required." });
  }
});

export type UpdateAdminAssignmentInput = z.infer<typeof updateAdminAssignmentSchema>;
