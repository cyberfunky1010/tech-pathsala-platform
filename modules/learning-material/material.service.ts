import type {
  CreateLearningMaterialInput,
  UpdateLearningMaterialInput,
} from "./material.schemas";
import { prisma } from "@/lib/db/prisma";
import type {
  LearningMaterialDetail,
  LearningMaterialListItem,
} from "./material.types";
import { getSupabaseAdminClient, LEARNING_MATERIAL_BUCKET } from "@/lib/storage/supabase-admin";
import { randomUUID } from "node:crypto";

type UserContext = Awaited<ReturnType<typeof import("@/lib/auth/current-user").getCurrentUserContext>>;

function visibleScope(context: UserContext) {
  const schoolIds = [...new Set(context.schoolIds)];
  return [
    { scope: "GLOBAL" as const },
    ...(schoolIds.length
      ? [{ scope: "SCHOOL" as const, schoolId: { in: schoolIds } }]
      : []),
  ];
}

function canManageMaterial(
  material: { scope: "GLOBAL" | "SCHOOL"; schoolId: string | null; createdById: string },
  context: UserContext,
) {
  if (context.workspace.mode === "CENTRAL_ADMIN" && context.roles.includes("CENTRAL_ADMIN")) {
    return true;
  }

  return (
    context.roles.includes("SCHOOL_ADMIN") &&
    material.scope === "SCHOOL" &&
    context.workspace.mode === "SCHOOL_ADMIN" &&
    context.workspace.schoolId === material.schoolId &&
    context.schoolIds.includes(material.schoolId ?? "") &&
    material.createdById === context.id
  );
}

function safeFileName(name: string) {
  const normalized = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized.slice(0, 120) || "upload";
}

function fileMimeType(file: File) {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "doc" || extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "ppt" || extension === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return file.type || "application/octet-stream";
}

