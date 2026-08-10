import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "fidelite@pvg.eu";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user: caller },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !caller || caller.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let email = "";
  try {
    const body = await req.json();
    email = (body.email || "").trim().toLowerCase();
  } catch {
    // corps vide ou invalide
  }

  if (!email) {
    return new Response(JSON.stringify({ error: "E-mail requis" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let foundUser = null;
  const perPage = 1000;

  for (let page = 1; page <= 20 && !foundUser; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    foundUser =
      data.users.find((u) => (u.email || "").toLowerCase() === email) ||
      null;

    if (data.users.length < perPage) break;
  }

  if (!foundUser) {
    return new Response(
      JSON.stringify({ error: "Aucun compte trouvé avec cette adresse e-mail." }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const metadata = foundUser.user_metadata || {};

  return new Response(
    JSON.stringify({
      id: foundUser.id,
      email: foundUser.email,
      first_name: metadata.first_name || "",
      last_name: metadata.last_name || "",
      phone: metadata.phone || "",
      address:
        metadata.full_address ||
        [metadata.address, metadata.postal_code, metadata.city]
          .filter(Boolean)
          .join(", "),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
