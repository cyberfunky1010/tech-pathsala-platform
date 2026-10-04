import { apiData, apiError } from "@/lib/api/response";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { deleteGallery } from "@/modules/gallery/gallery.service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await deleteGallery((await params).id, await getCurrentUserContext()); return apiData({ deleted: true }); }
  catch (error) { const message = error instanceof Error ? error.message : ""; if (message === "NOT_FOUND") return apiError(404, message, "Gallery not found."); if (message === "FORBIDDEN") return apiError(403, message, "You cannot delete this gallery."); return apiError(500, "GALLERY_DELETE_FAILED", "Gallery could not be deleted."); }
}
