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

function nl2br(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br>");
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

    const status = redemption?.status;

    const statusLabels: Record<string, string> = {
      approved: "validée ✅",
      rejected: "refusée ❌",
      needs_info: "à compléter 📋",
      cancelled: "annulée",
      pending: "en attente",
    };

    const statusLabel = statusLabels[status] ?? status;

    const subjectMap: Record<string, string> = {
      approved: `Votre demande de récompense a été validée`,
      rejected: `Votre demande de récompense a été refusée`,
      needs_info: `Votre dossier de récompense doit être complété`,
    };

    const subject = subjectMap[status] ??
      `Votre demande de récompense "${redemption?.reward_title || ""}" — ${statusLabel}`;

    const introMap: Record<string, string> = {
      approved: "Bonne nouvelle, votre demande a été validée.",
      rejected: "Après étude, votre demande n'a pas pu être acceptée.",
      needs_info: "Notre équipe a besoin d'un complément pour traiter votre dossier.",
    };

    const intro = introMap[status] ?? "Le statut de votre demande a été mis à jour.";

    const adminMessage = redemption?.admin_message?.trim();
    const adminMessageBlock = adminMessage
      ? `<p><strong>Message de notre équipe :</strong><br>${nl2br(adminMessage)}</p>`
      : "";

    const approvedBlock =
      status === "approved"
        ? `<p>Votre récompense va être traitée dans les meilleurs délais. Si un virement est prévu, il peut prendre jusqu'à 6 semaines.</p>`
        : "";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #101828; line-height: 1.6;">
        <h2>Mise à jour de votre demande de récompense</h2>
        <p>Bonjour ${escapeHtml(fullName)},</p>
        <p>${escapeHtml(intro)}</p>
        <p><strong>Récompense :</strong> ${escapeHtml(redemption?.reward_title || "")}</p>
        <p><strong>Statut :</strong> ${escapeHtml(statusLabel)}</p>
        ${approvedBlock}
        ${adminMessageBlock}
        <p>Connectez-vous à votre espace fidélité pour consulter le détail et, si nécessaire, compléter votre dossier.</p>
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
        subject,
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
