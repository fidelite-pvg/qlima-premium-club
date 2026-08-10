// Traduit les messages d'erreur Supabase (souvent en anglais) en français.
const TRANSLATIONS = [
  [/invalid login credentials/i, "Connexion impossible : soit le mot de passe est incorrect, soit l’adresse e-mail n’a pas encore été confirmée. Utilisez “Mot de passe oublié” si besoin."],
  [/email not confirmed/i, "Votre adresse e-mail n’a pas encore été confirmée. Vérifiez votre boîte mail (et vos spams)."],
  [/user already registered|already been registered|user already exists/i, "Un compte existe déjà avec cette adresse e-mail. Essayez de vous connecter ou de réinitialiser votre mot de passe."],
  [/password should be at least (\d+) characters/i, (m) => `Le mot de passe doit contenir au moins ${m[1]} caractères.`],
  [/new password should be different from the old password/i, "Le nouveau mot de passe doit être différent de l’ancien."],
  [/unable to validate email address.*invalid format/i, "L’adresse e-mail saisie n’est pas valide."],
  [/email rate limit exceeded|rate limit/i, "Trop de tentatives ont été effectuées. Merci de patienter quelques minutes avant de réessayer."],
  [/for security purposes.*after (\d+) seconds/i, (m) => `Pour des raisons de sécurité, merci de patienter ${m[1]} secondes avant de réessayer.`],
  [/token has expired or is invalid|invalid or expired/i, "Le lien utilisé a expiré ou n’est plus valide. Merci de refaire une demande."],
  [/user not found/i, "Aucun compte n’a été trouvé avec cette adresse e-mail."],
  [/auth session missing/i, "Votre session a expiré. Merci de vous reconnecter."],
  [/network error|failed to fetch/i, "Problème de connexion réseau. Vérifiez votre connexion internet et réessayez."],
];

export function translateAuthError(message) {
  if (!message) return "Une erreur inattendue est survenue.";

  for (const [pattern, replacement] of TRANSLATIONS) {
    const match = message.match(pattern);
    if (match) {
      return typeof replacement === "function" ? replacement(match) : replacement;
    }
  }

  return message;
}
