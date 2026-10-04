import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getSupabaseAdminClient, GALLERY_BUCKET } from "@/lib/storage/supabase-admin";
import type { CreateGalleryInput, GalleryQuery } from "./gallery.schemas";

type UserContext = Awaited<ReturnType<typeof import("@/lib/auth/current-user").getCurrentUserContext>>;

function schoolVisible(context: UserContext) {
  return context.schoolIds.length ? [{ type: "SCHOOL" as const, schoolId: { in: context.schoolIds } }] : [];
}

function canManage(gallery: { type: "PUBLIC" | "SCHOOL"; schoolId: string | null }, context: UserContext) {
  if (context.roles.includes("CENTRAL_ADMIN")) return true;
  return context.roles.includes("SCHOOL_ADMIN") && gallery.type === "SCHOOL" && context.schoolIds.includes(gallery.schoolId ?? "");
}

function safeName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100) || "image";
}

export async function listGalleries(query: GalleryQuery, context?: UserContext) {
  const visibility = query.type === "PUBLIC"
    ? [{ type: "PUBLIC" as const }]
    : context
    ? context.roles.includes("CENTRAL_ADMIN")
      ? query.type === "SCHOOL" ? [{ type: "SCHOOL" as const }] : [{ type: "PUBLIC" as const }, { type: "SCHOOL" as const }]
      : query.type === "SCHOOL" ? schoolVisible(context) : [{ type: "PUBLIC" as const }, ...schoolVisible(context)]
      : [{ type: "PUBLIC" as const }];
  const galleries = await prisma.gallery.findMany({
    where: {
      OR: visibility,
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
    },
    include: { school: { select: { name: true } }, items: { orderBy: { createdAt: "asc" }, take: 12 } },
    orderBy: { createdAt: "desc" },
  });
  const storage = getSupabaseAdminClient().storage.from(GALLERY_BUCKET);
  return Promise.all(galleries.map(async (gallery) => ({
    id: gallery.id, type: gallery.type, title: gallery.title, description: gallery.description,
    schoolName: gallery.school?.name ?? null, createdAt: gallery.createdAt.toISOString(),
    items: await Promise.all(gallery.items.map(async (item) => {
      const signed = await storage.createSignedUrl(item.storagePath, 3600);
      return { id: item.id, caption: item.caption, originalName: item.originalName, mimeType: item.mimeType, fileSize: item.fileSize, url: signed.data?.signedUrl ?? null };
    })),
  })));
}

export async function createGallery(input: CreateGalleryInput, files: File[], context: UserContext) {
  if (!context.roles.includes("CENTRAL_ADMIN") && !context.roles.includes("SCHOOL_ADMIN")) throw new Error("FORBIDDEN");
  const schoolId = input.type === "SCHOOL"
    ? context.workspace.mode === "SCHOOL_ADMIN"
      ? context.workspace.schoolId
      : input.schoolId
    : null;
  if (input.type === "SCHOOL" && (!schoolId || (!context.schoolIds.includes(schoolId) && !context.roles.includes("CENTRAL_ADMIN")))) {
    throw new Error("SCHOOL_SCOPE_REQUIRED");
  }
  if (!files.length) throw new Error("FILES_REQUIRED");
  if (files.length > 30) throw new Error("TOO_MANY_FILES");
  if (files.some((file) => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) throw new Error("INVALID_FILE");
  const gallery = await prisma.gallery.create({ data: { title: input.title, description: input.description || null, type: input.type, schoolId } });
  const storage = getSupabaseAdminClient().storage.from(GALLERY_BUCKET);
  const uploadedPaths: string[] = [];
  try {
    for (const file of files) {
      const path = `galleries/${gallery.id}/${randomUUID()}-${safeName(file.name)}`;
      const upload = await storage.upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw new Error("FILE_UPLOAD_FAILED");
      uploadedPaths.push(path);
      await prisma.galleryItem.create({ data: { galleryId: gallery.id, storagePath: path, originalName: file.name, mimeType: file.type, fileSize: file.size, createdById: context.id } });
    }
  } catch (error) {
    await storage.remove(uploadedPaths).catch(() => undefined);
    await prisma.gallery.delete({ where: { id: gallery.id } }).catch(() => undefined);
    throw error;
  }
  return gallery;
}

export async function deleteGallery(id: string, context: UserContext) {
  const gallery = await prisma.gallery.findUnique({ where: { id }, include: { items: true } });
  if (!gallery) throw new Error("NOT_FOUND");
  if (!canManage(gallery, context)) throw new Error("FORBIDDEN");
  await prisma.gallery.delete({ where: { id } });
  await getSupabaseAdminClient().storage.from(GALLERY_BUCKET).remove(gallery.items.map((item) => item.storagePath));
}
