import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { supabase } from "./lib/supabase";

const fuels = [
  { name: "Kristal Shine", points: 4 },
  { name: "Bright 20 L", points: 3 },
  { name: "Spark 20 L", points: 2 },
  { name: "Bright 10 L", points: 1 },
  { name: "Pure 20 L", points: 1 },
];

const rewards = [
  { points: 10, title: "1 an de garantie supplémentaire" },
  { points: 15, title: "12€ remboursés" },
  { points: 20, title: "Pompe à combustible liquide électrique Qlima offerte" },
  {
    points: 40,
    title:
      "50€ remboursés sur l'achat d'un appareil à combustible liquide Qlima",
  },
  { points: 60, title: "Un bidon de Kristal Shine remboursé" },
  { points: 80, title: "Un poêle à combustible liquide SRE 4035 C offert" },
  { points: 100, title: "Un poêle à combustible liquide SRE 9046 C-2 offert" },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [selectedReward, setSelectedReward] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  const [authForm, setAuthForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
  });

  const [purchaseForm, setPurchaseForm] = useState({
    fuel: "Kristal Shine",
    qty: 1,
    purchaseDate: "",
    invoiceNumber: "",
    comments: "",
  });

  useEffect(() => {
    const getInitialSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setLoading(false);
    };

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchSubmissions();
    }
  }, [session]);

  const estimatedPoints = useMemo(() => {
    const selectedFuel = fuels.find((fuel) => fuel.name === purchaseForm.fuel);
    return selectedFuel
      ? selectedFuel.points * Number(purchaseForm.qty || 0)
      : 0;
  }, [purchaseForm]);

  const userPoints = useMemo(() => {
    return submissions
      .filter((item) => item.status === "validated")
      .reduce((acc, item) => acc + (item.points_awarded || 0), 0);
  }, [submissions]);

  const nextReward = useMemo(() => {
    return rewards.find((reward) => reward.points > userPoints) || null;
  }, [userPoints]);

  const progressPercent = nextReward
    ? Math.min((userPoints / nextReward.points) * 100, 100)
    : 100;

  const handleAuthChange = (field, value) => {
    setAuthForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePurchaseChange = (field, value) => {
    setPurchaseForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(files);
  };

  const signUp = async (e) => {
    e.preventDefault();
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.password,
      options: {
        data: {
          first_name: authForm.firstName,
          last_name: authForm.lastName,
          phone: authForm.phone,
          address: authForm.address,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.user) {
      setMessage(
        "Compte créé avec succès. Vous pouvez maintenant vous connecter.",
      );
      setMode("login");
    }
  };

  const signIn = async (e) => {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: authForm.email,
      password: authForm.password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSubmissions([]);
    setUploadedFiles([]);
    setSelectedReward("");
  };

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from("loyalty_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSubmissions(data);
    }
  };

  const uploadFiles = async () => {
    if (!session?.user || uploadedFiles.length === 0) return [];

    const uploaded = [];

    for (const file of uploadedFiles) {
      const extension = file.name.split(".").pop();
      const uniqueName = `${session.user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error } = await supabase.storage
        .from("loyalty-documents")
        .upload(uniqueName, file);

      if (error) throw error;

      uploaded.push({
        file_name: file.name,
        file_path: uniqueName,
      });
    }

    return uploaded;
  };

  const handleSubmitPurchase = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const uploaded = await uploadFiles();

      const { error } = await supabase.from("loyalty_submissions").insert({
        user_id: session.user.id,
        first_name:
          session.user.user_metadata?.first_name || authForm.firstName || "",
        last_name:
          session.user.user_metadata?.last_name || authForm.lastName || "",
        email: session.user.email,
        phone: session.user.user_metadata?.phone || authForm.phone || "",
        address: session.user.user_metadata?.address || authForm.address || "",
        fuel: purchaseForm.fuel,
        quantity: Number(purchaseForm.qty),
        purchase_date: purchaseForm.purchaseDate || null,
        invoice_number: purchaseForm.invoiceNumber,
        comments: purchaseForm.comments,
        estimated_points: estimatedPoints,
        points_awarded: 0,
        status: "pending",
        documents: uploaded,
      });

      if (error) throw error;

      setMessage("Votre demande a bien été envoyée.");
      setPurchaseForm({
        fuel: "Kristal Shine",
        qty: 1,
        purchaseDate: "",
        invoiceNumber: "",
        comments: "",
      });
      setUploadedFiles([]);
      fetchSubmissions();
    } catch (error) {
      setMessage(error.message || "Erreur lors de l’envoi.");
    }
  };

  if (loading) {
    return <div className="center-screen">Chargement...</div>;
  }

  if (!session) {
    return (
      <div className="page">
        <section className="hero-shell">
          <div className="hero-brandbar">
            <span>Qlima.fr</span>
            <span>|</span>
            <span>Comfortable living</span>
          </div>

          <img src="/qlima-logo.png" alt="Qlima" className="hero-logo" />

          <div className="hero-shape">
            <h1>Qlima Premium Club</h1>
            <p>Votre programme de fidélité en ligne</p>
          </div>

          <div className="hero-content">
            <div className="hero-left">
              <div className="intro-card">
                <h2>Bien chez vous, même dans la fidélité</h2>
                <p>
                  Déposez vos justificatifs d’achat, cumulez vos points et
                  choisissez vos récompenses dans un espace simple, clair et
                  rassurant.
                </p>

                <div className="feature-grid">
                  <div className="feature-card">
                    <span className="feature-number">01</span>
                    <h3>Dépôt de preuves</h3>
                    <p>Factures, tickets de caisse et documents utiles.</p>
                  </div>

                  <div className="feature-card">
                    <span className="feature-number">02</span>
                    <h3>Cumul de points</h3>
                    <p>Suivi clair de vos participations et validations.</p>
                  </div>

                  <div className="feature-card">
                    <span className="feature-number">03</span>
                    <h3>Choix du cadeau</h3>
                    <p>
                      Un catalogue visible selon le nombre de points acquis.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-right">
              <div className="auth-panel">
                <h2>{mode === "login" ? "Accès client" : "Créer un compte"}</h2>
                <p className="muted">
                  {mode === "login"
                    ? "Connectez-vous pour accéder à votre espace fidélité."
                    : "Créez votre compte pour participer au programme de fidélité."}
                </p>

                <div className="auth-buttons">
                  <button
                    type="button"
                    className={`btn ${mode === "login" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => {
                      setMode("login");
                      setMessage("");
                    }}
                  >
                    Connexion
                  </button>
                  <button
                    type="button"
                    className={`btn ${mode === "register" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => {
                      setMode("register");
                      setMessage("");
                    }}
                  >
                    Inscription
                  </button>
                </div>

                <form onSubmit={mode === "login" ? signIn : signUp}>
                  {mode === "register" && (
                    <>
                      <div className="form-row">
                        <div className="form-block">
                          <label>Prénom</label>
                          <input
                            type="text"
                            value={authForm.firstName}
                            onChange={(e) =>
                              handleAuthChange("firstName", e.target.value)
                            }
                            required
                          />
                        </div>

                        <div className="form-block">
                          <label>Nom</label>
                          <input
                            type="text"
                            value={authForm.lastName}
                            onChange={(e) =>
                              handleAuthChange("lastName", e.target.value)
                            }
                            required
                          />
                        </div>
                      </div>

                      <div className="form-block">
                        <label>Téléphone</label>
                        <input
                          type="text"
                          value={authForm.phone}
                          onChange={(e) =>
                            handleAuthChange("phone", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-block">
                        <label>Adresse postale</label>
                        <textarea
                          rows="3"
                          value={authForm.address}
                          onChange={(e) =>
                            handleAuthChange("address", e.target.value)
                          }
                        />
                      </div>
                    </>
                  )}

                  <div className="form-block">
                    <label>Adresse e-mail</label>
                    <input
                      type="email"
                      value={authForm.email}
                      onChange={(e) =>
                        handleAuthChange("email", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="form-block">
                    <label>Mot de passe</label>
                    <input
                      type="password"
                      value={authForm.password}
                      onChange={(e) =>
                        handleAuthChange("password", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="auth-buttons">
                    <button type="submit" className="btn btn-primary">
                      {mode === "login" ? "Se connecter" : "Créer mon compte"}
                    </button>
                  </div>

                  {message ? <p className="muted">{message}</p> : null}
                </form>
              </div>
            </div>
          </div>

          <div className="hero-footer">
            <span>Qlima.fr</span>
            <span>|</span>
            <span>Comfortable living</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="topbar">
        <div className="topbar-left">
          <div>
            <p className="topbar-subtitle">Qlima Premium Club</p>
            <h1>Espace fidélité client</h1>
          </div>
        </div>

        <div className="topbar-right">
          <span className="points-chip">{userPoints} points validés</span>
          <img src="/qlima-logo.png" alt="Qlima" className="topbar-logo" />
          <button className="btn btn-secondary" onClick={signOut}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="left-column">
          <div className="panel soft-panel">
            <div className="section-shape">
              <h2>
                Bonjour{" "}
                {session.user.user_metadata?.first_name ||
                  authForm.firstName ||
                  "client"}
              </h2>
              <p>Suivez vos points et vos récompenses.</p>
            </div>

            <div className="stats-grid">
              <div className="stat-box">
                <span>Points validés</span>
                <strong>{userPoints}</strong>
              </div>

              <div className="stat-box">
                <span>Prochaine récompense</span>
                <strong>
                  {nextReward
                    ? `${nextReward.points} points`
                    : "Palier max atteint"}
                </strong>
              </div>

              <div className="stat-box">
                <span>Statut</span>
                <strong>Compte actif</strong>
              </div>
            </div>

            <div className="progress-block">
              <div className="progress-label">
                <span>Progression</span>
                <span>
                  {userPoints}/{nextReward ? nextReward.points : userPoints}{" "}
                  points
                </span>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>

              {nextReward && (
                <p className="muted">
                  Encore {nextReward.points - userPoints} points pour obtenir{" "}
                  <strong>{nextReward.title}</strong>.
                </p>
              )}
            </div>
          </div>

          <div className="panel">
            <h2>Déposer une preuve d’achat</h2>
            <p className="muted">
              Ajoutez vos documents pour vérification par notre équipe.
            </p>

            <form onSubmit={handleSubmitPurchase}>
              <div className="form-row">
                <div className="form-block">
                  <label>Produit acheté</label>
                  <select
                    value={purchaseForm.fuel}
                    onChange={(e) =>
                      handlePurchaseChange("fuel", e.target.value)
                    }
                  >
                    {fuels.map((fuel) => (
                      <option key={fuel.name} value={fuel.name}>
                        {fuel.name} — {fuel.points} point
                        {fuel.points > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-block">
                  <label>Quantité</label>
                  <input
                    type="number"
                    min="1"
                    value={purchaseForm.qty}
                    onChange={(e) =>
                      handlePurchaseChange("qty", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-block">
                  <label>Date d’achat</label>
                  <input
                    type="date"
                    value={purchaseForm.purchaseDate}
                    onChange={(e) =>
                      handlePurchaseChange("purchaseDate", e.target.value)
                    }
                  />
                </div>

                <div className="form-block">
                  <label>Numéro de facture</label>
                  <input
                    type="text"
                    value={purchaseForm.invoiceNumber}
                    onChange={(e) =>
                      handlePurchaseChange("invoiceNumber", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="form-block">
                <label>Déposer les justificatifs</label>
                <input type="file" multiple onChange={handleFiles} />

                {uploadedFiles.length > 0 && (
                  <ul className="file-list">
                    {uploadedFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`}>{file.name}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="form-block">
                <label>Commentaires</label>
                <textarea
                  rows="4"
                  placeholder="Informations utiles pour l’équipe de vérification"
                  value={purchaseForm.comments}
                  onChange={(e) =>
                    handlePurchaseChange("comments", e.target.value)
                  }
                ></textarea>
              </div>

              <div className="notice-box">
                Cette demande pourrait rapporter{" "}
                <strong>
                  {estimatedPoints} point{estimatedPoints > 1 ? "s" : ""}
                </strong>{" "}
                après validation.
              </div>

              <button type="submit" className="btn btn-primary">
                Envoyer ma demande
              </button>

              {message ? <p className="muted">{message}</p> : null}
            </form>
          </div>

          <div className="panel">
            <h2>Mes demandes</h2>

            <div className="submission-list">
              {submissions.length === 0 ? (
                <p className="muted">Aucune demande envoyée pour le moment.</p>
              ) : (
                submissions.map((submission) => (
                  <div key={submission.id} className="submission-item">
                    <div>
                      <strong>{submission.fuel}</strong>
                      <p className="muted">
                        Quantité : {submission.quantity} • Estimation :{" "}
                        {submission.estimated_points} pts
                      </p>
                    </div>

                    <div className="submission-right">
                      <span className="mini-chip">
                        {submission.status === "pending"
                          ? "En attente"
                          : submission.status === "validated"
                            ? "Validé"
                            : submission.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="right-column">
          <div className="panel">
            <h2>Catalogue des récompenses</h2>

            <div className="reward-list">
              {rewards.map((reward) => {
                const available = userPoints >= reward.points;

                return (
                  <div
                    key={reward.points}
                    className={`reward-item ${available ? "available" : ""}`}
                  >
                    <div>
                      <strong>{reward.title}</strong>
                      <p className="muted">{reward.points} points requis</p>
                    </div>

                    <button
                      type="button"
                      className={`btn ${available ? "btn-primary" : "btn-secondary"}`}
                      disabled={!available}
                      onClick={() => setSelectedReward(reward.title)}
                    >
                      {available ? "Choisir" : "Indisponible"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <h2>Récompense sélectionnée</h2>

            {selectedReward ? (
              <div className="selected-reward">
                <strong>{selectedReward}</strong>
                <p className="muted">
                  Votre sélection est enregistrée localement pour le moment.
                </p>
              </div>
            ) : (
              <p className="muted">
                Aucune récompense sélectionnée pour le moment.
              </p>
            )}
          </div>

          <div className="panel forest-panel">
            <h2>Informations utiles</h2>
            <ul className="info-list">
              <li>Offre valable du 01/09/2025 au 30/06/2026</li>
              <li>
                PVG France – 200 Avenue de la Mare Sansoure, Immeuble B2, 76650
                Petit-Couronne
              </li>
              <li>fidelite@pvg.eu</li>
              <li>02 32 96 07 70</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
