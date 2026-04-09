import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

const STORAGE_BUCKET = "loyalty-documents";

const sectionTabs = [
  { key: "submissions", label: "Dossiers clients" },
  { key: "rewards", label: "RÃ©compenses" },
];

const submissionTabs = [
  { key: "pending", label: "En cours" },
  { key: "needs_info", label: "Ã€ complÃ©ter" },
  { key: "validated", label: "ValidÃ©es" },
  { key: "rejected", label: "RefusÃ©es" },
];

const rewardTabs = [
  { key: "pending", label: "En attente" },
  { key: "approved", label: "TraitÃ©es" },
  { key: "rejected", label: "RefusÃ©es" },
  { key: "cancelled", label: "AnnulÃ©es" },
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

  const updateRewardStatus = async (reward, status) => {
    setRewardMessage("");

    const { error } = await supabase
      .from("reward_redemptions")
      .update({ status })
      .eq("id", reward.id);

    if (error) {
      console.error("Erreur update reward status :", error);
      setRewardMessage("Erreur lors de la mise à jour du statut.");
      return;
    }

    const { error: notifyError } = await supabase.functions.invoke(
      "notify-submission-status",
      {
        body: {
          redemption: {
            ...reward,
            status,
          },
        },
      },
    );

    if (notifyError) {
      console.error("Erreur envoi email récompense :", notifyError.message);
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
      setMessage("Impossible dâ€™ouvrir ce document : chemin manquant.");
      return;
    }

    setLoadingDocumentKey(cacheKey);

    const { data, error } = await supabase.storage
      .from(document.bucket || STORAGE_BUCKET)
      .createSignedUrl(document.file_path, 60 * 10);

    setLoadingDocumentKey("");

    if (error) {
      console.error("Erreur gÃ©nÃ©ration URL document :", error);
      setMessage("Impossible dâ€™ouvrir le document.");
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
        return "ValidÃ©e";
      case "needs_info":
        return "Ã€ complÃ©ter";
      case "rejected":
        return "RefusÃ©e";
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
        return "TraitÃ©e";
      case "rejected":
        return "RefusÃ©e";
      case "cancelled":
        return "AnnulÃ©e";
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
        `Demande mise Ã  jour, mais lâ€™e-mail nâ€™a pas pu Ãªtre envoyÃ© : ${notifyError.message}`,
      );
      fetchAllSubmissions();
      return;
    }

    setMessage("Demande mise Ã  jour avec succÃ¨s et e-mail envoyÃ©.");
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
            DÃ©connexion
          </button>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="left-column" style={{ gridColumn: "1 / -1" }}>
          <div className="panel soft-panel">
            <div className="section-shape">
              <h2>Pilotage admin</h2>
              <p>
                Retrouvez les dossiers clients et les demandes de rÃ©compenses
                dans des espaces sÃ©parÃ©s.
              </p>
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
                    ? "Nom, prÃ©nom ou e-mail"
                    : "RÃ©compense, nom ou e-mail"
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
                  <h2>Dossiers clients</h2>
                  <p>
                    Chaque dossier affiche maintenant les piÃ¨ces jointes
                    envoyÃ©es par le client pour la validation des points.
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
                          {submission.fuel || "â€”"}
                        </strong>
                      </div>

                      <div className="stat-box">
                        <span>QuantitÃ©</span>
                        <strong style={{ fontSize: "20px" }}>
                          {submission.quantity || 0}
                        </strong>
                      </div>

                      <div className="stat-box">
                        <span>Points estimÃ©s</span>
                        <strong style={{ fontSize: "20px" }}>
                          {submission.estimated_points || 0}
                        </strong>
                      </div>

                      <div className="stat-box">
                        <span>Points attribuÃ©s</span>
                        <strong style={{ fontSize: "20px" }}>
                          {submission.points_awarded || 0}
                        </strong>
                      </div>
                    </div>

                    <div style={{ marginTop: "20px" }}>
                      <p className="muted" style={{ marginBottom: "6px" }}>
                        <strong>TÃ©lÃ©phone :</strong> {submission.phone || "â€”"}
                      </p>
                      <p className="muted" style={{ marginBottom: "6px" }}>
                        <strong>Adresse :</strong> {submission.address || "â€”"}
                      </p>
                      <p className="muted" style={{ marginBottom: "6px" }}>
                        <strong>Date :</strong>{" "}
                        {submission.created_at
                          ? new Date(submission.created_at).toLocaleString(
                              "fr-FR",
                            )
                          : "â€”"}
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
                        <strong>PiÃ¨ces jointes client :</strong>
                      </p>
                      {renderDocuments(
                        submission.documents,
                        "Aucune piÃ¨ce jointe transmise",
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
                        Demander un complÃ©ment
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
                  <h2>RÃ©compenses</h2>
                  <p>
                    Les demandes de rÃ©compenses sont regroupÃ©es Ã  part pour
                    Ã©viter de mÃ©langer les validations de points et les
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
                    Aucune demande de rÃ©compense dans cet onglet.
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
                            : "RÃ©compense"}
                        </strong>
                      </div>

                      <div className="stat-box">
                        <span>Points utilisÃ©s</span>
                        <strong style={{ fontSize: "20px" }}>
                          {item.points_used || 0}
                        </strong>
                      </div>

                      <div className="stat-box">
                        <span>Date de demande</span>
                        <strong style={{ fontSize: "20px" }}>
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString(
                                "fr-FR",
                              )
                            : "â€”"}
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
                          <strong>NumÃ©ro de sÃ©rie :</strong>{" "}
                          {item.serial_number || "Non renseignÃ©"}
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

