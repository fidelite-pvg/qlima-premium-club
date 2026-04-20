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

async function sendEmail(payload: {
  to: string[];
  subject: string;
  html: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: payload.to,
      reply_to: MAIL_REPLY_TO ? [MAIL_REPLY_TO] : undefined,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Erreur Resend: ${body}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { redemption } = await req.json();

    const fullName =
      `${redemption?.first_name || ""} ${redemption?.last_name || ""}`.trim() ||
      "Client";

    const adminHtml = `
      <div style="font-family: Arial, sans-serif; color: #101828; line-height: 1.6;">
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

    const customerHtml = `
      <div style="font-family: Arial, sans-serif; color: #101828; line-height: 1.6;">
        <h2>Votre demande de récompense a bien été envoyée</h2>
        <p>Bonjour ${escapeHtml(fullName)},</p>
        <p>Nous vous confirmons que votre demande de récompense a bien été reçue par notre équipe.</p>
        <ul>
          <li><strong>Récompense demandée :</strong> ${escapeHtml(redemption?.reward_title || "Non renseigné")}</li>
          <li><strong>Points utilisés :</strong> ${redemption?.points_used ?? 0}</li>
        </ul>
        <p>Votre demande sera traitée dans les meilleurs délais. Vous recevrez un nouvel e-mail dès qu'elle aura été étudiée.</p>
        <p>Vous pouvez également suivre son statut directement depuis votre espace fidélité.</p>
        <p>Cordialement,<br>L'équipe Qlima</p>
      </div>
    `;

    await sendEmail({
      to: [ADMIN_EMAIL],
      subject: "Nouvelle demande de récompense",
      html: adminHtml,
    });

    if (redemption?.email) {
      await sendEmail({
        to: [redemption.email],
        subject: "Nous avons bien reçu votre demande de récompense",
        html: customerHtml,
      });
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
