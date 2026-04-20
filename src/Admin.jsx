import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

const STORAGE_BUCKET = "loyalty-documents";

const sectionTabs = [
  { key: "submissions", label: "Demandes de points" },
  { key: "rewards", label: "Demandes de récompenses" },
  { key: "clients", label: "Dossiers clients" },
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

const formatClientName = (firstName, lastName, fallback = "Client inconnu") => {
  const fullName = `${firstName || ""} ${lastName || ""}`.trim();
  return fullName || fallback;
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
  const [selectedClientKey, setSelectedClientKey] = useState("");

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

  const topRewardDemandStats = useMemo(() => {
    const grouped = rewardRedemptions.reduce((acc, item) => {
      const key = item.reward_code || item.reward_title || "Récompense";
      if (!acc[key]) {
        acc[key] = {
          key,
          title: item.reward_title || "Récompense",
          requests: 0,
          pending: 0,
          processed: 0,
          rejected: 0,
          cancelled: 0,
          pointsUsed: 0,
        };
      }

      acc[key].requests += 1;
      acc[key].pointsUsed += Number(item.points_used || 0);

      if (item.status === "pending") acc[key].pending += 1;
      else if (item.status === "approved") acc[key].processed += 1;
      else if (item.status === "rejected") acc[key].rejected += 1;
      else if (item.status === "cancelled") acc[key].cancelled += 1;

      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => {
        if (b.requests !== a.requests) return b.requests - a.requests;
        return b.pointsUsed - a.pointsUsed;
      })
      .slice(0, 5);
  }, [rewardRedemptions]);

  const topFuelPointStats = useMemo(() => {
    const grouped = submissions.reduce((acc, item) => {
      const key = item.fuel || "Combustible non renseigné";
      if (!acc[key]) {
        acc[key] = {
          key,
          fuel: key,
          requests: 0,
          quantity: 0,
          pointsRequested: 0,
          pointsAwarded: 0,
          pending: 0,
          validated: 0,
        };
      }

      acc[key].requests += 1;
      acc[key].quantity += Number(item.quantity || 0);
      acc[key].pointsRequested += Number(item.estimated_points || 0);
      acc[key].pointsAwarded += Number(item.points_awarded || 0);

      if (item.status === "pending" || item.status === "needs_info") {
        acc[key].pending += 1;
      }
      if (item.status === "validated") {
        acc[key].validated += 1;
      }

      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => {
        if (b.pointsRequested !== a.pointsRequested) {
          return b.pointsRequested - a.pointsRequested;
        }
        return b.requests - a.requests;
      })
      .slice(0, 5);
  }, [submissions]);

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

  const clientRecords = useMemo(() => {
    const map = new Map();

    const ensureClient = (item, source) => {
      const key = (item.email || `${source}-${item.id}`).toLowerCase();
      const existing = map.get(key) || {
        key,
        email: item.email || "",
        first_name: item.first_name || "",
        last_name: item.last_name || "",
        phone: item.phone || "",
        address: item.address || "",
        submissions: [],
        rewards: [],
        lastActivityAt: null,
      };

      existing.first_name = existing.first_name || item.first_name || "";
      existing.last_name = existing.last_name || item.last_name || "";
      existing.phone = existing.phone || item.phone || "";
      existing.address = existing.address || item.address || "";
      existing.email = existing.email || item.email || "";

      if (item.created_at) {
        const createdAt = new Date(item.created_at).toISOString();
        if (!existing.lastActivityAt || createdAt > existing.lastActivityAt) {
          existing.lastActivityAt = createdAt;
        }
      }

      map.set(key, existing);
      return existing;
    };

    submissions.forEach((submission) => {
      const client = ensureClient(submission, "submission");
      client.submissions.push(submission);
    });

    rewardRedemptions.forEach((reward) => {
      const client = ensureClient(reward, "reward");
      client.rewards.push(reward);
    });

    return Array.from(map.values())
      .map((client) => {
        const pointsAwarded = client.submissions.reduce(
          (sum, item) => sum + Number(item.points_awarded || 0),
          0,
        );
        const estimatedPoints = client.submissions.reduce(
          (sum, item) => sum + Number(item.estimated_points || 0),
          0,
        );
        const pointsUsedApproved = client.rewards
          .filter((item) => item.status === "approved")
          .reduce((sum, item) => sum + Number(item.points_used || 0), 0);
        const pointsUsedRequested = client.rewards.reduce(
          (sum, item) => sum + Number(item.points_used || 0),
          0,
        );
        const balance = pointsAwarded - pointsUsedApproved;

        const activity = [
          ...client.submissions.map((item) => ({
            id: `submission-${item.id}`,
            type: "submission",
            title: item.fuel || "Demande de points",
            status: item.status,
            created_at: item.created_at,
            points: Number(item.points_awarded || item.estimated_points || 0),
            item,
          })),
          ...client.rewards.map((item) => ({
            id: `reward-${item.id}`,
            type: "reward",
            title: item.reward_title || "Demande de récompense",
            status: item.status,
            created_at: item.created_at,
            points: Number(item.points_used || 0),
            item,
          })),
        ].sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
        );

        const lastSubmission =
          [...client.submissions].sort(
            (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
          )[0] || null;

        const lastReward =
          [...client.rewards].sort(
            (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
          )[0] || null;

        return {
          ...client,
          displayName: formatClientName(client.first_name, client.last_name),
          pointsAwarded,
          estimatedPoints,
          pointsUsedApproved,
          pointsUsedRequested,
          balance,
          submissionsCount: client.submissions.length,
          rewardsCount: client.rewards.length,
          pendingSubmissionsCount: client.submissions.filter(
            (item) => item.status === "pending",
          ).length,
          pendingRewardsCount: client.rewards.filter(
            (item) => item.status === "pending",
          ).length,
          activity,
          lastSubmission,
          lastReward,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.lastActivityAt || 0).getTime() -
          new Date(a.lastActivityAt || 0).getTime(),
      );
  }, [submissions, rewardRedemptions]);

  const filteredClientRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return clientRecords;

    return clientRecords.filter((client) => {
      return (
        client.displayName.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term) ||
        client.phone.toLowerCase().includes(term)
      );
    });
  }, [clientRecords, searchTerm]);

  const selectedClient = useMemo(() => {
    if (!filteredClientRecords.length) return null;

    return (
      filteredClientRecords.find(
        (client) => client.key === selectedClientKey,
      ) || filteredClientRecords[0]
    );
  }, [filteredClientRecords, selectedClientKey]);

  useEffect(() => {
    if (sectionTab !== "clients") return;

    if (!filteredClientRecords.length) {
      setSelectedClientKey("");
      return;
    }

    if (!selectedClientKey) {
      setSelectedClientKey(filteredClientRecords[0].key);
      return;
    }

    const stillExists = filteredClientRecords.some(
      (client) => client.key === selectedClientKey,
    );

    if (!stillExists) {
      setSelectedClientKey(filteredClientRecords[0].key);
    }
  }, [filteredClientRecords, selectedClientKey, sectionTab]);

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
                Retrouvez les demandes de points, les demandes de récompenses et
                les dossiers clients dans des espaces séparés.
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

            <div className="admin-dashboard-grid admin-dashboard-grid-secondary">
              <div className="panel admin-mini-panel">
                <div className="admin-mini-header">
                  <h3>Récompenses les plus demandées</h3>
                  <span className="mini-chip">Top 5</span>
                </div>

                {topRewardDemandStats.length === 0 ? (
                  <p className="muted">
                    Aucune demande de récompense pour le moment.
                  </p>
                ) : (
                  <div className="admin-ranking-list">
                    {topRewardDemandStats.map((reward, index) => (
                      <div key={reward.key} className="admin-ranking-item">
                        <div className="admin-ranking-main">
                          <span className="admin-ranking-badge">
                            #{index + 1}
                          </span>
                          <div>
                            <strong>{reward.title}</strong>
                            <small>
                              {reward.requests} demande
                              {reward.requests > 1 ? "s" : ""} ·{" "}
                              {reward.pointsUsed} pts
                            </small>
                          </div>
                        </div>
                        <div className="admin-ranking-meta">
                          <span>{reward.pending} en attente</span>
                          <span>
                            {reward.processed} traitée
                            {reward.processed > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel admin-mini-panel">
                <div className="admin-mini-header">
                  <h3>Points saisis par combustible</h3>
                  <span className="mini-chip">Top 5</span>
                </div>

                {topFuelPointStats.length === 0 ? (
                  <p className="muted">
                    Aucune demande de points pour le moment.
                  </p>
                ) : (
                  <div className="admin-ranking-list">
                    {topFuelPointStats.map((fuel, index) => (
                      <div key={fuel.key} className="admin-ranking-item">
                        <div className="admin-ranking-main">
                          <span className="admin-ranking-badge">
                            #{index + 1}
                          </span>
                          <div>
                            <strong>{fuel.fuel}</strong>
                            <small>
                              {fuel.pointsRequested} pts demandés ·{" "}
                              {fuel.requests} demande
                              {fuel.requests > 1 ? "s" : ""}
                            </small>
                          </div>
                        </div>
                        <div className="admin-ranking-meta">
                          <span>
                            {fuel.quantity} unité{fuel.quantity > 1 ? "s" : ""}
                          </span>
                          <span>{fuel.pointsAwarded} pts validés</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    : sectionTab === "rewards"
                      ? "Récompense, nom ou e-mail"
                      : "Nom, e-mail ou téléphone"
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
          ) : sectionTab === "rewards" ? (
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
          ) : (
            <>
              <div className="panel" style={{ marginTop: "20px" }}>
                <div className="section-shape">
                  <h2>Dossiers clients</h2>
                  <p>
                    Ouvrez une fiche client pour retrouver son historique
                    complet de demandes de points, de récompenses et son niveau
                    d’activité.
                  </p>
                </div>

                <div className="client-overview-grid">
                  <div className="stat-box">
                    <span>Clients suivis</span>
                    <strong style={{ fontSize: "20px" }}>
                      {clientRecords.length}
                    </strong>
                  </div>
                  <div className="stat-box">
                    <span>Dossiers avec demandes en cours</span>
                    <strong style={{ fontSize: "20px" }}>
                      {
                        clientRecords.filter(
                          (client) =>
                            client.pendingSubmissionsCount > 0 ||
                            client.pendingRewardsCount > 0,
                        ).length
                      }
                    </strong>
                  </div>
                  <div className="stat-box">
                    <span>Clients avec récompense en attente</span>
                    <strong style={{ fontSize: "20px" }}>
                      {
                        clientRecords.filter(
                          (client) => client.pendingRewardsCount > 0,
                        ).length
                      }
                    </strong>
                  </div>
                </div>
              </div>

              {filteredClientRecords.length === 0 ? (
                <div className="panel" style={{ marginTop: "20px" }}>
                  <p className="muted">
                    Aucun client ne correspond à la recherche.
                  </p>
                </div>
              ) : (
                <div className="client-dossiers-layout">
                  <div className="client-dossiers-list panel">
                    <div className="admin-mini-header">
                      <h3>Liste des clients</h3>
                      <span className="mini-chip">
                        {filteredClientRecords.length} résultat
                        {filteredClientRecords.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="client-records-stack">
                      {filteredClientRecords.map((client) => (
                        <button
                          key={client.key}
                          type="button"
                          className={`client-record-card ${selectedClient?.key === client.key ? "client-record-card-active" : ""}`}
                          onClick={() => setSelectedClientKey(client.key)}
                        >
                          <div className="client-record-top">
                            <div>
                              <strong>{client.displayName}</strong>
                              <span>{client.email || "Aucun e-mail"}</span>
                            </div>
                            <span className="mini-chip">
                              {client.balance} pts
                            </span>
                          </div>

                          <div className="client-record-metrics">
                            <span>
                              {client.submissionsCount} demande(s) points
                            </span>
                            <span>{client.rewardsCount} récompense(s)</span>
                          </div>

                          <div className="client-record-flags">
                            {client.pendingSubmissionsCount > 0 ? (
                              <span className="status-chip status-pending">
                                {client.pendingSubmissionsCount} point(s) à
                                traiter
                              </span>
                            ) : null}
                            {client.pendingRewardsCount > 0 ? (
                              <span className="status-chip status-needs-info">
                                {client.pendingRewardsCount} récompense(s) en
                                attente
                              </span>
                            ) : null}
                          </div>

                          <p className="muted client-record-date">
                            Dernière activité :{" "}
                            {formatDateTime(client.lastActivityAt)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedClient ? (
                    <div className="client-detail-column panel">
                      <div className="client-detail-header">
                        <div>
                          <p className="topbar-subtitle">Fiche client</p>
                          <h2>{selectedClient.displayName}</h2>
                          <p className="muted" style={{ marginTop: 0 }}>
                            {selectedClient.email || "Aucun e-mail renseigné"}
                          </p>
                        </div>
                        <span className="points-chip">
                          Solde estimé : {selectedClient.balance} points
                        </span>
                      </div>

                      <div className="client-summary-grid">
                        <div className="stat-box">
                          <span>Points gagnés</span>
                          <strong>{selectedClient.pointsAwarded}</strong>
                          <small>
                            {selectedClient.estimatedPoints} points demandés
                          </small>
                        </div>
                        <div className="stat-box">
                          <span>Points utilisés</span>
                          <strong>{selectedClient.pointsUsedApproved}</strong>
                          <small>
                            {selectedClient.pointsUsedRequested} points demandés
                          </small>
                        </div>
                        <div className="stat-box">
                          <span>Demandes de points</span>
                          <strong>{selectedClient.submissionsCount}</strong>
                          <small>
                            {selectedClient.pendingSubmissionsCount} à traiter
                          </small>
                        </div>
                        <div className="stat-box">
                          <span>Demandes de récompenses</span>
                          <strong>{selectedClient.rewardsCount}</strong>
                          <small>
                            {selectedClient.pendingRewardsCount} en attente
                          </small>
                        </div>
                      </div>

                      <div className="client-detail-meta">
                        <p className="muted">
                          <strong>Téléphone :</strong>{" "}
                          {selectedClient.phone || "—"}
                        </p>
                        <p className="muted">
                          <strong>Adresse :</strong>{" "}
                          {selectedClient.address || "—"}
                        </p>
                        <p className="muted">
                          <strong>Dernière demande de points :</strong>{" "}
                          {selectedClient.lastSubmission
                            ? formatDateTime(
                                selectedClient.lastSubmission.created_at,
                              )
                            : "Aucune"}
                        </p>
                        <p className="muted">
                          <strong>Dernière demande de récompense :</strong>{" "}
                          {selectedClient.lastReward
                            ? formatDateTime(
                                selectedClient.lastReward.created_at,
                              )
                            : "Aucune"}
                        </p>
                      </div>

                      <div className="client-history-sections">
                        <div className="panel client-history-panel">
                          <div className="admin-mini-header">
                            <h3>Historique des demandes de points</h3>
                            <span className="mini-chip">
                              {selectedClient.submissionsCount}
                            </span>
                          </div>

                          {selectedClient.submissionsCount === 0 ? (
                            <p className="muted">Aucune demande de points.</p>
                          ) : (
                            <div className="client-history-list">
                              {selectedClient.submissions.map((submission) => (
                                <div
                                  key={submission.id}
                                  className="history-card"
                                >
                                  <div className="history-card-head">
                                    <div>
                                      <strong>
                                        {submission.fuel || "Demande de points"}
                                      </strong>
                                      <span>
                                        {formatDateTime(submission.created_at)}
                                      </span>
                                    </div>
                                    <span
                                      className={getStatusClass(
                                        submission.status,
                                      )}
                                    >
                                      {getStatusLabel(submission.status)}
                                    </span>
                                  </div>

                                  <div className="history-card-metrics">
                                    <span>
                                      Quantité : {submission.quantity || 0}
                                    </span>
                                    <span>
                                      Estimés :{" "}
                                      {submission.estimated_points || 0} pts
                                    </span>
                                    <span>
                                      Attribués :{" "}
                                      {submission.points_awarded || 0} pts
                                    </span>
                                  </div>

                                  {submission.comments ? (
                                    <p
                                      className="muted"
                                      style={{ marginBottom: 0 }}
                                    >
                                      <strong>Commentaire client :</strong>{" "}
                                      {submission.comments}
                                    </p>
                                  ) : null}

                                  {submission.admin_message ? (
                                    <p
                                      className="muted"
                                      style={{ marginBottom: 0 }}
                                    >
                                      <strong>Message admin :</strong>{" "}
                                      {submission.admin_message}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="panel client-history-panel">
                          <div className="admin-mini-header">
                            <h3>Historique des récompenses</h3>
                            <span className="mini-chip">
                              {selectedClient.rewardsCount}
                            </span>
                          </div>

                          {selectedClient.rewardsCount === 0 ? (
                            <p className="muted">
                              Aucune demande de récompense.
                            </p>
                          ) : (
                            <div className="client-history-list">
                              {selectedClient.rewards.map((reward) => (
                                <div key={reward.id} className="history-card">
                                  <div className="history-card-head">
                                    <div>
                                      <strong>
                                        {reward.reward_title ||
                                          "Demande de récompense"}
                                      </strong>
                                      <span>
                                        {formatDateTime(reward.created_at)}
                                      </span>
                                    </div>
                                    <span
                                      className={getRewardStatusClass(
                                        reward.status,
                                      )}
                                    >
                                      {getRewardStatusLabel(reward.status)}
                                    </span>
                                  </div>

                                  <div className="history-card-metrics">
                                    <span>
                                      Type :{" "}
                                      {reward.reward_type === "refund"
                                        ? "Remboursement"
                                        : "Récompense"}
                                    </span>
                                    <span>
                                      Points : {reward.points_used || 0}
                                    </span>
                                    {reward.serial_number ? (
                                      <span>S/N : {reward.serial_number}</span>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className="panel client-history-panel"
                        style={{ marginTop: "20px" }}
                      >
                        <div className="admin-mini-header">
                          <h3>Chronologie complète</h3>
                          <span className="mini-chip">
                            {selectedClient.activity.length} événement
                            {selectedClient.activity.length > 1 ? "s" : ""}
                          </span>
                        </div>

                        {selectedClient.activity.length === 0 ? (
                          <p className="muted">Aucune activité enregistrée.</p>
                        ) : (
                          <div className="activity-timeline">
                            {selectedClient.activity.map((activity) => (
                              <div key={activity.id} className="timeline-item">
                                <div className="timeline-dot" />
                                <div className="timeline-content">
                                  <div className="history-card-head">
                                    <div>
                                      <strong>
                                        {activity.type === "submission"
                                          ? "Demande de points"
                                          : "Demande de récompense"}
                                      </strong>
                                      <span>
                                        {formatDateTime(activity.created_at)}
                                      </span>
                                    </div>
                                    <span
                                      className={
                                        activity.type === "submission"
                                          ? getStatusClass(activity.status)
                                          : getRewardStatusClass(
                                              activity.status,
                                            )
                                      }
                                    >
                                      {activity.type === "submission"
                                        ? getStatusLabel(activity.status)
                                        : getRewardStatusLabel(activity.status)}
                                    </span>
                                  </div>
                                  <p
                                    className="muted"
                                    style={{ marginBottom: 0 }}
                                  >
                                    <strong>{activity.title}</strong>
                                    {activity.points
                                      ? ` · ${activity.points} pts`
                                      : ""}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