export async function listLearningMaterial(
  context: UserContext,
  filters: { subjectId?: string; classLevel?: number; search?: string },
): Promise<LearningMaterialListItem[]> {
  const visibility = visibleScope(context);
  const materials = await prisma.learningMaterial.findMany({
    where: {
      status: "PUBLISHED",
      ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
      ...(filters.classLevel ? { classLevel: filters.classLevel } : {}),
      ...(filters.search
        ? { AND: [{ OR: [{ title: { contains: filters.search, mode: "insensitive" } }, { description: { contains: filters.search, mode: "insensitive" } }] }, { OR: visibility }] }
        : { OR: visibility }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      subject: { select: { name: true } },
      files: { select: { id: true, originalName: true, mimeType: true, fileSize: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { files: true } },
    },
  });

  return materials.map((material) => ({
    id: material.id,
    title: material.title,
    description: material.description,
    subjectId: material.subjectId,
    subjectName: material.subject.name,
    classLevel: material.classLevel,
    scope: material.scope,
    status: material.status,
    createdAt: material.createdAt.toISOString(),
    fileCount: material._count.files,
    files: material.files,
    canManage: canManageMaterial(material, context),
  }));
}

export async function getLearningMaterial(
  id: string,
  context: UserContext,
): Promise<LearningMaterialDetail> {
  const material = await prisma.learningMaterial.findFirst({
    where: {
      id,
      status: "PUBLISHED",
      OR: visibleScope(context),
    },
    include: {
      subject: { select: { name: true } },
      streams: { include: { stream: { select: { id: true, name: true } } } },
      files: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!material) throw new Error("NOT_FOUND");

  return {
    id: material.id,
    title: material.title,
    description: material.description,
    subjectId: material.subjectId,
    subjectName: material.subject.name,
    classLevel: material.classLevel,
    scope: material.scope,
    status: material.status,
    createdAt: material.createdAt.toISOString(),
    fileCount: material.files.length,
    canManage: canManageMaterial(material, context),
    streams: material.streams.map(({ stream }) => stream),
    files: material.files.map((file) => ({
      ...file,
      createdAt: file.createdAt.toISOString(),
    })),
  };
}

export async function createLearningMaterial(
  input: CreateLearningMaterialInput,
  context: UserContext,
) {
  const canCreateGlobal = context.roles.includes("CENTRAL_ADMIN");
  const canCreateSchool = context.roles.includes("SCHOOL_ADMIN");

  if ((input.scope === "GLOBAL" && !canCreateGlobal) || (input.scope === "SCHOOL" && !canCreateSchool)) {
    throw new Error("FORBIDDEN");
  }

  const schoolId = input.scope === "SCHOOL" ? context.schoolIds[0] : null;
  if (input.scope === "SCHOOL" && !schoolId) throw new Error("SCHOOL_SCOPE_REQUIRED");

  const material = await prisma.learningMaterial.create({
    data: {
      title: input.title,
      description: input.description,
      subjectId: input.subjectId,
      classLevel: input.classLevel,
      scope: input.scope,
      schoolId,
      createdById: context.id,
      status: input.status,
      streams: input.streamIds.length ? { create: input.streamIds.map((streamId) => ({ streamId })) } : undefined,
    },
    include: { subject: { select: { name: true } }, _count: { select: { files: true } } },
  });

  return {
    id: material.id,
    title: material.title,
    description: material.description,
    subjectId: material.subjectId,
    subjectName: material.subject.name,
    classLevel: material.classLevel,
    scope: material.scope,
    status: material.status,
    createdAt: material.createdAt.toISOString(),
    fileCount: material._count.files,
    files: [],
  };
}

export async function updateLearningMaterial(
  id: string,
  input: UpdateLearningMaterialInput,
  context: UserContext,
) {
  const existing = await prisma.learningMaterial.findUnique({
    where: { id },
    select: { scope: true, schoolId: true, createdById: true },
  });

  if (!existing) throw new Error("NOT_FOUND");
  if (!canManageMaterial(existing, context)) throw new Error("FORBIDDEN");
  if (input.scope && input.scope !== existing.scope) {
    throw new Error("SCOPE_IMMUTABLE");
  }

  const { streamIds, ...fields } = input;
  const material = await prisma.learningMaterial.update({
    where: { id },
    data: {
      ...fields,
      ...(streamIds
        ? {
            streams: {
              deleteMany: {},
              create: streamIds.map((streamId) => ({ streamId })),
            },
          }
        : {}),
    },
    include: {
      subject: { select: { name: true } },
      _count: { select: { files: true } },
    },
  });

  return {
    id: material.id,
    title: material.title,
    description: material.description,
    subjectId: material.subjectId,
    subjectName: material.subject.name,
    classLevel: material.classLevel,
    scope: material.scope,
    status: material.status,
    createdAt: material.createdAt.toISOString(),
    fileCount: material._count.files,
    files: [],
  };
}

export async function createLearningMaterialFileDownloadUrl(
  materialId: string,
  fileId: string,
  context: UserContext,
) {
  const file = await prisma.learningMaterialFile.findFirst({
    where: {
      id: fileId,
      materialId,
      material: {
        status: "PUBLISHED",
        OR: visibleScope(context),
      },
    },
    select: {
      storagePath: true,
      originalName: true,
    },
  });

  if (!file) throw new Error("NOT_FOUND");

  const { data, error } = await getSupabaseAdminClient()
    .storage
    .from(LEARNING_MATERIAL_BUCKET)
    .createSignedUrl(file.storagePath, 300, { download: file.originalName });

  if (error || !data?.signedUrl) throw new Error("FILE_URL_FAILED");
  return data.signedUrl;
}

export async function deleteLearningMaterial(id: string, context: UserContext) {
  const existing = await prisma.learningMaterial.findUnique({
    where: { id },
    select: { scope: true, schoolId: true, createdById: true, files: { select: { storagePath: true } } },
  });

  if (!existing) throw new Error("NOT_FOUND");
  if (!canManageMaterial(existing, context)) throw new Error("FORBIDDEN");

  await prisma.learningMaterial.delete({ where: { id } });
  if (existing.files.length) {
    await getSupabaseAdminClient().storage.from(LEARNING_MATERIAL_BUCKET).remove(existing.files.map((file) => file.storagePath));
  }
}

export async function uploadLearningMaterialFile(
  id: string,
  file: File,
  context: UserContext,
) {
  const existing = await prisma.learningMaterial.findUnique({
    where: { id },
    select: { scope: true, schoolId: true, createdById: true },
  });

  if (!existing) throw new Error("NOT_FOUND");
  if (!canManageMaterial(existing, context)) throw new Error("FORBIDDEN");
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("FILE_TOO_LARGE");
  }

  const storagePath = `materials/${id}/${randomUUID()}-${safeFileName(file.name)}`;
  const storage = getSupabaseAdminClient().storage.from(LEARNING_MATERIAL_BUCKET);
  const uploadResult = await storage.upload(storagePath, file, {
    contentType: fileMimeType(file),
    upsert: false,
  });

  if (uploadResult.error) {
    throw new Error("FILE_UPLOAD_FAILED");
  }

  try {
    return await prisma.learningMaterialFile.create({
      data: {
        materialId: id,
        storagePath,
        originalName: file.name,
        mimeType: fileMimeType(file),
        fileSize: file.size,
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
      },
    });
  } catch (error) {
    await storage.remove([storagePath]);
    throw error;
  }
}
