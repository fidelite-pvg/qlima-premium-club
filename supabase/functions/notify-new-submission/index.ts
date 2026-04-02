import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "fidelite@pvg.eu";
const MAIL_FROM =
  Deno.env.get("MAIL_FROM") || "Fidélité Qlima <no-reply@fidelite.qlima.fr>";
const MAIL_REPLY_TO = Deno.env.get("MAIL_REPLY_TO") || ADMIN_EMAIL;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const { submission } = await req.json();

    const fullName =
      `${submission?.first_name || ""} ${submission?.last_name || ""}`.trim() ||
      "Non renseigné";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #101828;">
        <h2>Nouvelle demande de validation de points</h2>
        <ul>
          <li><strong>Nom :</strong> ${escapeHtml(fullName)}</li>
          <li><strong>Email :</strong> ${escapeHtml(submission?.email || "Non renseigné")}</li>
          <li><strong>Produit :</strong> ${escapeHtml(submission?.product_name || "Non renseigné")}</li>
          <li><strong>Points :</strong> ${submission?.points ?? 0}</li>
          <li><strong>Statut :</strong> ${escapeHtml(submission?.status || "pending")}</li>
        </ul>
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
        to: [ADMIN_EMAIL],
        reply_to: MAIL_REPLY_TO ? [MAIL_REPLY_TO] : undefined,
        subject: "Nouvelle demande de points",
        html,
      }),
    });

    const resendData = await resendResponse.text();

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Erreur Resend", details: resendData }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});