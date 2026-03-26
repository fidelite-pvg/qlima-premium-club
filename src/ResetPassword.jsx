import { useState } from "react";
import { supabase } from "./lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setMessage("");

    if (password.length < 6) {
      setMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Votre mot de passe a bien été mis à jour. Vous pouvez maintenant vous connecter.",
    );
  };

  return (
    <div className="page">
      <section className="hero-shell">
        <div
          className="auth-panel"
          style={{ maxWidth: "500px", margin: "80px auto" }}
        >
          <h2>Réinitialiser mon mot de passe</h2>
          <p className="muted">Saisissez votre nouveau mot de passe.</p>

          <form onSubmit={handleUpdatePassword}>
            <div className="form-block">
              <label>Nouveau mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-block">
              <label>Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading
                ? "Mise à jour..."
                : "Enregistrer mon nouveau mot de passe"}
            </button>

            {message ? <p className="muted">{message}</p> : null}
          </form>
        </div>
      </section>
    </div>
  );
}
