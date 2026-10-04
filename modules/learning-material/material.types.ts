export type LearningMaterialListItem = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  subjectName: string;
  classLevel: number;
  scope: "GLOBAL" | "SCHOOL";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  fileCount: number;
  files: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
  }>;
  canManage: boolean;
};

export type LearningMaterialDetail = LearningMaterialListItem & {
  streams: Array<{ id: string; name: string }>;
  files: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    createdAt: string;
  }>;
};
