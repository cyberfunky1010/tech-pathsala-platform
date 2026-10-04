import { createClient } from "@supabase/supabase-js";

export const LEARNING_MATERIAL_BUCKET =
  process.env.SUPABASE_LEARNING_MATERIAL_BUCKET || "learning-material";
export const ASSIGNMENT_BUCKET =
  process.env.SUPABASE_ASSIGNMENT_BUCKET || "assignments";
export const GALLERY_BUCKET = process.env.SUPABASE_GALLERY_BUCKET || "gallery";

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
