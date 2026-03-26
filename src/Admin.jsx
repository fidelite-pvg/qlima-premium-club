import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./App.css";

export default function Admin({ session, onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [adminMessages, setAdminMessages] = useState({});
  const [activeTab, setActiveTab] = useState("pending");

  const isAdmin = session?.user?.email === "fidelite@pvg.eu";

  useEffect(() => {
    if (isAdmin) {
      fetchAllSubmissions();
    }
  }, [isAdmin]);

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
        return "En attente de régularisation";
      case "rejected":
        return "Refusée";
      default:
        return "En cours";
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

    setMessage("Demande mise à jour avec succès.");
    fetchAllSubmissions();
  };

  // 🔥 CORRECTION ICI : ouverture sécurisée des fichiers
  const openDocument = async (path) => {
    const { data, error } = await supabase.storage
      .from("loyalty-documents")
      .createSignedUrl(path, 60);

    if (error) {
      console.error("Erreur ouverture document :", error);
      setMessage(`Impossible d’ouvrir ce document : ${error.message}`);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  // 🔥 FILTRES PAR ONGLET
  const pendingSubmissions = submissions.filter((s) => s.status === "pending");

  const needsInfoSubmissions = submissions.filter(
    (s) => s.status === "needs_info",
  );

  const validatedSubmissions = submissions.filter(
    (s) => s.status === "validated",
  );

  const rejectedSubmissions = submissions.filter(
    (s) => s.status === "rejected",
  );

  const visibleSubmissions =
    activeTab === "validated"
      ? validatedSubmissions
      : activeTab === "needs_info"
        ? needsInfoSubmissions
        : activeTab === "rejected"
          ? rejectedSubmissions
          : pendingSubmissions;

  if (!isAdmin) {
    return (
      <div className="dashboard-page">
        <div className="panel">
          <h2>Accès refusé</h2>
          <p className="muted">Cette page est réservée à l’administration.</p>
          <button className="btn btn-secondary" onClick={onBack}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="topbar">
        <div className="topbar-left">
          <div>
            <p className="topbar-subtitle">Qlima Premium Club</p>
            <h1>Administration des demandes</h1>
          </div>
        </div>

        <div className="topbar-right">
          <button className="btn btn-secondary" onClick={onBack}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="dashboard-grid" style={{ gridTemplateColumns: "1fr" }}>
        <section className="left-column">
          {/* ONGLET */}
          <div className="panel">
            <h2>Administration des demandes</h2>
            {message ? <p className="muted">{message}</p> : null}

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "16px",
              }}
            >
              <button
                className={`btn ${activeTab === "pending" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveTab("pending")}
              >
                Demandes en cours ({pendingSubmissions.length})
              </button>

              <button
                className={`btn ${activeTab === "needs_info" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveTab("needs_info")}
              >
                À compléter ({needsInfoSubmissions.length})
              </button>

              <button
                className={`btn ${activeTab === "validated" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveTab("validated")}
              >
                Validées ({validatedSubmissions.length})
              </button>

              <button
                className={`btn ${activeTab === "rejected" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveTab("rejected")}
              >
                Refusées ({rejectedSubmissions.length})
              </button>
            </div>
          </div>

          {/* LISTE */}
          {loading ? (
            <div className="panel">
              <p className="muted">Chargement...</p>
            </div>
          ) : visibleSubmissions.length === 0 ? (
            <div className="panel">
              <p className="muted">Aucune demande.</p>
            </div>
          ) : (
            visibleSubmissions.map((submission) => (
              <div className="panel" key={submission.id}>
                <h3>
                  {submission.first_name} {submission.last_name}
                </h3>

                <p className="muted">{submission.email}</p>

                <p>
                  <strong>Produit :</strong> {submission.fuel}
                </p>
                <p>
                  <strong>Quantité :</strong> {submission.quantity}
                </p>
                <p>
                  <strong>Points :</strong> {submission.estimated_points}
                </p>
                <p>
                  <strong>Statut :</strong> {getStatusLabel(submission.status)}
                </p>

                {/* DOCUMENTS */}
                {submission.documents?.length ? (
                  <div style={{ marginTop: "12px" }}>
                    <strong>Documents :</strong>
                    <ul className="file-list">
                      {submission.documents.map((doc, index) => (
                        <li key={index}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => openDocument(doc.file_path)}
                          >
                            Ouvrir : {doc.file_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="muted">Aucun document</p>
                )}

                {/* MESSAGE ADMIN */}
                <div className="form-block" style={{ marginTop: "16px" }}>
                  <label>Message au client</label>
                  <textarea
                    rows="3"
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

                {/* ACTIONS */}
                <div
                  style={{ display: "flex", gap: "10px", marginTop: "10px" }}
                >
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      updateSubmissionStatus(submission, "validated")
                    }
                  >
                    Valider
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={() =>
                      updateSubmissionStatus(submission, "needs_info")
                    }
                  >
                    Complément
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
