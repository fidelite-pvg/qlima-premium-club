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

  console.log("Resend response", {
    to: payload.to,
    subject: payload.subject,
    status: response.status,
    body,
  });

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

    const { submission } = await req.json();

    const customerEmail = String(submission?.email || "").trim().toLowerCase();
    const fullName =
      `${submission?.first_name || ""} ${submission?.last_name || ""}`.trim() ||
      "Client";

    console.log("notify-new-submission called", {
      customerEmail,
      fullName,
      fuel: submission?.fuel,
      quantity: submission?.quantity,
      estimated_points: submission?.estimated_points,
      status: submission?.status,
    });

    const adminHtml = `
      <div style="font-family: Arial, sans-serif; color: #101828; line-height: 1.6;">
        <h2>Nouvelle demande de validation de points</h2>
        <ul>
          <li><strong>Nom :</strong> ${escapeHtml(fullName)}</li>
          <li><strong>Email :</strong> ${escapeHtml(customerEmail || "Non renseigné")}</li>
          <li><strong>Produit :</strong> ${escapeHtml(submission?.fuel || submission?.product_name || "Non renseigné")}</li>
          <li><strong>Quantité :</strong> ${submission?.quantity ?? ""}</li>
          <li><strong>Points estimés :</strong> ${submission?.estimated_points ?? 0}</li>
          <li><strong>Statut :</strong> ${escapeHtml(submission?.status || "pending")}</li>
        </ul>
      </div>
    `;

    const customerHtml = `
      <div style="font-family: Arial, sans-serif; color: #101828; line-height: 1.6;">
        <h2>Votre demande de points a bien été envoyée</h2>
        <p>Bonjour ${escapeHtml(fullName)},</p>
        <p>Nous vous confirmons que votre demande de points a bien été reçue par notre équipe.</p>
        <ul>
          <li><strong>Produit :</strong> ${escapeHtml(submission?.fuel || submission?.product_name || "Non renseigné")}</li>
          <li><strong>Quantité :</strong> ${submission?.quantity ?? ""}</li>
          <li><strong>Points estimés :</strong> ${submission?.estimated_points ?? 0}</li>
        </ul>
        <p>Votre demande sera traitée dans les meilleurs délais. Vous recevrez un nouvel e-mail dès qu'elle aura été étudiée.</p>
        <p>Vous pouvez également suivre son statut directement depuis votre espace fidélité.</p>
        <p>Cordialement,<br>L'équipe Qlima</p>
      </div>
    `;

    let adminSent = false;
    let customerSent = false;
    let customerError = "";

    await sendEmail({
      to: [ADMIN_EMAIL],
      subject: "Nouvelle demande de points",
      html: adminHtml,
    });
    adminSent = true;

    if (customerEmail) {
      try {
        await sendEmail({
          to: [customerEmail],
          subject: "Nous avons bien reçu votre demande de points",
          html: customerHtml,
        });
        customerSent = true;
      } catch (error) {
        customerError =
          error instanceof Error ? error.message : "Erreur inconnue";
        console.error("Erreur envoi mail client nouvelle demande :", customerError);
      }
    } else {
      customerError = "Email client manquant";
      console.error("Email client manquant dans notify-new-submission");
    }

    return new Response(
      JSON.stringify({
        success: true,
        adminSent,
        customerSent,
        customerError,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: customerSent || !customerEmail ? 200 : 207,
      },
    );
  } catch (error) {
    console.error("Erreur notify-new-submission :", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});