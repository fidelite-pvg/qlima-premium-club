const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_FROM = Deno.env.get("MAIL_FROM");
const MAIL_REPLY_TO = Deno.env.get("MAIL_REPLY_TO");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

type Redemption = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  reward_title?: string | null;
  reward_type?: string | null;
  points_used?: number | null;
  rib?: string | null;
  iban?: string | null;
  bank_account_holder?: string | null;
  status?: string | null;
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
    const redemption: Redemption | undefined = body?.redemption;

    if (!redemption) {
      return new Response(JSON.stringify({ error: "redemption manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullName =
      `${redemption.first_name || ""} ${redemption.last_name || ""}`.trim() ||
      "Client inconnu";

    const subject = "Nouvelle demande de récompense à traiter";

    const bankBlock =
      redemption.reward_type === "refund"
        ? `
          <li><strong>RIB :</strong> ${escapeHtml(redemption.rib || "Non renseigné")}</li>
          <li><strong>IBAN :</strong> ${escapeHtml(redemption.iban || "Non renseigné")}</li>
          <li><strong>Titulaire du compte :</strong> ${escapeHtml(redemption.bank_account_holder || "Non renseigné")}</li>
        `
        : "";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #192021; line-height: 1.6;">
        <h2>Nouvelle récompense demandée</h2>
        <p>Un client a utilisé ses points pour demander une récompense.</p>
        <ul>
          <li><strong>Nom :</strong> ${escapeHtml(fullName)}</li>
          <li><strong>Email :</strong> ${escapeHtml(redemption.email || "Non renseigné")}</li>
          <li><strong>Récompense :</strong> ${escapeHtml(redemption.reward_title || "Non renseigné")}</li>
          <li><strong>Type :</strong> ${escapeHtml(redemption.reward_type || "standard")}</li>
          <li><strong>Points utilisés :</strong> ${escapeHtml(String(redemption.points_used ?? 0))}</li>
          <li><strong>Statut :</strong> ${escapeHtml(redemption.status || "pending")}</li>
          ${bankBlock}
        </ul>
        <p>Connectez-vous à l’administration pour traiter cette demande.</p>
      </div>
    `;

    const text = `Nouvelle récompense demandée

Nom : ${fullName}
Email : ${redemption.email || "Non renseigné"}
Récompense : ${redemption.reward_title || "Non renseigné"}
Type : ${redemption.reward_type || "standard"}
Points utilisés : ${redemption.points_used ?? 0}
Statut : ${redemption.status || "pending"}
${redemption.reward_type === "refund" ? `RIB : ${redemption.rib || "Non renseigné"}
IBAN : ${redemption.iban || "Non renseigné"}
Titulaire du compte : ${redemption.bank_account_holder || "Non renseigné"}
` : ""}
Connectez-vous à l’administration pour traiter cette demande.`;

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