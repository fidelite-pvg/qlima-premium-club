import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_FROM =
  Deno.env.get("MAIL_FROM") || "Qlima Premium Club <onboarding@resend.dev>";

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

    if (!redemption?.email) {
      return new Response(
        JSON.stringify({ error: "Email du client manquant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fullName =
      `${redemption?.first_name || ""} ${redemption?.last_name || ""}`.trim() ||
      "Client";

    const statusLabels: Record<string, string> = {
      approved: "Validée ✅",
      rejected: "Refusée ❌",
      cancelled: "Annulée",
      pending: "En attente",
    };

    const statusLabel = statusLabels[redemption?.status] ?? redemption?.status;

    const approvedBlock =
      redemption?.status === "approved"
        ? `<p>Votre récompense va être traitée dans les meilleurs délais. Si un virement est prévu, il peut prendre jusqu'à 6 semaines.</p>`
        : "";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #101828; line-height: 1.6;">
        <h2>Mise à jour de votre demande de récompense</h2>
        <p>Bonjour ${escapeHtml(fullName)},</p>
        <p>Votre demande de récompense a été mise à jour.</p>
        <p><strong>Récompense :</strong> ${escapeHtml(redemption?.reward_title || "")}</p>
        <p><strong>Statut :</strong> ${escapeHtml(statusLabel)}</p>
        ${approvedBlock}
        <p>Connectez-vous à votre espace fidélité pour consulter le détail.</p>
        <p>Cordialement,<br>L'équipe Qlima</p>
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
        to: [redemption.email],
        subject: `Votre récompense "${redemption?.reward_title || ""}" — ${statusLabel}`,
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
