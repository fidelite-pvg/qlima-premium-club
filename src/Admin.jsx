import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

const STORAGE_BUCKET = "loyalty-documents";

const sectionTabs = [
  { key: "submissions", label: "Demandes de points" },
  { key: "rewards", label: "Demandes de récompenses" },
];

const submissionTabs = [
  { key: "pending", label: "En cours" },
  { key: "needs_info", label: "À compléter" },
  { key: "validated", label: "Validées" },
  { key: "rejected", label: "Refusées" },
];

const rewardTabs = [
  { key: "pending", label: "En attente" },
  { key: "approved", label: "Traitées" },
  { key: "rejected", label: "Refusées" },
  { key: "cancelled", label: "Annulées" },
];

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeDocuments = (rawValue) => {
  if (!rawValue) return [];

  let documents = rawValue;

  if (typeof documents === "string") {
    const parsed = safeJsonParse(documents);
    documents = parsed ?? [];
  }

  if (documents && typeof documents === "object" && !Array.isArray(documents)) {
    if (Array.isArray(documents.documents)) {
      documents = documents.documents;
    } else {
      documents = [documents];
    }
  }

  if (!Array.isArray(documents)) return [];

  return documents
    .map((doc, index) => {
      if (!doc) return null;

      if (typeof doc === "string") {
        const parsed = safeJsonParse(doc);
        if (parsed && typeof parsed === "object") {
          doc = parsed;
        } else {
          return {
            key: `${doc}-${index}`,
            file_name: doc,
            file_path: "",
            url: "",
            bucket: STORAGE_BUCKET,
          };
        }
      }

      const filePath =
        doc.file_path ||
        doc.path ||
        doc.storage_path ||
        doc.fullPath ||
        doc.name ||
        "";

      const fileName =
        doc.file_name ||
        doc.filename ||
        doc.name ||
        (typeof filePath === "string" && filePath.includes("/")
          ? filePath.split("/").pop()
          : filePath) ||
        `Document ${index + 1}`;

      return {
        key: `${filePath || fileName}-${index}`,
        file_name: fileName,
        file_path: filePath,
        url: doc.url || doc.publicUrl || doc.signedUrl || "",
        bucket: doc.storage_bucket || doc.bucket || STORAGE_BUCKET,
        mime_type: doc.mime_type || doc.type || "",
        document_kind: doc.document_kind || doc.kind || "",
      };
    })
    .filter(Boolean);
};

const formatDateTime = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR");
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
};

