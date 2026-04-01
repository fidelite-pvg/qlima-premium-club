import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { supabase } from "./lib/supabase";
import Admin from "./Admin";

const fuels = [
  { name: "Kristal Shine", points: 4 },
  { name: "Bright 20 L", points: 3 },
  { name: "Spark 20 L", points: 2 },
  { name: "Bright 10 L", points: 1 },
  { name: "Pure 20 L", points: 1 },
];

const rewards = [
  {
    points: 10,
    title: "1 an de garantie supplémentaire",
    type: "standard",
  },
  { points: 15, title: "12€ remboursés", type: "refund" },
  {
    points: 20,
    title: "Pompe à combustible liquide électrique Qlima offerte",
    type: "standard",
  },
  {
    points: 40,
    title:
      "50€ remboursés sur l'achat d'un appareil à combustible liquide Qlima",
    type: "refund",
  },
  { points: 60, title: "Un bidon de Kristal Shine remboursé", type: "refund" },
  {
    points: 80,
    title: "Un poêle à combustible liquide SRE 4035 C offert",
    type: "standard",
  },
  {
    points: 100,
    title: "Un poêle à combustible liquide SRE 9046 C-2 offert",
    type: "standard",
  },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [selectedReward, setSelectedReward] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [rewardRedemptions, setRewardRedemptions] = useState([]);
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [rewardModalMessage, setRewardModalMessage] = useState("");
  const [rewardForm, setRewardForm] = useState({
    rib: "",
    iban: "",
    accountHolder: "",
  });
  const [isSubmittingReward, setIsSubmittingReward] = useState(false);

  const [authForm, setAuthForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    postalCode: "",
    city: "",
  });

  const [purchaseForm, setPurchaseForm] = useState({
    fuel: "Kristal Shine",
    qty: 1,
    comments: "",
  });

  const isAdmin = session?.user?.email === "fidelite@pvg.eu";

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
    if (session?.user && !isAdmin) {
      fetchSubmissions();
      fetchRewardRedemptions();
    }
  }, [session, isAdmin]);

  const estimatedPoints = useMemo(() => {
    const selectedFuel = fuels.find((fuel) => fuel.name === purchaseForm.fuel);
    return selectedFuel
      ? selectedFuel.points * Number(purchaseForm.qty || 0)
      : 0;
  }, [purchaseForm]);

  const spentPoints = useMemo(() => {
    return rewardRedemptions
      .filter(
        (item) => item.status !== "cancelled" && item.status !== "rejected",
      )
      .reduce((acc, item) => acc + (item.points_used || 0), 0);
  }, [rewardRedemptions]);

  const userPoints = useMemo(() => {
    const earnedPoints = submissions
      .filter((item) => item.status === "validated")
      .reduce((acc, item) => acc + (item.points_awarded || 0), 0);

    return Math.max(earnedPoints - spentPoints, 0);
  }, [submissions, spentPoints]);

  const nextReward = useMemo(() => {
    return rewards.find((reward) => reward.points > userPoints) || null;
  }, [userPoints]);

  const progressPercent = nextReward
    ? Math.min((userPoints / nextReward.points) * 100, 100)
    : 100;

  const latestRedemption = rewardRedemptions[0] || null;

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

  const normalizedEmail = authForm.email.trim().toLowerCase();

  const formattedAddress = [
    authForm.address,
    authForm.postalCode,
    authForm.city,
  ]
    .filter(Boolean)
    .join(", ");

  const getStatusLabel = (status) => {
    switch (status) {
      case "validated":
        return "Validée";
      case "rejected":
        return "Refusée";
      case "needs_info":
        return "À compléter";
      default:
        return "En attente";
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "validated":
        return "status-chip status-validated";
      case "needs_info":
        return "status-chip status-needs-info";
      case "rejected":
        return "status-chip status-rejected";
      default:
        return "status-chip status-pending";
    }
  };

  const getRewardStatusLabel = (status) => {
    switch (status) {
      case "approved":
        return "Traitée";
      case "rejected":
        return "Refusée";
      case "cancelled":
        return "Annulée";
      default:
        return "En attente";
    }
  };

  const handleRewardFormChange = (field, value) => {
    setRewardForm((prev) => ({ ...prev, [field]: value }));
  };

  const openRewardModal = (reward) => {
    setSelectedReward(reward);
    setRewardModalOpen(true);
    setMessage("");
    setRewardModalMessage("");
  };

  const closeRewardModal = () => {
    setRewardModalOpen(false);
    setSelectedReward("");
    setRewardModalMessage("");
    setRewardForm({
      rib: "",
      iban: "",
      accountHolder: "",
    });
  };

  const signUp = async (e) => {
    e.preventDefault();
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: authForm.password,
      options: {
        data: {
          first_name: authForm.firstName,
          last_name: authForm.lastName,
          phone: authForm.phone,
          address: authForm.address,
          postal_code: authForm.postalCode,
          city: authForm.city,
          full_address: formattedAddress,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (
      data.user &&
      data.user.identities &&
      data.user.identities.length === 0
    ) {
      setMessage(
        "Un compte existe déjà avec cette adresse e-mail. Essayez de vous connecter ou de réinitialiser votre mot de passe.",
      );
      setMode("login");
      return;
    }

    if (data.session) {
      setMessage("Compte créé avec succès. Vous êtes maintenant connecté.");
      return;
    }

    if (data.user) {
      setMessage(
        "Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse e-mail avant de vous connecter.",
      );
      setMode("login");
    }
  };

  const signIn = async (e) => {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: authForm.password,
    });

    if (error) {
      if (error.message === "Invalid login credentials") {
        setMessage(
          "Connexion impossible : soit le mot de passe est incorrect, soit l’adresse e-mail n’a pas encore été confirmée. Utilisez “Mot de passe oublié” si besoin.",
        );
        return;
      }

      setMessage(error.message);
      return;
    }

    setMessage("");
  };

  const resetPassword = async () => {
    setMessage("");

    if (!normalizedEmail) {
      setMessage(
        "Saisissez votre adresse e-mail pour réinitialiser votre mot de passe.",
      );
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );

    if (error) {
      if (error.message?.toLowerCase().includes("rate limit")) {
        setMessage(
          "Trop de demandes d’e-mails ont été effectuées. Attendez un peu avant de réessayer.",
        );
        return;
      }

      setMessage(error.message);
      return;
    }

    setMessage(
      "Si un compte existe avec cette adresse, un e-mail de réinitialisation du mot de passe a été envoyé.",
    );
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSubmissions([]);
    setUploadedFiles([]);
    setSelectedReward("");
    setRewardRedemptions([]);
    setRewardModalOpen(false);
    setRewardModalMessage("");
  };

  const fetchSubmissions = async () => {
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("loyalty_submissions")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement demandes :", error);
      return;
    }

    setSubmissions(data || []);
  };

  const fetchRewardRedemptions = async () => {
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("reward_redemptions")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement historique récompenses :", error);
      return;
    }

    setRewardRedemptions(data || []);
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

      const submissionPayload = {
        user_id: session.user.id,
        first_name:
          session.user.user_metadata?.first_name || authForm.firstName || "",
        last_name:
          session.user.user_metadata?.last_name || authForm.lastName || "",
        email: session.user.email,
        phone: session.user.user_metadata?.phone || authForm.phone || "",
        address:
          session.user.user_metadata?.full_address ||
          [
            session.user.user_metadata?.address,
            session.user.user_metadata?.postal_code,
            session.user.user_metadata?.city,
          ]
            .filter(Boolean)
            .join(", ") ||
          formattedAddress ||
          "",
        fuel: purchaseForm.fuel,
        quantity: Number(purchaseForm.qty),
        comments: purchaseForm.comments,
        estimated_points: estimatedPoints,
        points_awarded: 0,
        status: "pending",
        documents: uploaded,
      };

      const { data: insertedSubmission, error } = await supabase
        .from("loyalty_submissions")
        .insert(submissionPayload)
        .select()
        .single();

      if (error) throw error;

      const { error: notifyError } = await supabase.functions.invoke(
        "notify-new-submission",
        {
          body: {
            submission: insertedSubmission,
          },
        },
      );

      if (notifyError) {
        console.error("Erreur envoi email admin :", notifyError.message);
        setMessage(
          `Votre demande a bien été envoyée, mais l’e-mail de notification admin a échoué : ${notifyError.message}`,
        );
      } else {
        setMessage("Votre demande a bien été envoyée.");
      }

      setPurchaseForm({
        fuel: "Kristal Shine",
        qty: 1,
        comments: "",
      });
      setUploadedFiles([]);
      fetchSubmissions();
    } catch (error) {
      setMessage(error.message || "Erreur lors de l’envoi.");
    }
  };

  const handleConfirmReward = async () => {
    if (!session?.user || !selectedReward) return;

    const isRefundReward = selectedReward.type === "refund";

    if (
      isRefundReward &&
      (!rewardForm.rib.trim() ||
        !rewardForm.iban.trim() ||
        !rewardForm.accountHolder.trim())
    ) {
      setRewardModalMessage(
        "Merci de renseigner le RIB, l’IBAN et le nom du titulaire du compte bancaire.",
      );
      return;
    }

    setMessage("");
    setRewardModalMessage("");
    setIsSubmittingReward(true);

    try {
      const redemptionPayload = {
        user_id: session.user.id,
        first_name:
          session.user.user_metadata?.first_name || authForm.firstName || "",
        last_name:
          session.user.user_metadata?.last_name || authForm.lastName || "",
        email: session.user.email,
        reward_title: selectedReward.title,
        reward_type: selectedReward.type,
        points_used: selectedReward.points,
        status: "pending",
        rib: isRefundReward ? rewardForm.rib.trim() : null,
        iban: isRefundReward ? rewardForm.iban.trim() : null,
        bank_account_holder: isRefundReward
          ? rewardForm.accountHolder.trim()
          : null,
      };

      const { data: insertedRedemption, error } = await supabase
        .from("reward_redemptions")
        .insert(redemptionPayload)
        .select()
        .single();

      if (error) {
        console.error("Erreur insertion reward_redemptions :", error);
        throw error;
      }

      const { error: notifyError } = await supabase.functions.invoke(
        "notify-reward-redemption",
        {
          body: {
            redemption: insertedRedemption,
          },
        },
      );

      if (notifyError) {
        console.error("Erreur envoi email admin récompense :", notifyError);
        setMessage(
          "Votre demande de récompense a bien été enregistrée, mais l’e-mail de notification admin a échoué.",
        );
      } else {
        setMessage(
          "Votre demande de récompense a bien été enregistrée. Vos points ont été débités.",
        );
      }

      await fetchRewardRedemptions();
      closeRewardModal();
    } catch (error) {
      console.error("Erreur complète handleConfirmReward :", error);
      setRewardModalMessage(
        error?.message || "Erreur lors de l’enregistrement de la récompense.",
      );
    } finally {
      setIsSubmittingReward(false);
    }
  };

  if (loading) {
    return <div className="center-screen">Chargement...</div>;
  }

  if (!session) {
    return (
      <div className="page">
        <section className="hero-shell">
          <div className="hero-brandbar"></div>

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
                    className={`btn ${
                      mode === "login" ? "btn-primary" : "btn-secondary"
                    }`}
                    onClick={() => {
                      setMode("login");
                      setMessage("");
                    }}
                  >
                    Connexion
                  </button>
                  <button
                    type="button"
                    className={`btn ${
                      mode === "register" ? "btn-primary" : "btn-secondary"
                    }`}
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

                      <div className="form-row">
                        <div className="form-block">
                          <label>Code postal</label>
                          <input
                            type="text"
                            value={authForm.postalCode}
                            onChange={(e) =>
                              handleAuthChange("postalCode", e.target.value)
                            }
                          />
                        </div>

                        <div className="form-block">
                          <label>Ville</label>
                          <input
                            type="text"
                            value={authForm.city}
                            onChange={(e) =>
                              handleAuthChange("city", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="form-block">
                    <label>Adresse e-mail</label>
                    <input
                      type="email"
                      value={authForm.email}
                      onChange={(e) =>
                        handleAuthChange("email", e.target.value.toLowerCase())
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

                  {mode === "login" && (
                    <div style={{ marginTop: "12px" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={resetPassword}
                      >
                        Mot de passe oublié
                      </button>
                    </div>
                  )}

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

  if (session && isAdmin) {
    return <Admin session={session} onBack={signOut} />;
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

                      {submission.admin_message ? (
                        <p className="muted" style={{ marginTop: "8px" }}>
                          Message de l’équipe : {submission.admin_message}
                        </p>
                      ) : null}
                    </div>

                    <div className="submission-right">
                      <span className={getStatusClass(submission.status)}>
                        {getStatusLabel(submission.status)}
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
                      className={`btn ${
                        available ? "btn-primary" : "btn-secondary"
                      }`}
                      disabled={!available}
                      onClick={() => openRewardModal(reward)}
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

            {latestRedemption ? (
              <div className="selected-reward">
                <strong>{latestRedemption.reward_title}</strong>
                <p className="muted">
                  Statut : {getRewardStatusLabel(latestRedemption.status)} •{" "}
                  {latestRedemption.points_used} points utilisés
                </p>
              </div>
            ) : (
              <p className="muted">
                Aucune récompense sélectionnée pour le moment.
              </p>
            )}
          </div>

          <div className="panel">
            <h2>Historique des récompenses</h2>

            {rewardRedemptions.length === 0 ? (
              <p className="muted">
                Vous n’avez encore effectué aucune demande de récompense.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                {rewardRedemptions.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "16px",
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong>{item.reward_title}</strong>
                      <span>{item.points_used} points</span>
                    </div>

                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "14px",
                        color: "#667085",
                      }}
                    >
                      Demandé le{" "}
                      {new Date(item.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </div>

                    <div style={{ marginTop: "8px" }}>
                      Statut :{" "}
                      <strong>{getRewardStatusLabel(item.status)}</strong>
                    </div>

                    {item.reward_type === "refund" ? (
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "14px",
                          color: "#667085",
                        }}
                      >
                        Demande de remboursement bancaire
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
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

      {rewardModalOpen && selectedReward ? (
        <div className="modal-overlay" onClick={closeRewardModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Confirmer votre récompense</h2>
            <p className="muted">
              Êtes-vous certain(e) de vouloir utiliser{" "}
              <strong>{selectedReward.points} points</strong> pour{" "}
              <strong>{selectedReward.title}</strong> ?
            </p>

            {selectedReward.type === "refund" ? (
              <div className="refund-fields">
                <div className="form-block">
                  <label>RIB</label>
                  <input
                    type="text"
                    value={rewardForm.rib}
                    onChange={(e) =>
                      handleRewardFormChange("rib", e.target.value)
                    }
                    placeholder="Renseignez votre RIB"
                  />
                </div>

                <div className="form-block">
                  <label>IBAN</label>
                  <input
                    type="text"
                    value={rewardForm.iban}
                    onChange={(e) =>
                      handleRewardFormChange("iban", e.target.value)
                    }
                    placeholder="Renseignez votre IBAN"
                  />
                </div>

                <div className="form-block">
                  <label>Nom du titulaire du compte</label>
                  <input
                    type="text"
                    value={rewardForm.accountHolder}
                    onChange={(e) =>
                      handleRewardFormChange("accountHolder", e.target.value)
                    }
                    placeholder="Nom et prénom du titulaire"
                  />
                </div>
              </div>
            ) : null}

            {rewardModalMessage ? (
              <p style={{ marginTop: "16px", color: "#b42318" }}>
                {rewardModalMessage}
              </p>
            ) : null}

            <div className="auth-buttons" style={{ marginTop: "24px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeRewardModal}
                disabled={isSubmittingReward}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmReward}
                disabled={isSubmittingReward}
              >
                {isSubmittingReward ? "Validation..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
