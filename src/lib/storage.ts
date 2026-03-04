import { supabase } from "@/integrations/supabase/client";
import type { MaterialFile } from "@/lib/types";

interface SignedUrlResponse {
  canAccess: boolean;
  files: MaterialFile[];
}

/**
 * Fetches signed URLs for a material's files via the edge function.
 * Handles both authenticated and unauthenticated access.
 */
export async function getSignedUrls(materialId: string): Promise<SignedUrlResponse> {
  const { data, error } = await supabase.functions.invoke("get-signed-urls", {
    body: { materialId },
  });

  if (error) {
    console.error("Failed to get signed URLs:", error);
    return { canAccess: false, files: [] };
  }

  return data as SignedUrlResponse;
}
