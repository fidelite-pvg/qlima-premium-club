import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "fidelite@pvg.eu";
const MAIL_FROM =
  Deno.env.get("MAIL_FROM") || "Qlima Premium Club <onboarding@resend.dev>";
const MAIL_REPLY_TO = Deno.env.get("MAIL_REPLY_TO") || ADMIN_EMAIL;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { redemption } = await req.json();

    const fullName =
      `${redemption?.first_name || ""} ${redemption?.last_name || ""}`.trim() ||
      "Non renseigné";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #101828;">
        <h2>Nouvelle demande de récompense</h2>
        <ul>
          <li><strong>Nom :</strong> ${escapeHtml(fullName)}</li>
          <li><strong>Email :</strong> ${escapeHtml(redemption?.email || "Non renseigné")}</li>
          <li><strong>Récompense :</strong> ${escapeHtml(redemption?.reward_title || "Non renseigné")}</li>
          <li><strong>Points utilisés :</strong> ${redemption?.points_used ?? 0}</li>
          <li><strong>Statut :</strong> ${escapeHtml(redemption?.status || "pending")}</li>
        </ul>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [ADMIN_EMAIL],
        reply_to: MAIL_REPLY_TO ? [MAIL_REPLY_TO] : undefined,
        subject: "Nouvelle demande de récompense",
        html,
      }),
    });

    const resendData = await resendResponse.text();

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Erreur Resend", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
