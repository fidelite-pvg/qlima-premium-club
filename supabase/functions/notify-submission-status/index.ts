const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_FROM = Deno.env.get("MAIL_FROM");
const MAIL_REPLY_TO = Deno.env.get("MAIL_REPLY_TO");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

type Submission = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  fuel?: string | null;
  quantity?: number | null;
  estimated_points?: number | null;
  comments?: string | null;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY manquant");
    if (!MAIL_FROM) throw new Error("MAIL_FROM manquant");
    if (!ADMIN_EMAIL) throw new Error("ADMIN_EMAIL manquant");

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
      "Client inconnu";

    const subject = "Nouvelle demande de fidélité à vérifier";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #192021; line-height: 1.6;">
        <h2>Nouvelle demande reçue</h2>
        <p>Une nouvelle demande de fidélité a été soumise.</p>
        <ul>
          <li><strong>Nom :</strong> ${escapeHtml(fullName)}</li>
          <li><strong>Email :</strong> ${escapeHtml(submission.email || "Non renseigné")}</li>
          <li><strong>Combustible :</strong> ${escapeHtml(submission.fuel || "Non renseigné")}</li>
          <li><strong>Quantité :</strong> ${escapeHtml(String(submission.quantity ?? ""))}</li>
          <li><strong>Points estimés :</strong> ${escapeHtml(String(submission.estimated_points ?? 0))}</li>
        </ul>
        ${
          submission.comments
            ? `<p><strong>Commentaire :</strong><br>${escapeHtml(submission.comments)}</p>`
            : ""
        }
        <p>Connectez-vous à l’administration pour traiter la demande.</p>
      </div>
    `;

    const text = `Nouvelle demande reçue

Nom : ${fullName}
Email : ${submission.email || "Non renseigné"}
Combustible : ${submission.fuel || "Non renseigné"}
Quantité : ${submission.quantity ?? ""}
Points estimés : ${submission.estimated_points ?? 0}

${submission.comments ? `Commentaire : ${submission.comments}\n\n` : ""}Connectez-vous à l’administration pour traiter la demande.`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [ADMIN_EMAIL],
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: resendData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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