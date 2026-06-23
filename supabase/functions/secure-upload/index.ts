import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const STORAGE_BUCKET = "loyalty-documents";

const ALLOWED_SIGNATURES: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
};

function detectMimeType(bytes: Uint8Array, allowedTypes: string[]): string | null {
  for (const mimeType of allowedTypes) {
    const signatures = ALLOWED_SIGNATURES[mimeType] || [];
    for (const sig of signatures) {
      if (sig.every((byte, i) => bytes[i] === byte)) return mimeType;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Non autorisé" }, 401);

    // Verify user JWT
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return respond({ error: "Token invalide" }, 401);

    // Parse multipart form
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const storagePath = formData.get("path") as string | null;
    const allowedTypesRaw = formData.get("allowedTypes") as string | null;

    if (!file || !storagePath) return respond({ error: "Fichier ou chemin manquant" }, 400);

    // Prevent path traversal — path must start with user's own ID
    if (!storagePath.startsWith(user.id + "/")) {
      return respond({ error: "Chemin non autorisé" }, 403);
    }

    const allowedTypes = allowedTypesRaw
      ? allowedTypesRaw.split(",")
      : Object.keys(ALLOWED_SIGNATURES);

    // Read full file bytes
    const fileBytes = new Uint8Array(await file.arrayBuffer());

    // Validate size
    if (fileBytes.length > MAX_FILE_SIZE_BYTES) {
      return respond({ error: `"${file.name}" dépasse la taille maximale de 10 Mo.` }, 400);
    }

    // Validate magic bytes (real file type, not just extension or declared MIME)
    const detectedMime = detectMimeType(fileBytes, allowedTypes);
    if (!detectedMime) {
      return respond(
        { error: `"${file.name}" : type de fichier non autorisé. Seuls PDF, JPG et PNG sont acceptés.` },
        400,
      );
    }

    // Upload with verified content type
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBytes, { contentType: detectedMime, upsert: false });

    if (uploadError) throw uploadError;

    return respond({ path: storagePath }, 200);
  } catch (error) {
    console.error("Erreur secure-upload:", error);
    return respond({ error: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
