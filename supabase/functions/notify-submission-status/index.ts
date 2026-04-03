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
    const { submission } = await req.json();

    if (!submission?.email) {
      return new Response(
        JSON.stringify({ error: "Email du client manquant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fullName =
      `${submission?.first_name || ""} ${submission?.last_name || ""}`.trim() ||
      "Client";

    const statusLabels: Record<string, string> = {
      validated: "Validée ✅",
      rejected: "Refusée ❌",
      needs_info: "Complément d'informations requis ℹ️",
      pending: "En attente",
    };

    const statusLabel = statusLabels[submission?.status] ?? submission?.status;

    const adminMessageBlock = submission?.admin_message
      ? `<p><strong>Message de notre équipe :</strong><br>${escapeHtml(submission.admin_message)}</p>`
      : "";

    const pointsBlock =
      submission?.status === "validated" && submission?.points_awarded
        ? `<p><strong>Points attribués :</strong> ${submission.points_awarded} points</p>`
        : "";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #101828; line-height: 1.6;">
        <h2>Mise à jour de votre demande de points</h2>
        <p>Bonjour ${escapeHtml(fullName)},</p>
        <p>Votre demande de validation de points a été mise à jour.</p>
        <p><strong>Statut :</strong> ${escapeHtml(statusLabel)}</p>
        ${pointsBlock}
        ${adminMessageBlock}
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
        to: [submission.email],
        subject: `Votre demande de points — ${statusLabel}`,
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
