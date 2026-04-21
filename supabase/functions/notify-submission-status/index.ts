const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_FROM =
  Deno.env.get("MAIL_FROM") || "Qlima Premium Club <onboarding@resend.dev>";
const MAIL_REPLY_TO = Deno.env.get("MAIL_REPLY_TO");

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY manquant");

    const body = await req.json();
    const submission = body?.submission;

    const customerEmail = String(submission?.email || "").trim().toLowerCase();

    console.log("notify-submission-status called", {
      customerEmail,
      status: submission?.status,
      fuel: submission?.fuel,
      quantity: submission?.quantity,
      estimated_points: submission?.estimated_points,
      points_awarded: submission?.points_awarded,
    });

    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: "Email du client manquant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fullName =
      `${submission.first_name || ""} ${submission.last_name || ""}`.trim() ||
      "Client";
    const statusLabel = getStatusLabel(submission.status);
    const adminMessage = submission.admin_message?.trim();

    const adminMessageBlock = adminMessage
      ? `<p><strong>Message de notre équipe :</strong><br>${nl2br(adminMessage)}</p>`
      : "";

    const pointsBlock =
      submission.status === "validated" && submission.points_awarded
        ? `<p><strong>Points attribués :</strong> ${escapeHtml(String(submission.points_awarded))} points</p>`
        : "";

    const statusSpecificIntro =
      submission.status === "needs_info"
        ? "Notre équipe a besoin d’un complément pour poursuivre le traitement de votre dossier."
        : submission.status === "rejected"
          ? "Après étude, votre demande n’a pas pu être acceptée."
          : submission.status === "validated"
            ? "Bonne nouvelle, votre demande a été validée."
            : "Le statut de votre demande a été mis à jour.";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #192021; line-height: 1.6;">
        <h2>Votre demande de points a été ${escapeHtml(statusLabel)}</h2>
        <p>Bonjour ${escapeHtml(fullName)},</p>
        <p>${escapeHtml(statusSpecificIntro)}</p>
        <ul>
          <li><strong>Produit :</strong> ${escapeHtml(submission.fuel || "Non renseigné")}</li>
          <li><strong>Quantité :</strong> ${escapeHtml(String(submission.quantity ?? 0))}</li>
          <li><strong>Points estimés :</strong> ${escapeHtml(String(submission.estimated_points ?? 0))}</li>
          <li><strong>Statut :</strong> ${escapeHtml(statusLabel)}</li>
        </ul>
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
        to: [customerEmail],
        reply_to: MAIL_REPLY_TO ? [MAIL_REPLY_TO] : undefined,
        subject:
          submission.status === "needs_info"
            ? "Votre dossier doit être complété"
            : submission.status === "validated"
              ? "Votre demande de points a été validée"
              : submission.status === "rejected"
                ? "Votre demande de points a été refusée"
                : `Votre demande de points — ${statusLabel}`,
        html,
      }),
    });

    const resendData = await resendResponse.text();

    console.log("Resend response notify-submission-status", {
      customerEmail,
      status: submission?.status,
      resendStatus: resendResponse.status,
      resendData,
    });

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
    console.error("Erreur notify-submission-status :", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});