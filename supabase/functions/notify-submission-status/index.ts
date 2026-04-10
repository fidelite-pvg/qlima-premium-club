import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_FROM =
  Deno.env.get("MAIL_FROM") || "Qlima Premium Club <onboarding@resend.dev>";
const MAIL_REPLY_TO = Deno.env.get("MAIL_REPLY_TO");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Submission = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  fuel?: string | null;
  quantity?: number | null;
  estimated_points?: number | null;
  points_awarded?: number | null;
  status?: string | null;
  admin_message?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStatusLabel(status?: string | null) {
  switch (status) {
    case "validated":
      return "validée";
    case "approved":
      return "validée";
    case "rejected":
      return "refusée";
    case "needs_info":
      return "à compléter";
    case "cancelled":
      return "annulée";
    case "pending":
      return "en attente";
    default:
      return status || "mise à jour";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY manquant");
    }

    const body = await req.json();
    const submission: Submission | undefined = body?.submission;

    if (!submission) {
      return new Response(JSON.stringify({ error: "submission manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullName =
      `${submission.first_name || ""} ${submission.last_name || ""}`.trim() ||
      "Client";

    const statusLabel = getStatusLabel(submission.status);
    const adminMessage = submission.admin_message?.trim();
    const toEmail = submission.email || "";

    if (!toEmail) {
      throw new Error("Email destinataire manquant");
    }

    const subject = `Votre demande de points a été ${statusLabel}`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #192021; line-height: 1.6;">
        <h2>Votre demande de points a été ${escapeHtml(statusLabel)}</h2>
        <p>Bonjour ${escapeHtml(fullName)},</p>
        <p>Le statut de votre demande a été mis à jour.</p>
        <ul>
          <li><strong>Produit :</strong> ${escapeHtml(submission.fuel || "Non renseigné")}</li>
          <li><strong>Quantité :</strong> ${escapeHtml(String(submission.quantity ?? 0))}</li>
          <li><strong>Points estimés :</strong> ${escapeHtml(String(submission.estimated_points ?? 0))}</li>
          <li><strong>Points attribués :</strong> ${escapeHtml(String(submission.points_awarded ?? 0))}</li>
          <li><strong>Statut :</strong> ${escapeHtml(statusLabel)}</li>
        </ul>
        ${
          adminMessage
            ? `<p><strong>Message de l’équipe :</strong><br />${escapeHtml(adminMessage)}</p>`
            : ""
        }
        <p>Merci pour votre participation au programme Qlima Premium Club.</p>
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
        to: [toEmail],
        reply_to: MAIL_REPLY_TO ? [MAIL_REPLY_TO] : undefined,
        subject,
        html,
      }),
    });

    const resendData = await resendResponse.text();

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Erreur Resend", details: resendData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});