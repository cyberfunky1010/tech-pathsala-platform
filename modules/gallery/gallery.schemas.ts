import { z } from "zod";

export const galleryQuerySchema = z.object({
  type: z.enum(["PUBLIC", "SCHOOL"]).optional(),
  search: z.string().trim().max(100).optional(),
});

export const createGallerySchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  type: z.enum(["PUBLIC", "SCHOOL"]),
  schoolId: z.string().uuid().optional(),
});

export type GalleryQuery = z.infer<typeof galleryQuerySchema>;
export type CreateGalleryInput = z.infer<typeof createGallerySchema>;
