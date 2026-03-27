import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

export default function Admin({ session, onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [adminMessages, setAdminMessages] = useState({});
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAllSubmissions();
  }, []);

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
    }

    setMessage("Demande mise à jour avec succès.");
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
              <h2>Administration des demandes</h2>
              <p>
                Gérez les dossiers clients, les validations et les demandes de
                complément.
              </p>
            </div>

            {message ? <p className="muted">{message}</p> : null}

            <div className="form-block">
              <label>Rechercher un client</label>
              <input
                type="text"
                placeholder="Nom, prénom ou e-mail"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div
              className="auth-buttons"
              style={{ flexWrap: "wrap", marginTop: "20px" }}
            >
              <button
                className={`btn ${
                  activeTab === "pending" ? "btn-primary" : "btn-secondary"
                }`}
                onClick={() => setActiveTab("pending")}
              >
                En cours ({pendingSubmissions.length})
              </button>

              <button
                className={`btn ${
                  activeTab === "needs_info" ? "btn-primary" : "btn-secondary"
                }`}
                onClick={() => setActiveTab("needs_info")}
              >
                À compléter ({needsInfoSubmissions.length})
              </button>

              <button
                className={`btn ${
                  activeTab === "validated" ? "btn-primary" : "btn-secondary"
                }`}
                onClick={() => setActiveTab("validated")}
              >
                Validées ({validatedSubmissions.length})
              </button>

              <button
                className={`btn ${
                  activeTab === "rejected" ? "btn-primary" : "btn-secondary"
                }`}
                onClick={() => setActiveTab("rejected")}
              >
                Refusées ({rejectedSubmissions.length})
              </button>
            </div>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="panel">
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
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
                    {submission.created_at
                      ? new Date(submission.created_at).toLocaleString("fr-FR")
                      : "—"}
                  </p>
                  {submission.comments ? (
                    <p className="muted" style={{ marginBottom: "6px" }}>
                      <strong>Commentaire client :</strong>{" "}
                      {submission.comments}
                    </p>
                  ) : null}
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
        </section>
      </main>
    </div>
  );
}
