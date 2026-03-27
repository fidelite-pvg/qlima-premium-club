const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_FROM = Deno.env.get("MAIL_FROM");
const MAIL_REPLY_TO = Deno.env.get("MAIL_REPLY_TO");

type Submission = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  status?: string | null;
  admin_message?: string | null;
  points_awarded?: number | null;
  estimated_points?: number | null;
  fuel?: string | null;
  quantity?: number | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildEmailContent(submission: Submission) {
  const firstName = submission.first_name?.trim() || "client";
  const adminMessage = submission.admin_message?.trim() || "";
  const safeMessage = adminMessage ? escapeHtml(adminMessage) : "";
  const points = submission.points_awarded ?? submission.estimated_points ?? 0;

  let subject = "Mise à jour de votre demande Qlima Premium Club";
  let html = "";
  let text = "";

  if (submission.status === "validated") {
    subject = "Votre demande Qlima Premium Club a été validée";

    html = `
      <div style="font-family: Arial, sans-serif; color: #192021; line-height: 1.6;">
        <h2>Bonjour ${escapeHtml(firstName)},</h2>
        <p>Bonne nouvelle : votre demande a bien été <strong>validée</strong>.</p>
        <p><strong>Points attribués :</strong> ${points}</p>
        ${
          safeMessage
            ? `<p><strong>Message de notre équipe :</strong><br>${safeMessage}</p>`
            : ""
        }
        <p>Merci de votre fidélité.</p>
        <p>L’équipe Qlima Premium Club</p>
      </div>
    `;

    text = `Bonjour ${firstName},

Bonne nouvelle : votre demande a bien été validée.

Points attribués : ${points}

${adminMessage ? `Message de notre équipe : ${adminMessage}\n\n` : ""}Merci de votre fidélité.

L’équipe Qlima Premium Club`;
  } else if (submission.status === "rejected") {
    subject = "Votre demande Qlima Premium Club n’a pas pu être validée";

    html = `
      <div style="font-family: Arial, sans-serif; color: #192021; line-height: 1.6;">
        <h2>Bonjour ${escapeHtml(firstName)},</h2>
        <p>Votre demande n’a pas pu être <strong>validée</strong>.</p>
        ${
          safeMessage
            ? `<p><strong>Précision de notre équipe :</strong><br>${safeMessage}</p>`
            : ""
        }
        <p>Vous pouvez vérifier votre dossier et effectuer une nouvelle demande si nécessaire.</p>
        <p>L’équipe Qlima Premium Club</p>
      </div>
    `;

    text = `Bonjour ${firstName},

Votre demande n’a pas pu être validée.

${adminMessage ? `Précision de notre équipe : ${adminMessage}\n\n` : ""}Vous pouvez vérifier votre dossier et effectuer une nouvelle demande si nécessaire.

L’équipe Qlima Premium Club`;
  } else if (submission.status === "needs_info") {
    subject = "Des informations complémentaires sont nécessaires";

    html = `
      <div style="font-family: Arial, sans-serif; color: #192021; line-height: 1.6;">
        <h2>Bonjour ${escapeHtml(firstName)},</h2>
        <p>Votre demande nécessite des <strong>informations complémentaires</strong>.</p>
        ${
          safeMessage
            ? `<p><strong>Complément demandé :</strong><br>${safeMessage}</p>`
            : ""
        }
        <p>Merci de compléter votre dossier afin que nous puissions poursuivre son traitement.</p>
        <p>L’équipe Qlima Premium Club</p>
      </div>
    `;

    text = `Bonjour ${firstName},

Votre demande nécessite des informations complémentaires.

${adminMessage ? `Complément demandé : ${adminMessage}\n\n` : ""}Merci de compléter votre dossier afin que nous puissions poursuivre son traitement.

L’équipe Qlima Premium Club`;
  } else {
    html = `
      <div style="font-family: Arial, sans-serif; color: #192021; line-height: 1.6;">
        <h2>Bonjour ${escapeHtml(firstName)},</h2>
        <p>Le statut de votre demande a été mis à jour.</p>
        ${
          safeMessage
            ? `<p><strong>Message de notre équipe :</strong><br>${safeMessage}</p>`
            : ""
        }
        <p>L’équipe Qlima Premium Club</p>
      </div>
    `;

    text = `Bonjour ${firstName},

Le statut de votre demande a été mis à jour.

${adminMessage ? `Message de notre équipe : ${adminMessage}\n\n` : ""}L’équipe Qlima Premium Club`;
  }

  return { subject, html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY manquant");
    }

    if (!MAIL_FROM) {
      throw new Error("MAIL_FROM manquant");
    }

    const body = await req.json();
    const submission: Submission | undefined = body?.submission;

    if (!submission) {
      return new Response(JSON.stringify({ error: "submission manquant" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (!submission.email) {
      return new Response(
        JSON.stringify({ error: "email client manquant" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { subject, html, text } = buildEmailContent(submission);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [submission.email],
        reply_to: MAIL_REPLY_TO ? [MAIL_REPLY_TO] : undefined,
        subject,
        html,
        text,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      return new Response(JSON.stringify(resendData), {
        status: resendResponse.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify({ success: true, data: resendData }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});