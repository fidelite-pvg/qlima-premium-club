<<<<<<< HEAD
﻿const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_FROM = Deno.env.get("MAIL_FROM");
const MAIL_REPLY_TO = Deno.env.get("MAIL_REPLY_TO");

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
=======
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
>>>>>>> 9142eab5a4e1f65e272e6d96a1392c84576ab7cf

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

<<<<<<< HEAD
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
    default:
      return status || "mise à jour";
  }
}

Deno.serve(async (req: Request) => {
=======
serve(async (req) => {
>>>>>>> 9142eab5a4e1f65e272e6d96a1392c84576ab7cf
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
<<<<<<< HEAD
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY manquant");
    if (!MAIL_FROM) throw new Error("MAIL_FROM manquant");
    const body = await req.json();
    const submission: Submission | undefined = body?.submission;
    const redemption: Redemption | undefined = body?.redemption;

    if (!submission && !redemption) {
      return new Response(
        JSON.stringify({ error: "submission ou redemption manquant" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let toEmail = "";
    let subject = "";
    let html = "";
    let text = "";

    if (submission) {
      const fullName =
        `${submission.first_name || ""} ${submission.last_name || ""}`.trim() ||
        "Client";
      const statusLabel = getStatusLabel(submission.status);
      const adminMessage = submission.admin_message?.trim();

      toEmail = submission.email || "";
      subject = `Votre demande de points a été ${statusLabel}`;
      html = `
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
      text = `Votre demande de points a été ${statusLabel}

Bonjour ${fullName},

Le statut de votre demande a été mis à jour.
Produit : ${submission.fuel || "Non renseigné"}
Quantité : ${submission.quantity ?? 0}
Points estimés : ${submission.estimated_points ?? 0}
Points attribués : ${submission.points_awarded ?? 0}
Statut : ${statusLabel}
${adminMessage ? `Message de l’équipe : ${adminMessage}` : ""}

Merci pour votre participation au programme Qlima Premium Club.`;
    } else if (redemption) {
      const fullName =
        `${redemption.first_name || ""} ${redemption.last_name || ""}`.trim() ||
        "Client";
      const statusLabel = getStatusLabel(redemption.status);

      toEmail = redemption.email || "";
      subject = `Votre demande de récompense a été ${statusLabel}`;
      html = `
        <div style="font-family: Arial, sans-serif; color: #192021; line-height: 1.6;">
          <h2>Votre demande de récompense a été ${escapeHtml(statusLabel)}</h2>
          <p>Bonjour ${escapeHtml(fullName)},</p>
          <p>Le statut de votre demande de récompense a été mis à jour.</p>
          <ul>
            <li><strong>Récompense :</strong> ${escapeHtml(redemption.reward_title || "Non renseigné")}</li>
            <li><strong>Type :</strong> ${escapeHtml(redemption.reward_type || "standard")}</li>
            <li><strong>Points utilisés :</strong> ${escapeHtml(String(redemption.points_used ?? 0))}</li>
            <li><strong>Statut :</strong> ${escapeHtml(statusLabel)}</li>
          </ul>
          <p>Merci pour votre fidélité à Qlima Premium Club.</p>
        </div>
      `;
      text = `Votre demande de récompense a été ${statusLabel}

Bonjour ${fullName},

Le statut de votre demande de récompense a été mis à jour.
Récompense : ${redemption.reward_title || "Non renseigné"}
Type : ${redemption.reward_type || "standard"}
Points utilisés : ${redemption.points_used ?? 0}
Statut : ${statusLabel}

Merci pour votre fidélité à Qlima Premium Club.`;
    }

    if (!toEmail) {
      throw new Error("Email destinataire manquant");
    }

=======
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

>>>>>>> 9142eab5a4e1f65e272e6d96a1392c84576ab7cf
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
<<<<<<< HEAD
        to: [toEmail],
        reply_to: MAIL_REPLY_TO ? [MAIL_REPLY_TO] : undefined,
        subject,
=======
        to: [submission.email],
        subject: `Votre demande de points — ${statusLabel}`,
>>>>>>> 9142eab5a4e1f65e272e6d96a1392c84576ab7cf
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
<<<<<<< HEAD


=======
>>>>>>> 9142eab5a4e1f65e272e6d96a1392c84576ab7cf
