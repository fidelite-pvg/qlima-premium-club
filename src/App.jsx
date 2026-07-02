import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./App.css";
import { supabase } from "./lib/supabase";
import Admin from "./Admin";

const STORAGE_BUCKET = "loyalty-documents";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

const ALLOWED_SIGNATURES = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
};

function readFileBytes(file, numBytes) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(new Uint8Array(e.target.result));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(0, numBytes));
  });
}

async function validateFile(file, allowedMimeTypes = Object.keys(ALLOWED_SIGNATURES)) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `"${file.name}" dépasse la taille maximale de 10 Mo.`;
  }
  const bytes = await readFileBytes(file, 8);
  for (const mimeType of allowedMimeTypes) {
    const signatures = ALLOWED_SIGNATURES[mimeType] || [];
    for (const sig of signatures) {
      if (sig.every((byte, i) => bytes[i] === byte)) return null;
    }
  }
  return `"${file.name}" : type de fichier non autorisé. Seuls les formats PDF, JPG et PNG sont acceptés.`;
}

const customerSubmissionTabs = [
  { key: "pending", label: "En attente" },
  { key: "validated", label: "Validé" },
  { key: "needs_info", label: "À compléter" },
  { key: "rejected", label: "Refusé" },
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

const fuels = [
  { name: "Kristal Shine 20 L", points: 4 },
  { name: "Bright 20 L", points: 3 },
  { name: "Spark 20 L", points: 2 },
  { name: "Kristal Shine 10 L", points: 2 },
  { name: "Bright 10 L", points: 1 },
  { name: "Pure 20 L", points: 1 },
];

const LIFETIME_WARRANTY_FUELS = ["Kristal Shine", "Kristal Shine 20 L", "Bright 20 L"];

const rewards = [
  {
    code: "extended_warranty_1y",
    points: 10,
    title: "1 an de garantie supplémentaire",
    type: "standard",
  },
  {
    code: "refund_12",
    points: 15,
    title: "12€ remboursés",
    type: "refund",
  },
  {
    code: "electric_pump",
    points: 20,
    title: "Pompe à combustible liquide électrique Qlima offerte",
    type: "standard",
  },
  {
    code: "refund_50_appliance",
    points: 40,
    title:
      "50€ remboursés sur l'achat d'un appareil à combustible liquide Qlima",
    type: "refund",
  },
  {
    code: "refund_kristal_shine",
    points: 60,
    title: "Un bidon de Kristal Shine remboursé",
    type: "refund",
  },
  {
    code: "sre_4035_c",
    points: 80,
    title: "Un poêle à combustible liquide SRE 4035 C offert",
    type: "standard",
  },
  {
    code: "sre_9046_c2",
    points: 100,
    title: "Un poêle à combustible liquide SRE 9046 C-2 offert",
    type: "standard",
  },
  {
    code: "lifetime_warranty",
    points: 0,
    title: "Garantie à vie de votre appareil",
    type: "lifetime_warranty",
  },
];

function FileInput({ id, accept, multiple, onChange, fileName }) {
  const inputRef = useRef(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          padding: "6px 14px",
          border: "1px solid #d0d5dd",
          borderRadius: "8px",
          background: "#fff",
          cursor: "pointer",
          fontSize: "14px",
          color: "#344054",
          whiteSpace: "nowrap",
        }}
      >
        {multiple ? "Choisir des fichiers" : "Choisir un fichier"}
      </button>
      <span style={{ fontSize: "13px", color: fileName ? "#344054" : "#98A2B3" }}>
        {fileName || "Aucun fichier sélectionné"}
      </span>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("login");
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedReward, setSelectedReward] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [rewardRedemptions, setRewardRedemptions] = useState([]);
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [rewardModalMessage, setRewardModalMessage] = useState("");
  const [activeSubmissionTab, setActiveSubmissionTab] = useState("pending");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [completionFiles, setCompletionFiles] = useState([]);
  const [completionComment, setCompletionComment] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [isCompletingSubmission, setIsCompletingSubmission] = useState(false);
  const [documentUrls, setDocumentUrls] = useState({});
  const [loadingDocumentKey, setLoadingDocumentKey] = useState("");
  const [confirmationPopup, setConfirmationPopup] = useState({
    open: false,
    title: "",
    description: "",
  });
  const [rewardForm, setRewardForm] = useState({
    serialNumber: "",
    warrantyConfirmed: false,
    deliveryFirstName: "",
    deliveryLastName: "",
    deliveryEmail: "",
    deliveryPhone: "",
    deliveryAddress: "",
    deliveryPostalCode: "",
    deliveryCity: "",
  });
  const [rewardInvoiceFile, setRewardInvoiceFile] = useState(null);
  const [rewardBankDetailsFile, setRewardBankDetailsFile] = useState(null);
  const [rewardPurchaseProofFile, setRewardPurchaseProofFile] = useState(null);
  const [isSubmittingReward, setIsSubmittingReward] = useState(false);
  const [deleteAccountStep, setDeleteAccountStep] = useState(0);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");

  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");

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
    fuel: "Kristal Shine 20 L",
    qty: 1,
    comments: "",
  });

  const isAdmin = session?.user?.email === "fidelite@pvg.eu";

  useEffect(() => {
    let isMounted = true;

    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Erreur getSession :", error);
        }

        if (isMounted) {
          setSession(data?.session ?? null);
        }
      } catch (error) {
        console.error("Erreur initialisation session :", error);
        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (isMounted) {
        if (event === "PASSWORD_RECOVERY") {
          setRecoveryMode(true);
        } else if (event === "SIGNED_OUT") {
          setRecoveryMode(false);
        }
        setSession(newSession ?? null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user && !isAdmin) {
      fetchSubmissions();
      fetchRewardRedemptions();
    }
  }, [session, isAdmin]);

  useEffect(() => {
    if (!selectedSubmission) return;

    const refreshedSubmission = submissions.find(
      (item) => item.id === selectedSubmission.id,
    );

    if (refreshedSubmission) {
      setSelectedSubmission(refreshedSubmission);
    }
  }, [submissions, selectedSubmission]);

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

  const lifetimeWarrantyEligibility = useMemo(() => {
    const validated = submissions.filter((s) => s.status === "validated");
    if (validated.length === 0) {
      return { eligible: false, count: 0, disqualified: false };
    }
    const hasOtherFuel = validated.some(
      (s) => !LIFETIME_WARRANTY_FUELS.includes(s.fuel),
    );
    if (hasOtherFuel) {
      return { eligible: false, count: 0, disqualified: true };
    }
    const totalBidons = validated.reduce((sum, s) => sum + (s.quantity || 0), 0);
    return { eligible: totalBidons >= 6, count: totalBidons, disqualified: false };
  }, [submissions]);

  const nextReward = useMemo(() => {
    return (
      rewards.find(
        (reward) =>
          reward.type !== "lifetime_warranty" && reward.points > userPoints,
      ) || null
    );
  }, [userPoints]);

  const progressPercent = nextReward
    ? Math.min((userPoints / nextReward.points) * 100, 100)
    : 100;

  const latestRedemption = rewardRedemptions[0] || null;
  const isWarrantyReward =
    selectedReward?.code === "extended_warranty_1y" ||
    selectedReward?.code === "lifetime_warranty";
  const DELIVERY_REWARD_CODES = ["electric_pump", "sre_4035_c", "sre_9046_c2"];
  const isDeliveryReward =
    selectedReward && DELIVERY_REWARD_CODES.includes(selectedReward.code);

  const submissionTabs = [
    { key: "pending", label: "En attente" },
    { key: "validated", label: "Validé" },
    { key: "needs_info", label: "À compléter" },
    { key: "rejected", label: "Refusé" },
  ];

  const submissionCounts = useMemo(() => {
    return customerSubmissionTabs.reduce((acc, tab) => {
      acc[tab.key] = submissions.filter(
        (item) => item.status === tab.key,
      ).length;
      return acc;
    }, {});
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((item) => item.status === activeSubmissionTab);
  }, [submissions, activeSubmissionTab]);

  const handleAuthChange = (field, value) => {
    setAuthForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePurchaseChange = (field, value) => {
    setPurchaseForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const error = await validateFile(file);
      if (error) {
        setMessage(error);
        e.target.value = "";
        return;
      }
    }
    setMessage("");
    setUploadedFiles(files);
  };

  const removeUploadedFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeCompletionFile = (index) => {
    setCompletionFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCompletionFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const error = await validateFile(file);
      if (error) {
        setCompletionMessage(error);
        e.target.value = "";
        return;
      }
    }
    setCompletionMessage("");
    setCompletionFiles(files);
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

  const getSubmissionStatusDescription = (status) => {
    switch (status) {
      case "validated":
        return "Votre demande a été acceptée et les points ont été crédités.";
      case "needs_info":
        return "Votre dossier a besoin d’un complément avant d’être traité.";
      case "rejected":
        return "Votre demande a été refusée par notre équipe.";
      default:
        return "Votre demande est en cours d’analyse par notre équipe.";
    }
  };

  const handleRewardFormChange = (field, value) => {
    setRewardForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRewardInvoiceFileChange = async (e) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const error = await validateFile(file, ["application/pdf", "image/jpeg", "image/png"]);
      if (error) { setRewardModalMessage(error); e.target.value = ""; return; }
    }
    setRewardModalMessage("");
    setRewardInvoiceFile(file);
  };

  const handleRewardBankDetailsFileChange = async (e) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const error = await validateFile(file, ["application/pdf"]);
      if (error) { setRewardModalMessage(error); e.target.value = ""; return; }
    }
    setRewardModalMessage("");
    setRewardBankDetailsFile(file);
  };

  const handleRewardPurchaseProofFileChange = async (e) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const error = await validateFile(file, ["application/pdf", "image/jpeg", "image/png"]);
      if (error) { setRewardModalMessage(error); e.target.value = ""; return; }
    }
    setRewardModalMessage("");
    setRewardPurchaseProofFile(file);
  };

  const openRewardModal = (reward) => {
    setSelectedReward(reward);
    setRewardModalOpen(true);
    setMessage("");
    setRewardModalMessage("");
    setRewardForm({
      serialNumber: "",
      warrantyConfirmed: false,
      deliveryFirstName: "",
      deliveryLastName: "",
      deliveryEmail: "",
      deliveryPhone: "",
      deliveryAddress: "",
      deliveryPostalCode: "",
      deliveryCity: "",
    });
    setRewardInvoiceFile(null);
    setRewardBankDetailsFile(null);
    setRewardPurchaseProofFile(null);
  };

  const closeRewardModal = () => {
    setRewardModalOpen(false);
    setSelectedReward("");
    setRewardModalMessage("");
    setRewardForm({
      serialNumber: "",
      warrantyConfirmed: false,
      deliveryFirstName: "",
      deliveryLastName: "",
      deliveryEmail: "",
      deliveryPhone: "",
      deliveryAddress: "",
      deliveryPostalCode: "",
      deliveryCity: "",
    });
    setRewardInvoiceFile(null);
    setRewardBankDetailsFile(null);
    setRewardPurchaseProofFile(null);
  };

  const openConfirmationPopup = (title, description) => {
    setConfirmationPopup({
      open: true,
      title,
      description,
    });
  };

  const closeConfirmationPopup = () => {
    setConfirmationPopup({
      open: false,
      title: "",
      description: "",
    });
  };

  const openSubmissionDetails = (submission) => {
    setSelectedSubmission(submission);
    setCompletionFiles([]);
    setCompletionComment("");
    setCompletionMessage("");
  };

  const closeSubmissionDetails = () => {
    setSelectedSubmission(null);
    setCompletionFiles([]);
    setCompletionComment("");
    setCompletionMessage("");
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

  const uploadAdditionalSubmissionFiles = async () => {
    if (!session?.user || completionFiles.length === 0) return [];

    const uploaded = [];

    for (const file of completionFiles) {
      const extension = file.name.split(".").pop();
      const uniqueName = `${session.user.id}/submission-completions/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      await secureUpload(file, uniqueName);

      uploaded.push({
        file_name: file.name,
        file_path: uniqueName,
        storage_bucket: STORAGE_BUCKET,
        uploaded_at: new Date().toISOString(),
        document_kind: "completion_document",
      });
    }

    return uploaded;
  };

  const handleCompleteSubmission = async () => {
    if (!selectedSubmission || selectedSubmission.status !== "needs_info")
      return;

    if (!completionComment.trim() && completionFiles.length === 0) {
      setCompletionMessage(
        "Ajoutez un message ou au moins un document pour compléter votre dossier.",
      );
      return;
    }

    setCompletionMessage("");
    setIsCompletingSubmission(true);

    try {
      const uploaded = await uploadAdditionalSubmissionFiles();
      const existingDocuments = normalizeDocuments(
        selectedSubmission.documents,
      ).map((doc) => ({
        file_name: doc.file_name,
        file_path: doc.file_path,
        url: doc.url,
        storage_bucket: doc.bucket || STORAGE_BUCKET,
        mime_type: doc.mime_type || null,
        document_kind: doc.document_kind || null,
      }));

      const completionEntry = completionComment.trim()
        ? `Complément client du ${new Date().toLocaleDateString("fr-FR")} : ${completionComment.trim()}`
        : "";

      const nextComments = [selectedSubmission.comments, completionEntry]
        .filter(Boolean)
        .join("\n\n");

      const clientUpdateTimestamp = new Date().toISOString();

      const { error } = await supabase
        .from("loyalty_submissions")
        .update({
          documents: [...existingDocuments, ...uploaded],
          comments: nextComments,
          status: "pending",
          client_has_unread_update: true,
          client_last_update_at: clientUpdateTimestamp,
          reviewed_at: null,
          reviewed_by: null,
        })
        .eq("id", selectedSubmission.id);

      if (error) throw error;

      const { error: notifyAdminError } = await supabase.functions.invoke(
        "notify-submission-updated-admin",
        {
          body: {
            submission: {
              ...selectedSubmission,
              documents: [...existingDocuments, ...uploaded],
              comments: nextComments,
              status: "pending",
              client_has_unread_update: true,
              client_last_update_at: clientUpdateTimestamp,
            },
          },
        },
      );

      if (notifyAdminError) {
        console.error(
          "Erreur envoi email admin après complément client :",
          notifyAdminError.message,
        );
      }

      await fetchSubmissions();
      closeSubmissionDetails();
      openConfirmationPopup(
        "Dossier complété",
        "Votre complément a bien été envoyé. Votre dossier repasse en cours de traitement.",
      );
      setMessage("Votre complément a bien été transmis à notre équipe.");
    } catch (error) {
      setCompletionMessage(
        error?.message ||
          "Impossible de compléter votre dossier pour le moment.",
      );
    } finally {
      setIsCompletingSubmission(false);
    }
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

  const resetPassword = async (e) => {
    e.preventDefault();
    setMessage("");

    const emailToReset = forgotEmail.trim().toLowerCase();
    if (!emailToReset) {
      setMessage("Saisissez votre adresse e-mail.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      emailToReset,
      {
        redirectTo: window.location.origin,
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

    setForgotEmail("");
    setMessage(
      "Si un compte existe avec cette adresse, un e-mail de réinitialisation a été envoyé. Vérifiez votre boîte mail.",
    );
  };

  const updatePasswordAfterReset = async (e) => {
    e.preventDefault();
    setMessage("");

    if (newPassword.length < 6) {
      setMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    setRecoveryMode(false);
    setNewPassword("");
    setConfirmPassword("");
    setSession(null);
    setMessage("Votre mot de passe a bien été mis à jour. Connectez-vous avec votre nouveau mot de passe.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSubmissions([]);
    setUploadedFiles([]);
    setSelectedReward("");
    setRewardRedemptions([]);
    setRewardModalOpen(false);
    setRewardModalMessage("");
    setRewardInvoiceFile(null);
    setRewardBankDetailsFile(null);
  };

  const deleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteAccountError("");
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("delete-account", {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      if (error) throw error;
      setDeleteAccountStep(0);
      setMode("register");
      setAuthPanelOpen(true);
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Erreur suppression compte :", err);
      setDeleteAccountError("Une erreur est survenue. Veuillez réessayer ou contacter le support.");
    } finally {
      setIsDeletingAccount(false);
    }
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

  const openStoredDocument = async (filePath) => {
    if (!filePath) return;

    const { data } = supabase.storage
      .from("loyalty-documents")
      .getPublicUrl(filePath);

    if (data?.publicUrl) {
      window.open(data.publicUrl, "_blank", "noopener,noreferrer");
    }
  };

  const secureUpload = async (file, storagePath, allowedTypes) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", storagePath);
    if (allowedTypes?.length) formData.append("allowedTypes", allowedTypes.join(","));

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secure-upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: formData,
      },
    );
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Erreur lors de l'upload");
    return result;
  };

  const uploadFiles = async () => {
    if (!session?.user || uploadedFiles.length === 0) return [];

    const uploaded = [];

    for (const file of uploadedFiles) {
      const extension = file.name.split(".").pop();
      const uniqueName = `${session.user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      await secureUpload(file, uniqueName);

      uploaded.push({
        file_name: file.name,
        file_path: uniqueName,
      });
    }

    return uploaded;
  };

  const uploadRewardSupportingFile = async (file, folder, documentKind) => {
    if (!session?.user || !file) return null;

    const allowedTypes = folder === "reward-bank-details"
      ? ["application/pdf"]
      : ["application/pdf", "image/jpeg", "image/png"];

    const extension = file.name.split(".").pop();
    const uniqueName = `${session.user.id}/${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

    await secureUpload(file, uniqueName, allowedTypes);

    return {
      file_name: file.name,
      file_path: uniqueName,
      path: uniqueName,
      storage_path: uniqueName,
      storage_bucket: STORAGE_BUCKET,
      mime_type: file.type || null,
      document_kind: documentKind || null,
      uploaded_at: new Date().toISOString(),
    };
  };

  const handleSubmitPurchase = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!uploadedFiles.length) {
      setMessage(
        "Veuillez joindre au moins une facture ou un justificatif avant d’envoyer votre demande de points.",
      );
      openConfirmationPopup(
        "Pièce jointe obligatoire",
        "Ajoutez au moins une facture ou un justificatif pour envoyer votre demande de points.",
      );
      return;
    }

    try {
      const uploaded = await uploadFiles(uploadedFiles, "submissions");

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
        console.error("Erreur envoi email de demande :", notifyError.message);
        setMessage(
          `Votre demande a bien été envoyée, mais l’e-mail de confirmation n’a pas pu être envoyé immédiatement : ${notifyError.message}`,
        );
      } else {
        setMessage(
          "Votre demande a bien été envoyée et un e-mail de confirmation vous a été adressé.",
        );
      }

      openConfirmationPopup(
        "Demande envoyée",
        "Votre demande de points a bien été envoyée. Elle sera traitée prochainement par notre équipe.",
      );

      setPurchaseForm({
        fuel: "Kristal Shine 20 L",
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
    const isWarrantyReward =
      selectedReward.code === "extended_warranty_1y" ||
      selectedReward.code === "lifetime_warranty";
    const isDeliveryReward = DELIVERY_REWARD_CODES.includes(selectedReward.code);

    const requiresPurchaseProof =
      selectedReward.code === "refund_kristal_shine" ||
      selectedReward.code === "refund_50_appliance";

    if (isRefundReward) {
      if (!rewardBankDetailsFile) {
        setRewardModalMessage(
          "Merci d’ajouter votre RIB en format PDF, généré par la banque, au nom du titulaire du compte.",
        );
        return;
      }

      const fileName = rewardBankDetailsFile.name?.toLowerCase() || "";
      if (!fileName.endsWith(".pdf")) {
        setRewardModalMessage(
          "Le RIB doit être transmis en format PDF uniquement.",
        );
        return;
      }

      if (requiresPurchaseProof && !rewardPurchaseProofFile) {
        const label =
          selectedReward.code === "refund_kristal_shine"
            ? "du bidon de Kristal Shine"
            : "de l’appareil à combustible liquide Qlima";
        setRewardModalMessage(
          `Merci d’ajouter le ticket de caisse ou la facture prouvant l’achat ${label}.`,
        );
        return;
      }
    }

    if (isWarrantyReward) {
      if (!rewardInvoiceFile) {
        setRewardModalMessage(
          "Merci d’ajouter la facture d’achat de l’appareil faisant figurer la date d’achat.",
        );
        return;
      }

      if (!rewardForm.serialNumber.trim()) {
        setRewardModalMessage(
          "Merci de renseigner le numéro de série de l’appareil à combustible liquide.",
        );
        return;
      }

      if (
        selectedReward.code !== "lifetime_warranty" &&
        !rewardForm.warrantyConfirmed
      ) {
        setRewardModalMessage(
          "Cette récompense est réservée aux appareils toujours sous garantie. Merci de confirmer cette information.",
        );
        return;
      }
    }

    if (isDeliveryReward) {
      if (!rewardForm.deliveryFirstName.trim()) {
        setRewardModalMessage("Merci de renseigner votre prénom.");
        return;
      }
      if (!rewardForm.deliveryLastName.trim()) {
        setRewardModalMessage("Merci de renseigner votre nom.");
        return;
      }
      if (!rewardForm.deliveryEmail.trim()) {
        setRewardModalMessage("Merci de renseigner votre adresse e-mail.");
        return;
      }
      if (!rewardForm.deliveryPhone.trim()) {
        setRewardModalMessage("Merci de renseigner votre numéro de téléphone.");
        return;
      }
      if (!rewardForm.deliveryAddress.trim()) {
        setRewardModalMessage("Merci de renseigner votre adresse postale.");
        return;
      }
      if (!rewardForm.deliveryPostalCode.trim()) {
        setRewardModalMessage("Merci de renseigner votre code postal.");
        return;
      }
      if (!rewardForm.deliveryCity.trim()) {
        setRewardModalMessage("Merci de renseigner votre ville.");
        return;
      }
    }

    setMessage("");
    setRewardModalMessage("");
    setIsSubmittingReward(true);

    try {
      let uploadedInvoice = null;
      let uploadedBankDetails = null;

      if (isWarrantyReward) {
        uploadedInvoice = await uploadRewardSupportingFile(
          rewardInvoiceFile,
          "reward-invoices",
          "warranty_invoice",
        );
      }

      let uploadedPurchaseProof = null;

      if (isRefundReward) {
        uploadedBankDetails = await uploadRewardSupportingFile(
          rewardBankDetailsFile,
          "reward-bank-details",
          "refund_rib_pdf",
        );
      }

      if (requiresPurchaseProof && rewardPurchaseProofFile) {
        uploadedPurchaseProof = await uploadRewardSupportingFile(
          rewardPurchaseProofFile,
          "reward-invoices",
          "purchase_proof",
        );
      }

      const redemptionPayload = {
        user_id: session.user.id,
        first_name:
          session.user.user_metadata?.first_name || authForm.firstName || "",
        last_name:
          session.user.user_metadata?.last_name || authForm.lastName || "",
        email: session.user.email,
        reward_code: selectedReward.code,
        reward_title: selectedReward.title,
        reward_type: selectedReward.type,
        points_used: selectedReward.points,
        status: "pending",
        rib: null,
        iban: null,
        bank_account_holder: null,
        serial_number: isWarrantyReward ? rewardForm.serialNumber.trim() : null,
        warranty_confirmed: isWarrantyReward
          ? selectedReward.code === "lifetime_warranty"
            ? true
            : rewardForm.warrantyConfirmed
          : false,
        delivery_first_name: isDeliveryReward
          ? rewardForm.deliveryFirstName.trim()
          : null,
        delivery_last_name: isDeliveryReward
          ? rewardForm.deliveryLastName.trim()
          : null,
        delivery_email: isDeliveryReward
          ? rewardForm.deliveryEmail.trim()
          : null,
        delivery_phone: isDeliveryReward
          ? rewardForm.deliveryPhone.trim()
          : null,
        delivery_address: isDeliveryReward
          ? rewardForm.deliveryAddress.trim()
          : null,
        delivery_postal_code: isDeliveryReward
          ? rewardForm.deliveryPostalCode.trim()
          : null,
        delivery_city: isDeliveryReward
          ? rewardForm.deliveryCity.trim()
          : null,
        supporting_documents: [
          uploadedInvoice,
          uploadedBankDetails,
          uploadedPurchaseProof,
        ].filter(Boolean),
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
        console.error("Erreur envoi email de récompense :", notifyError);
        setMessage(
          "Votre demande de récompense a bien été enregistrée, mais l’e-mail de confirmation n’a pas pu être envoyé immédiatement.",
        );
      } else {
        setMessage(
          "Votre demande de récompense a bien été enregistrée. Un e-mail de confirmation vous a été adressé.",
        );
      }

      openConfirmationPopup(
        "Demande de récompense envoyée",
        "Votre demande de récompense a bien été envoyée. Elle sera traitée prochainement par notre équipe.",
      );

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

  if (recoveryMode) {
    return (
      <div className="center-screen" style={{ flexDirection: "column", gap: "16px", padding: "24px" }}>
        <h2 style={{ marginBottom: "8px" }}>Nouveau mot de passe</h2>
        <p className="muted" style={{ marginBottom: "16px" }}>
          Choisissez un nouveau mot de passe pour votre compte.
        </p>
        <form
          onSubmit={updatePasswordAfterReset}
          style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "360px" }}
        >
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            className="input"
            style={{ width: "100%" }}
          />
          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="input"
            style={{ width: "100%" }}
          />
          <button type="submit" className="btn btn-primary">
            Confirmer le nouveau mot de passe
          </button>
          {message && <p className="muted">{message}</p>}
        </form>
      </div>
    );
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
                {mode === "forgot-password" ? (
                  <>
                    <h2>Mot de passe oublié</h2>
                    <p className="muted">
                      Saisissez votre adresse e-mail. Si un compte existe, vous recevrez un lien pour choisir un nouveau mot de passe.
                    </p>
                    <form onSubmit={resetPassword} style={{ marginTop: "16px" }}>
                      <div className="form-block">
                        <label>Adresse e-mail</label>
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="votre@email.com"
                          required
                          autoFocus
                        />
                      </div>
                      <div className="auth-buttons" style={{ marginTop: "16px" }}>
                        <button type="submit" className="btn btn-primary">
                          Envoyer le lien
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => { setMode("login"); setMessage(""); setForgotEmail(""); }}
                        >
                          Retour
                        </button>
                      </div>
                      {message && <p className="muted" style={{ marginTop: "12px" }}>{message}</p>}
                    </form>
                  </>
                ) : (
                  <>
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
                      setAuthPanelOpen(true);
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
                      setAuthPanelOpen(true);
                    }}
                  >
                    Inscription
                  </button>
                </div>

                <div className={`auth-form-wrapper${authPanelOpen ? " auth-form-wrapper--open" : ""}`}>
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
                        onClick={() => { setMode("forgot-password"); setMessage(""); }}
                      >
                        Mot de passe oublié
                      </button>
                    </div>
                  )}

                  {message ? <p className="muted">{message}</p> : null}
                </form>
                </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="hero-footer">
            <span>Qlima.fr</span>
            <span>|</span>
            <span>Comfortable living</span>
            <span>|</span>
            <Link to="/privacy-policy" style={{ color: "inherit", textDecoration: "underline" }}>
              Politique de confidentialité
            </Link>
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
          <span className="points-chip topbar-points-chip">{userPoints} points validés</span>
          <img src="/qlima-logo.png" alt="Qlima" className="topbar-logo" />
          <button className="btn btn-secondary topbar-signout" onClick={signOut}>
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
                <FileInput multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFiles} fileName={uploadedFiles.length > 0 ? `${uploadedFiles.length} fichier(s) sélectionné(s)` : ""} />

                {uploadedFiles.length > 0 && (
                  <ul className="file-list">
                    {uploadedFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="file-list-item">
                        <span>{file.name}</span>
                        <button type="button" className="file-remove-btn" onClick={() => removeUploadedFile(index)}>×</button>
                      </li>
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
            <div className="section-header-with-tabs">
              <div>
                <h2>Mes demandes</h2>
                <p className="muted">
                  Retrouvez vos dossiers par statut et ouvrez chaque demande
                  pour voir le détail.
                </p>
              </div>
            </div>

            <div className="request-tabs customer-request-tabs">
              {customerSubmissionTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`request-tab customer-request-tab ${activeSubmissionTab === tab.key ? "active" : ""}`}
                  onClick={() => setActiveSubmissionTab(tab.key)}
                >
                  <span>{tab.label}</span>
                  <strong className="count">
                    {submissionCounts[tab.key] || 0}
                  </strong>
                </button>
              ))}
            </div>

            <div className="submission-list">
              {submissions.length === 0 ? (
                <p className="muted">Aucune demande envoyée pour le moment.</p>
              ) : filteredSubmissions.length === 0 ? (
                <p className="muted">
                  Aucun dossier dans cet onglet pour le moment.
                </p>
              ) : (
                filteredSubmissions.map((submission) => (
                  <button
                    key={submission.id}
                    type="button"
                    className="submission-item submission-card-button"
                    onClick={() => openSubmissionDetails(submission)}
                  >
                    <div>
                      <strong>{submission.fuel}</strong>
                      <p className="muted">
                        Quantité : {submission.quantity} • Estimation :{" "}
                        {submission.estimated_points} pts
                      </p>
                      <p className="muted">
                        Envoyée le{" "}
                        {new Date(submission.created_at).toLocaleDateString(
                          "fr-FR",
                        )}
                      </p>

                      {submission.status === "needs_info" &&
                      submission.admin_message ? (
                        <p className="submission-inline-alert">
                          Message de l’équipe : {submission.admin_message}
                        </p>
                      ) : null}
                    </div>

                    <div className="submission-right">
                      <span className={getStatusClass(submission.status)}>
                        {getStatusLabel(submission.status)}
                      </span>
                      <span className="submission-open-label">
                        Voir le dossier
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="right-column">
          <div className="panel">
            <h2>Catalogue des récompenses</h2>

            <div style={{
              background: "#fff8e1",
              border: "1px solid #f59e0b",
              borderRadius: "8px",
              padding: "12px 14px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "#92400e",
              lineHeight: "1.5",
            }}>
              <strong>📅 Période de validité</strong><br />
              Les récompenses sont valables du <strong>01/07/2026 au 30/06/2027</strong>. Le programme de fidélité est révisé chaque année afin d'adapter ses offres. Qlima se réserve le droit de reconduire ou non ce programme. En cas de non-reconduction, les points cumulés pourront être supprimés et ne seront plus utilisables.
            </div>

            <div className="reward-list">
              {rewards.map((reward) => {
                if (reward.code === "lifetime_warranty") {
                  const { eligible, count, disqualified } =
                    lifetimeWarrantyEligibility;
                  const progressPct = Math.min((count / 6) * 100, 100);
                  return (
                    <div
                      key={reward.code}
                      className={`reward-item ${eligible ? "available" : ""}`}
                    >
                      <div style={{ flex: 1 }}>
                        <strong>{reward.title}</strong>
                        {disqualified ? (
                          <p className="muted" style={{ color: "#b42318", marginTop: "4px" }}>
                            Vous avez soumis un combustible non éligible à cette offre (réservée au Kristal Shine 20 L et au Bright 20 L uniquement).
                          </p>
                        ) : (
                          <>
                            <p className="muted" style={{ marginTop: "4px" }}>
                              {count}/6 bidons validés — Kristal Shine 20 L ou Bright 20 L exclusivement
                            </p>
                            <div
                              style={{
                                marginTop: "6px",
                                height: "6px",
                                borderRadius: "99px",
                                background: "#e5e7eb",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${progressPct}%`,
                                  background: eligible ? "#16a34a" : "#2e6fdf",
                                  borderRadius: "99px",
                                  transition: "width 0.3s",
                                }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`btn ${eligible ? "btn-primary" : "btn-secondary"}`}
                        disabled={!eligible}
                        onClick={() => openRewardModal(reward)}
                      >
                        {eligible ? "Choisir" : "Indisponible"}
                      </button>
                    </div>
                  );
                }

                const available = userPoints >= reward.points;

                return (
                  <div
                    key={reward.code}
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
              <li>Offre valable du 01/07/2026 au 30/06/2027</li>
              <li>
                PVG France – 200 Avenue de la Mare Sansoure, Immeuble B2, 76650
                Petit-Couronne
              </li>
              <li>fidelite@pvg.eu</li>
              <li>02 32 96 07 70</li>
            </ul>
          </div>

          <div className="delete-account-zone">
            <button
              type="button"
              className="delete-account-link"
              onClick={() => setDeleteAccountStep(1)}
            >
              Supprimer mon compte
            </button>
          </div>
        </aside>
      </main>

      <div className="mobile-signout-bar">
        <button className="btn btn-secondary" onClick={signOut}>
          Déconnexion
        </button>
      </div>

      {selectedSubmission ? (
        <div className="modal-overlay" onClick={closeSubmissionDetails}>
          <div
            className="modal-card submission-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="submission-detail-header">
              <div>
                <p className="topbar-subtitle">Dossier client</p>
                <h2>{selectedSubmission.fuel}</h2>
                <p className="muted">
                  {getSubmissionStatusDescription(selectedSubmission.status)}
                </p>
              </div>
              <span className={getStatusClass(selectedSubmission.status)}>
                {getStatusLabel(selectedSubmission.status)}
              </span>
            </div>

            <div className="submission-detail-grid">
              <div className="submission-detail-box">
                <span>Date d’envoi</span>
                <strong>
                  {new Date(selectedSubmission.created_at).toLocaleDateString(
                    "fr-FR",
                    {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    },
                  )}
                </strong>
              </div>
              <div className="submission-detail-box">
                <span>Quantité</span>
                <strong>{selectedSubmission.quantity}</strong>
              </div>
              <div className="submission-detail-box">
                <span>Points estimés</span>
                <strong>{selectedSubmission.estimated_points} pts</strong>
              </div>
              <div className="submission-detail-box">
                <span>Points validés</span>
                <strong>{selectedSubmission.points_awarded || 0} pts</strong>
              </div>
            </div>

            {selectedSubmission.admin_message ? (
              <div className="admin-feedback-box">
                <h3>Message de l’équipe</h3>
                <p>{selectedSubmission.admin_message}</p>
              </div>
            ) : null}

            {selectedSubmission.comments ? (
              <div className="submission-detail-section">
                <h3>Vos commentaires</h3>
                <p className="muted preserve-linebreaks">
                  {selectedSubmission.comments}
                </p>
              </div>
            ) : null}

            <div className="submission-detail-section">
              <h3>Justificatifs du dossier</h3>
              {normalizeDocuments(selectedSubmission.documents).length === 0 ? (
                <p className="muted">Aucun document joint à cette demande.</p>
              ) : (
                <div className="submission-documents-list">
                  {normalizeDocuments(selectedSubmission.documents).map(
                    (doc) => {
                      const cacheKey = `${doc.bucket || STORAGE_BUCKET}:${doc.file_path}`;
                      const isOpening = loadingDocumentKey === cacheKey;

                      return (
                        <button
                          key={doc.key}
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openDocument(doc)}
                        >
                          {isOpening ? "Ouverture..." : `Voir ${doc.file_name}`}
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            {selectedSubmission.status === "needs_info" ? (
              <div className="submission-completion-box">
                <h3>Compléter mon dossier</h3>
                <p className="muted">
                  Ajoutez les éléments demandés par l’équipe. Une fois envoyés,
                  votre dossier repassera en cours de traitement.
                </p>

                <div className="form-block">
                  <label>Ajouter des justificatifs complémentaires</label>
                  <FileInput multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleCompletionFiles} fileName={completionFiles.length > 0 ? `${completionFiles.length} fichier(s) sélectionné(s)` : ""} />
                  {completionFiles.length > 0 ? (
                    <ul className="file-list">
                      {completionFiles.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="file-list-item">
                          <span>{file.name}</span>
                          <button type="button" className="file-remove-btn" onClick={() => removeCompletionFile(index)}>×</button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="form-block">
                  <label>Réponse ou précision à transmettre</label>
                  <textarea
                    rows="4"
                    placeholder="Ajoutez une précision pour l’équipe si nécessaire"
                    value={completionComment}
                    onChange={(e) => setCompletionComment(e.target.value)}
                  ></textarea>
                </div>

                {completionMessage ? (
                  <p className="completion-error-message">
                    {completionMessage}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="auth-buttons" style={{ marginTop: "24px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeSubmissionDetails}
                disabled={isCompletingSubmission}
              >
                Fermer
              </button>

              {selectedSubmission.status === "needs_info" ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCompleteSubmission}
                  disabled={isCompletingSubmission}
                >
                  {isCompletingSubmission
                    ? "Envoi..."
                    : "Envoyer le complément"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {confirmationPopup.open ? (
        <div className="success-popup-overlay" onClick={closeConfirmationPopup}>
          <div
            className="success-popup-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="success-popup-icon">✓</div>
            <h2>{confirmationPopup.title}</h2>
            <p>{confirmationPopup.description}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={closeConfirmationPopup}
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}

      {deleteAccountStep > 0 ? (
        <div className="modal-overlay" onClick={() => { setDeleteAccountStep(0); setDeleteAccountError(""); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {deleteAccountStep === 1 ? (
              <>
                <h2>Supprimer mon compte</h2>
                <p className="muted" style={{ marginTop: "12px" }}>
                  Vous êtes sur le point de supprimer votre compte Qlima Premium Club. Cette action entraîne la suppression définitive de&nbsp;:
                </p>
                <ul className="muted" style={{ paddingLeft: "20px", marginTop: "8px", lineHeight: "1.8" }}>
                  <li>Votre accès à l'espace fidélité</li>
                  <li>Vos points et l'historique de vos dossiers</li>
                  <li>Toutes vos données personnelles</li>
                </ul>
                <div className="auth-buttons" style={{ marginTop: "28px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setDeleteAccountStep(0)}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setDeleteAccountStep(2)}
                  >
                    Continuer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Confirmer la suppression</h2>
                <p className="muted" style={{ marginTop: "12px" }}>
                  Cette action est <strong>irréversible</strong>. Votre compte et toutes vos données seront supprimés définitivement. Êtes-vous certain(e) ?
                </p>
                {deleteAccountError ? (
                  <p style={{ marginTop: "16px", color: "#b42318", fontSize: "14px" }}>
                    {deleteAccountError}
                  </p>
                ) : null}
                <div className="auth-buttons" style={{ marginTop: "28px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setDeleteAccountStep(0); setDeleteAccountError(""); }}
                    disabled={isDeletingAccount}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={deleteAccount}
                    disabled={isDeletingAccount}
                  >
                    {isDeletingAccount ? "Suppression..." : "Supprimer définitivement"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {rewardModalOpen && selectedReward ? (
        <div className="modal-overlay" onClick={closeRewardModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Confirmer votre récompense</h2>
            <p className="muted">
              {selectedReward.code === "lifetime_warranty" ? (
                <>
                  Demandez la <strong>garantie à vie</strong> pour votre appareil à combustible liquide Qlima.
                </>
              ) : (
                <>
                  Êtes-vous certain(e) de vouloir utiliser{" "}
                  <strong>{selectedReward.points} points</strong> pour{" "}
                  <strong>{selectedReward.title}</strong> ?
                </>
              )}
            </p>

            {isWarrantyReward ? (
              <div className="refund-fields">
                <div
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "#f8f9fb",
                    color: "#475467",
                    fontSize: "14px",
                  }}
                >
                  {selectedReward.code === "lifetime_warranty"
                    ? "Renseignez la facture d’achat et le numéro de série de l’appareil pour lequel vous souhaitez activer la garantie à vie."
                    : "Cette récompense est valable uniquement pour un appareil à combustible liquide Qlima toujours sous garantie."}
                </div>

                <div className="form-block">
                  <label>
                    Facture d’achat de l’appareil (avec date d’achat)
                  </label>
                  <FileInput
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleRewardInvoiceFileChange}
                    fileName={rewardInvoiceFile?.name || ""}
                  />
                </div>

                <div className="form-block">
                  <label>
                    Numéro de série de l’appareil à combustible liquide
                  </label>
                  <input
                    type="text"
                    value={rewardForm.serialNumber}
                    onChange={(e) =>
                      handleRewardFormChange("serialNumber", e.target.value)
                    }
                    placeholder="Renseignez le numéro de série"
                  />
                </div>

                {selectedReward.code !== "lifetime_warranty" ? (
                  <div
                    className="form-block"
                    style={{ display: "flex", alignItems: "center", gap: "10px" }}
                  >
                    <input
                      id="warrantyConfirmed"
                      type="checkbox"
                      checked={rewardForm.warrantyConfirmed}
                      onChange={(e) =>
                        handleRewardFormChange(
                          "warrantyConfirmed",
                          e.target.checked,
                        )
                      }
                    />
                    <label
                      htmlFor="warrantyConfirmed"
                      style={{ marginBottom: 0 }}
                    >
                      Je confirme que l’appareil est toujours sous garantie.
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isDeliveryReward ? (
              <div className="refund-fields">
                <div
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "#f8f9fb",
                    color: "#475467",
                    fontSize: "14px",
                  }}
                >
                  Pour vous faire livrer ce produit, merci de renseigner vos
                  coordonnées ci-dessous.
                </div>

                <div className="form-block">
                  <label>Prénom</label>
                  <input
                    type="text"
                    value={rewardForm.deliveryFirstName}
                    onChange={(e) =>
                      handleRewardFormChange("deliveryFirstName", e.target.value)
                    }
                    placeholder="Votre prénom"
                  />
                </div>

                <div className="form-block">
                  <label>Nom</label>
                  <input
                    type="text"
                    value={rewardForm.deliveryLastName}
                    onChange={(e) =>
                      handleRewardFormChange("deliveryLastName", e.target.value)
                    }
                    placeholder="Votre nom"
                  />
                </div>

                <div className="form-block">
                  <label>Adresse e-mail</label>
                  <input
                    type="email"
                    value={rewardForm.deliveryEmail}
                    onChange={(e) =>
                      handleRewardFormChange("deliveryEmail", e.target.value)
                    }
                    placeholder="votre@email.com"
                  />
                </div>

                <div className="form-block">
                  <label>Numéro de téléphone</label>
                  <input
                    type="tel"
                    value={rewardForm.deliveryPhone}
                    onChange={(e) =>
                      handleRewardFormChange("deliveryPhone", e.target.value)
                    }
                    placeholder="0612345678"
                  />
                </div>

                <div className="form-block">
                  <label>Adresse postale</label>
                  <input
                    type="text"
                    value={rewardForm.deliveryAddress}
                    onChange={(e) =>
                      handleRewardFormChange("deliveryAddress", e.target.value)
                    }
                    placeholder="Numéro et nom de rue"
                  />
                </div>

                <div className="form-block">
                  <label>Code postal</label>
                  <input
                    type="text"
                    value={rewardForm.deliveryPostalCode}
                    onChange={(e) =>
                      handleRewardFormChange(
                        "deliveryPostalCode",
                        e.target.value,
                      )
                    }
                    placeholder="75000"
                  />
                </div>

                <div className="form-block">
                  <label>Ville</label>
                  <input
                    type="text"
                    value={rewardForm.deliveryCity}
                    onChange={(e) =>
                      handleRewardFormChange("deliveryCity", e.target.value)
                    }
                    placeholder="Votre ville"
                  />
                </div>
              </div>
            ) : null}

            {selectedReward.type === "refund" ? (
              <div className="refund-fields">
                {selectedReward.code === "refund_kristal_shine" ? (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "#f8f9fb",
                      color: "#475467",
                      fontSize: "14px",
                    }}
                  >
                    Cette offre est valable uniquement si vous avez acheté un
                    bidon de Kristal Shine de la marque Qlima. Vous devez
                    fournir votre RIB ainsi que le ticket de caisse ou la
                    facture prouvant l’achat de ce bidon.
                  </div>
                ) : selectedReward.code === "refund_50_appliance" ? (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "#f8f9fb",
                      color: "#475467",
                      fontSize: "14px",
                    }}
                  >
                    Cette offre est valable uniquement si vous avez acheté un
                    appareil à combustible liquide Qlima. Vous devez fournir
                    votre RIB ainsi que le ticket de caisse ou la facture
                    prouvant l’achat de cet appareil.
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "#f8f9fb",
                      color: "#475467",
                      fontSize: "14px",
                    }}
                  >
                    Merci de transmettre votre RIB en version PDF, généré par la
                    banque et au nom du titulaire du compte à rembourser.
                  </div>
                )}

                <div className="form-block">
                  <label>RIB bancaire en PDF</label>
                  <FileInput
                    accept=".pdf,application/pdf"
                    onChange={handleRewardBankDetailsFileChange}
                    fileName={rewardBankDetailsFile?.name || ""}
                  />
                  <p
                    style={{
                      marginTop: "12px",
                      fontSize: "12px",
                      color: "#98A2B3",
                    }}
                  >
                    * Le délai de traitement du virement peut varier et aller
                    jusqu’à 6 semaines.
                  </p>
                </div>

                {selectedReward.code === "refund_kristal_shine" ? (
                  <div className="form-block">
                    <label>
                      Ticket de caisse ou facture d’achat du bidon de Kristal
                      Shine
                    </label>
                    <FileInput
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleRewardPurchaseProofFileChange}
                      fileName={rewardPurchaseProofFile?.name || ""}
                    />
                  </div>
                ) : selectedReward.code === "refund_50_appliance" ? (
                  <div className="form-block">
                    <label>
                      Ticket de caisse ou facture d’achat de l’appareil à
                      combustible liquide Qlima
                    </label>
                    <FileInput
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleRewardPurchaseProofFileChange}
                      fileName={rewardPurchaseProofFile?.name || ""}
                    />
                  </div>
                ) : null}
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