export default function Admin({ session, onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [adminMessages, setAdminMessages] = useState({});
  const [activeTab, setActiveTab] = useState("pending");
  const [rewardTab, setRewardTab] = useState("pending");
  const [sectionTab, setSectionTab] = useState("submissions");
  const [searchTerm, setSearchTerm] = useState("");
  const [rewardRedemptions, setRewardRedemptions] = useState([]);
  const [rewardMessage, setRewardMessage] = useState("");
  const [documentUrls, setDocumentUrls] = useState({});
  const [loadingDocumentKey, setLoadingDocumentKey] = useState("");

  useEffect(() => {
    fetchAllSubmissions();
    fetchRewardRedemptions();
  }, []);

  const fetchRewardRedemptions = async () => {
    const { data, error } = await supabase
      .from("reward_redemptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement reward_redemptions :", error);
      return;
    }

    setRewardRedemptions(data || []);
  };

  const updateRewardStatus = async (item, status) => {
    setRewardMessage("");

    const { error } = await supabase
      .from("reward_redemptions")
      .update({ status })
      .eq("id", item.id);

    if (error) {
      console.error("Erreur update reward status :", error);
      setRewardMessage("Erreur lors de la mise à jour du statut.");
      return;
    }

    const { error: notifyError } = await supabase.functions.invoke(
      "notify-reward-status",
      {
        body: {
          redemption: { ...item, status },
        },
      },
    );

    if (notifyError) {
      console.error(
        "Erreur envoi email client récompense :",
        notifyError.message,
      );
      setRewardMessage(
        `Statut mis à jour, mais l’e-mail client n’a pas pu être envoyé : ${notifyError.message}`,
      );
      fetchRewardRedemptions();
      return;
    }

    setRewardMessage("Statut de la récompense mis à jour et e-mail envoyé.");
    fetchRewardRedemptions();
  };

  const fetchAllSubmissions = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("loyalty_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setSubmissions(data || []);
    }

    setLoading(false);
  };

  const openDocument = async (document) => {
    if (!document) return;

    const directUrl = document.url;
    if (directUrl) {
      window.open(directUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const cacheKey = `${document.bucket || STORAGE_BUCKET}:${document.file_path}`;
    if (documentUrls[cacheKey]) {
      window.open(documentUrls[cacheKey], "_blank", "noopener,noreferrer");
      return;
    }

    if (!document.file_path) {
      setMessage("Impossible d’ouvrir ce document : chemin manquant.");
      return;
    }

    setLoadingDocumentKey(cacheKey);

    const { data, error } = await supabase.storage
      .from(document.bucket || STORAGE_BUCKET)
      .createSignedUrl(document.file_path, 60 * 10);

    setLoadingDocumentKey("");

    if (error) {
      console.error("Erreur génération URL document :", error);
      setMessage("Impossible d’ouvrir le document.");
      return;
    }

    if (data?.signedUrl) {
      setDocumentUrls((prev) => ({
        ...prev,
        [cacheKey]: data.signedUrl,
      }));
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "validated":
        return "Validée";
      case "needs_info":
        return "À compléter";
      case "rejected":
        return "Refusée";
      default:
        return "En cours";
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

  const getRewardStatusClass = (status) => {
    switch (status) {
      case "approved":
        return "status-chip status-validated";
      case "rejected":
        return "status-chip status-rejected";
      case "cancelled":
        return "status-chip status-needs-info";
      default:
        return "status-chip status-pending";
    }
  };

  const updateSubmissionStatus = async (submission, status) => {
    setMessage("");

    const adminMessage =
      adminMessages[submission.id] ?? submission.admin_message ?? "";

    const payload = {
      status,
      admin_message: adminMessage,
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.user.email,
      points_awarded: status === "validated" ? submission.estimated_points : 0,
    };

    const { error } = await supabase
      .from("loyalty_submissions")
      .update(payload)
      .eq("id", submission.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    const { error: notifyError } = await supabase.functions.invoke(
      "notify-submission-status",
      {
        body: {
          submission: {
            ...submission,
            ...payload,
          },
        },
      },
    );

    if (notifyError) {
      console.error("Erreur envoi email :", notifyError.message);
      setMessage(
        `Demande mise à jour, mais l’e-mail n’a pas pu être envoyé : ${notifyError.message}`,
      );
      fetchAllSubmissions();
      return;
    }

    setMessage("Demande mise à jour avec succès et e-mail envoyé.");
    fetchAllSubmissions();
  };

  const pendingSubmissions = submissions.filter((s) => s.status === "pending");
  const validatedSubmissions = submissions.filter(
    (s) => s.status === "validated",
  );
  const rejectedSubmissions = submissions.filter(
    (s) => s.status === "rejected",
  );
  const needsInfoSubmissions = submissions.filter(
    (s) => s.status === "needs_info",
  );

  const visibleSubmissions =
    activeTab === "validated"
      ? validatedSubmissions
      : activeTab === "needs_info"
        ? needsInfoSubmissions
        : activeTab === "rejected"
          ? rejectedSubmissions
          : pendingSubmissions;

  const filteredSubmissions = visibleSubmissions.filter((submission) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    return (
      submission.first_name?.toLowerCase().includes(term) ||
      submission.last_name?.toLowerCase().includes(term) ||
      submission.email?.toLowerCase().includes(term)
    );
  });

  const rewardCounts = useMemo(
    () => ({
      pending: rewardRedemptions.filter((item) => item.status === "pending")
        .length,
      approved: rewardRedemptions.filter((item) => item.status === "approved")
        .length,
      rejected: rewardRedemptions.filter((item) => item.status === "rejected")
        .length,
      cancelled: rewardRedemptions.filter((item) => item.status === "cancelled")
        .length,
    }),
    [rewardRedemptions],
  );

  const visibleRewards = rewardRedemptions.filter((item) => {
    if (rewardTab === "approved") return item.status === "approved";
    if (rewardTab === "rejected") return item.status === "rejected";
    if (rewardTab === "cancelled") return item.status === "cancelled";
    return item.status === "pending";
  });

  const filteredRewards = visibleRewards.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    return (
      item.reward_title?.toLowerCase().includes(term) ||
      item.first_name?.toLowerCase().includes(term) ||
      item.last_name?.toLowerCase().includes(term) ||
      item.email?.toLowerCase().includes(term)
    );
  });

  const dashboardStats = useMemo(() => {
    const totalSubmissions = submissions.length;
    const totalRewards = rewardRedemptions.length;
    const totalPointsAwarded = submissions.reduce(
      (sum, item) => sum + Number(item.points_awarded || 0),
      0,
    );
    const totalPointsRequested = submissions.reduce(
      (sum, item) => sum + Number(item.estimated_points || 0),
      0,
    );
    const totalPointsUsed = rewardRedemptions.reduce(
      (sum, item) => sum + Number(item.points_used || 0),
      0,
    );
    const validationRate = totalSubmissions
      ? Math.round((validatedSubmissions.length / totalSubmissions) * 100)
      : 0;
    const rewardsApprovalRate = totalRewards
      ? Math.round((rewardCounts.approved / totalRewards) * 100)
      : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSubmissions = submissions.filter((item) => {
      if (!item.created_at) return false;
      return new Date(item.created_at) >= sevenDaysAgo;
    }).length;

    const recentRewards = rewardRedemptions.filter((item) => {
      if (!item.created_at) return false;
      return new Date(item.created_at) >= sevenDaysAgo;
    }).length;

    const latestSubmission = submissions[0] || null;
    const latestReward = rewardRedemptions[0] || null;

    return {
      totalSubmissions,
      totalRewards,
      totalPointsAwarded,
      totalPointsRequested,
      totalPointsUsed,
      validationRate,
      rewardsApprovalRate,
      recentSubmissions,
      recentRewards,
      latestSubmission,
      latestReward,
    };
  }, [
    submissions,
    rewardRedemptions,
    validatedSubmissions.length,
    rewardCounts.approved,
  ]);

  const renderDocuments = (documents, emptyLabel = "Aucun document") => {
    const normalized = normalizeDocuments(documents);

    if (normalized.length === 0) {
      return <p className="muted">{emptyLabel}</p>;
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {normalized.map((doc) => {
          const cacheKey = `${doc.bucket || STORAGE_BUCKET}:${doc.file_path}`;
          const isOpening = loadingDocumentKey === cacheKey;

          return (
            <button
              key={doc.key}
              type="button"
              className="btn btn-secondary"
              style={{ width: "fit-content" }}
              onClick={() => openDocument(doc)}
            >
              {isOpening ? "Ouverture..." : `Voir ${doc.file_name}`}
            </button>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <div className="center-screen">Chargement...</div>;
  }

  return (
    <div className="dashboard-page">
      <header className="topbar">
        <div className="topbar-left">
          <div>
            <p className="topbar-subtitle">Qlima Premium Club</p>
            <h1>Administration</h1>
          </div>
        </div>

        <div className="topbar-right">
          <span className="points-chip">
            {pendingSubmissions.length} demande
            {pendingSubmissions.length > 1 ? "s" : ""} en cours
          </span>
          <img src="/qlima-logo.png" alt="Qlima" className="topbar-logo" />
          <button className="btn btn-secondary" onClick={onBack}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="left-column" style={{ gridColumn: "1 / -1" }}>
          <div className="panel soft-panel">
            <div className="section-shape">
              <h2>Pilotage admin</h2>
              <p>
                Retrouvez les demandes de points et les demandes de récompenses
                dans des espaces séparés.
              </p>
            </div>

            <div className="admin-dashboard-grid">
              <div className="stat-box admin-stat-card admin-stat-highlight">
                <span>Demandes de points à traiter</span>
                <strong>{pendingSubmissions.length}</strong>
                <small>{needsInfoSubmissions.length} à compléter</small>
              </div>

              <div className="stat-box admin-stat-card">
                <span>Taux de validation</span>
                <strong>{dashboardStats.validationRate}%</strong>
                <small>{validatedSubmissions.length} demandes validées</small>
              </div>

              <div className="stat-box admin-stat-card">
                <span>Points attribués</span>
                <strong>{dashboardStats.totalPointsAwarded}</strong>
                <small>
                  {dashboardStats.totalPointsRequested} points demandés
                </small>
              </div>

              <div className="stat-box admin-stat-card">
                <span>Récompenses en attente</span>
                <strong>{rewardCounts.pending}</strong>
                <small>{rewardCounts.approved} déjà traitées</small>
              </div>
            </div>

            <div className="admin-dashboard-grid admin-dashboard-grid-secondary">
              <div className="panel admin-mini-panel">
                <div className="admin-mini-header">
                  <h3>Demandes de points</h3>
                  <span className="mini-chip">
                    {dashboardStats.totalSubmissions} total
                  </span>
                </div>
                <div className="admin-kpi-list">
                  <div>
                    <span>En cours</span>
                    <strong>{pendingSubmissions.length}</strong>
                  </div>
                  <div>
                    <span>Validées</span>
                    <strong>{validatedSubmissions.length}</strong>
                  </div>
                  <div>
                    <span>Refusées</span>
                    <strong>{rejectedSubmissions.length}</strong>
                  </div>
                  <div>
                    <span>7 derniers jours</span>
                    <strong>{dashboardStats.recentSubmissions}</strong>
                  </div>
                </div>
                <div className="progress-block">
                  <div className="progress-label">
                    <span>Validation globale</span>
                    <span>{dashboardStats.validationRate}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${dashboardStats.validationRate}%` }}
                    />
                  </div>
                </div>
                <p className="muted admin-last-activity">
                  Dernière demande :{" "}
                  {dashboardStats.latestSubmission
                    ? `${dashboardStats.latestSubmission.first_name || ""} ${dashboardStats.latestSubmission.last_name || ""} · ${formatDateTime(dashboardStats.latestSubmission.created_at)}`
                    : "Aucune demande"}
                </p>
              </div>

              <div className="panel admin-mini-panel">
                <div className="admin-mini-header">
                  <h3>Demandes de récompenses</h3>
                  <span className="mini-chip">
                    {dashboardStats.totalRewards} total
                  </span>
                </div>
                <div className="admin-kpi-list">
                  <div>
                    <span>En attente</span>
                    <strong>{rewardCounts.pending}</strong>
                  </div>
                  <div>
                    <span>Traitées</span>
                    <strong>{rewardCounts.approved}</strong>
                  </div>
                  <div>
                    <span>Refusées</span>
                    <strong>{rewardCounts.rejected}</strong>
                  </div>
                  <div>
                    <span>Points utilisés</span>
                    <strong>{dashboardStats.totalPointsUsed}</strong>
                  </div>
                </div>
                <div className="progress-block">
                  <div className="progress-label">
                    <span>Taux de traitement</span>
                    <span>{dashboardStats.rewardsApprovalRate}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${dashboardStats.rewardsApprovalRate}%`,
                      }}
                    />
                  </div>
                </div>
                <p className="muted admin-last-activity">
                  Dernière demande :{" "}
                  {dashboardStats.latestReward
                    ? `${dashboardStats.latestReward.reward_title || "Récompense"} · ${formatDateTime(dashboardStats.latestReward.created_at)}`
                    : "Aucune demande"}
                </p>
              </div>
            </div>

            <div
              className="auth-buttons"
              style={{ flexWrap: "wrap", marginTop: "20px" }}
            >
              {sectionTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`btn ${sectionTab === tab.key ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setSectionTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="form-block" style={{ marginTop: "20px" }}>
              <label>Rechercher</label>
              <input
                type="text"
                placeholder={
                  sectionTab === "submissions"
                    ? "Nom, prénom ou e-mail"
                    : "Récompense, nom ou e-mail"
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {sectionTab === "submissions" ? (
            <>
              <div className="panel" style={{ marginTop: "20px" }}>
                <div className="section-shape">
                  <h2>Demandes de points</h2>
                  <p>
                    Chaque demande affiche les pièces jointes envoyées par le
                    client pour la validation des points.
                  </p>
                </div>

                {message ? <p className="muted">{message}</p> : null}

                <div
                  className="auth-buttons"
                  style={{ flexWrap: "wrap", marginTop: "20px" }}
                >
                  {submissionTabs.map((tab) => {
                    const count =
                      tab.key === "pending"
                        ? pendingSubmissions.length
                        : tab.key === "needs_info"
                          ? needsInfoSubmissions.length
                          : tab.key === "validated"
                            ? validatedSubmissions.length
                            : rejectedSubmissions.length;

                    return (
                      <button
                        key={tab.key}
                        className={`btn ${activeTab === tab.key ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setActiveTab(tab.key)}
                      >
                        {tab.label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredSubmissions.length === 0 ? (
                <div className="panel" style={{ marginTop: "20px" }}>
                  <p className="muted">Aucune demande dans cet onglet.</p>
                </div>
              ) : (
                filteredSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="panel"
                    style={{ marginTop: "20px" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <h2 style={{ marginBottom: "8px" }}>
                          {submission.first_name} {submission.last_name}
                        </h2>
                        <p className="muted" style={{ marginTop: 0 }}>
                          {submission.email}
                        </p>
                      </div>

                      <span className={getStatusClass(submission.status)}>
                        {getStatusLabel(submission.status)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px",
                        marginTop: "20px",
                      }}
                    >
                      <div className="stat-box">
                        <span>Produit</span>
                        <strong style={{ fontSize: "20px" }}>
                          {submission.fuel || "—"}
                        </strong>
                      </div>

                      <div className="stat-box">
                        <span>Quantité</span>
                        <strong style={{ fontSize: "20px" }}>
                          {submission.quantity || 0}
                        </strong>
                      </div>

                      <div className="stat-box">
                        <span>Points estimés</span>
                        <strong style={{ fontSize: "20px" }}>
                          {submission.estimated_points || 0}
                        </strong>
                      </div>

                      <div className="stat-box">
                        <span>Points attribués</span>
                        <strong style={{ fontSize: "20px" }}>
                          {submission.points_awarded || 0}
                        </strong>
                      </div>
                    </div>

                    <div style={{ marginTop: "20px" }}>
                      <p className="muted" style={{ marginBottom: "6px" }}>
                        <strong>Téléphone :</strong> {submission.phone || "—"}
                      </p>
                      <p className="muted" style={{ marginBottom: "6px" }}>
                        <strong>Adresse :</strong> {submission.address || "—"}
                      </p>
                      <p className="muted" style={{ marginBottom: "6px" }}>
                        <strong>Date :</strong>{" "}
                        {formatDateTime(submission.created_at)}
                      </p>
                      {submission.comments ? (
                        <p className="muted" style={{ marginBottom: "6px" }}>
                          <strong>Commentaire client :</strong>{" "}
                          {submission.comments}
                        </p>
                      ) : null}
                    </div>

                    <div style={{ marginTop: "20px" }}>
                      <p className="muted" style={{ marginBottom: "10px" }}>
                        <strong>Pièces jointes client :</strong>
                      </p>
                      {renderDocuments(
                        submission.documents,
                        "Aucune pièce jointe transmise",
                      )}
                    </div>

                    <div className="form-block" style={{ marginTop: "20px" }}>
                      <label>Message au client</label>
                      <textarea
                        rows="4"
                        placeholder="Ajouter un message visible par le client"
                        value={
                          adminMessages[submission.id] ??
                          submission.admin_message ??
                          ""
                        }
                        onChange={(e) =>
                          setAdminMessages((prev) => ({
                            ...prev,
                            [submission.id]: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div
                      className="auth-buttons"
                      style={{ flexWrap: "wrap", marginTop: "20px" }}
                    >
                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          updateSubmissionStatus(submission, "validated")
                        }
                      >
                        Validation rapide
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() =>
                          updateSubmissionStatus(submission, "needs_info")
                        }
                      >
                        Demander un complément
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() =>
                          updateSubmissionStatus(submission, "rejected")
                        }
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              <div className="panel" style={{ marginTop: "20px" }}>
                <div className="section-shape">
                  <h2>Demandes de récompenses</h2>
                  <p>
                    Les demandes de récompenses sont regroupées à part pour
                    éviter de mélanger les validations de points et les
                    avantages clients.
                  </p>
                </div>

                {rewardMessage ? (
                  <p className="muted">{rewardMessage}</p>
                ) : null}

                <div
                  className="auth-buttons"
                  style={{ flexWrap: "wrap", marginTop: "20px" }}
                >
                  {rewardTabs.map((tab) => (
                    <button
                      key={tab.key}
                      className={`btn ${rewardTab === tab.key ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setRewardTab(tab.key)}
                    >
                      {tab.label} ({rewardCounts[tab.key] || 0})
                    </button>
                  ))}
                </div>
              </div>

              {filteredRewards.length === 0 ? (
                <div className="panel" style={{ marginTop: "20px" }}>
                  <p className="muted">
                    Aucune demande de récompense dans cet onglet.
                  </p>
                </div>
              ) : (
                filteredRewards.map((item) => (
                  <div
                    key={item.id}
                    className="panel"
                    style={{
                      marginTop: "20px",
                      padding: "20px",
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <h2 style={{ marginBottom: "8px" }}>
                          {item.reward_title}
                        </h2>
                        <p className="muted" style={{ marginTop: 0 }}>
                          {item.first_name} {item.last_name}
                        </p>
                        <p className="muted" style={{ marginTop: 0 }}>
                          {item.email}
                        </p>
                      </div>

                      <span className={getRewardStatusClass(item.status)}>
                        {getRewardStatusLabel(item.status)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px",
                        marginTop: "20px",
                      }}
                    >
                      <div className="stat-box">
                        <span>Type</span>
                        <strong style={{ fontSize: "20px" }}>
                          {item.reward_type === "refund"
                            ? "Remboursement"
                            : "Récompense"}
                        </strong>
                      </div>

                      <div className="stat-box">
                        <span>Points utilisés</span>
                        <strong style={{ fontSize: "20px" }}>
                          {item.points_used || 0}
                        </strong>
                      </div>

                      <div className="stat-box">
                        <span>Date de demande</span>
                        <strong style={{ fontSize: "20px" }}>
                          {formatDate(item.created_at)}
                        </strong>
                      </div>
                    </div>

                    {item.reward_type === "refund" ? (
                      <div style={{ marginTop: "20px" }}>
                        <p className="muted" style={{ marginBottom: "10px" }}>
                          <strong>RIB PDF :</strong>
                        </p>
                        {renderDocuments(
                          item.supporting_documents,
                          "Aucun document",
                        )}
                      </div>
                    ) : null}

                    {item.reward_code === "extended_warranty_1y" ? (
                      <div style={{ marginTop: "20px" }}>
                        <p className="muted" style={{ marginBottom: "6px" }}>
                          <strong>Numéro de série :</strong>{" "}
                          {item.serial_number || "Non renseigné"}
                        </p>
                        <p className="muted" style={{ marginBottom: "6px" }}>
                          <strong>Appareil encore sous garantie :</strong>{" "}
                          {item.warranty_confirmed ? "Oui" : "Non"}
                        </p>
                        <div style={{ marginTop: "10px" }}>
                          <p className="muted" style={{ marginBottom: "10px" }}>
                            <strong>Facture :</strong>
                          </p>
                          {renderDocuments(
                            item.supporting_documents,
                            "Aucun document",
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div
                      className="auth-buttons"
                      style={{ flexWrap: "wrap", marginTop: "20px" }}
                    >
                      <button
                        className="btn btn-primary"
                        onClick={() => updateRewardStatus(item, "approved")}
                      >
                        Valider
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => updateRewardStatus(item, "rejected")}
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
