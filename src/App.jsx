import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { supabase } from "./lib/supabase";
import Admin from "./Admin";

const STORAGE_BUCKET = "loyalty-documents";

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
  { name: "Kristal Shine", points: 4 },
  { name: "Bright 20 L", points: 3 },
  { name: "Spark 20 L", points: 2 },
  { name: "Bright 10 L", points: 1 },
  { name: "Pure 20 L", points: 1 },
];

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
  });
  const [rewardInvoiceFile, setRewardInvoiceFile] = useState(null);
  const [rewardBankDetailsFile, setRewardBankDetailsFile] = useState(null);
  const [rewardPurchaseProofFile, setRewardPurchaseProofFile] = useState(null);
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
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
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

  const nextReward = useMemo(() => {
    return rewards.find((reward) => reward.points > userPoints) || null;
  }, [userPoints]);

  const progressPercent = nextReward
    ? Math.min((userPoints / nextReward.points) * 100, 100)
    : 100;

  const latestRedemption = rewardRedemptions[0] || null;
  const isWarrantyReward = selectedReward?.code === "extended_warranty_1y";

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

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(files);
  };

  const handleCompletionFiles = (e) => {
    const files = Array.from(e.target.files || []);
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

  const handleRewardInvoiceFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setRewardInvoiceFile(file);
  };

  const handleRewardBankDetailsFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setRewardBankDetailsFile(file);
  };

  const handleRewardPurchaseProofFileChange = (e) => {
    const file = e.target.files?.[0] || null;
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

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(uniqueName, file);

      if (error) throw error;

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

      const { error } = await supabase
        .from("loyalty_submissions")
        .update({
          documents: [...existingDocuments, ...uploaded],
          comments: nextComments,
          status: "pending",
        })
        .eq("id", selectedSubmission.id);

      if (error) throw error;

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
    setRewardInvoiceFile(null);
    setRewardBankDetailsFile(null);
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

  const uploadFiles = async () => {
    if (!session?.user || uploadedFiles.length === 0) return [];

    const uploaded = [];

    for (const file of uploadedFiles) {
      const extension = file.name.split(".").pop();
      const uniqueName = `${session.user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(uniqueName, file);

      if (error) throw error;

      uploaded.push({
        file_name: file.name,
        file_path: uniqueName,
      });
    }

    return uploaded;
  };

  const uploadRewardSupportingFile = async (file, folder, documentKind) => {
    if (!session?.user || !file) return null;

    const extension = file.name.split(".").pop();
    const uniqueName = `${session.user.id}/${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(uniqueName, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (error) throw error;

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
    const isWarrantyReward = selectedReward.code === "extended_warranty_1y";

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

      if (!rewardForm.warrantyConfirmed) {
        setRewardModalMessage(
          "Cette récompense est réservée aux appareils toujours sous garantie. Merci de confirmer cette information.",
        );
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
          ? rewardForm.warrantyConfirmed
          : false,
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
            <div className="section-header-with-tabs">
              <div>
                <h2>Mes demandes</h2>
                <p className="muted">
                  Retrouvez vos dossiers par statut et ouvrez chaque demande
                  pour voir le détail.
                </p>
              </div>
            </div>

            <div className="customer-request-tabs">
              {customerSubmissionTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`customer-request-tab ${activeSubmissionTab === tab.key ? "active" : ""}`}
                  onClick={() => setActiveSubmissionTab(tab.key)}
                >
                  <span>{tab.label}</span>
                  <strong>{submissionCounts[tab.key] || 0}</strong>
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

            <div className="reward-list">
              {rewards.map((reward) => {
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
                  <input
                    type="file"
                    multiple
                    onChange={handleCompletionFiles}
                  />
                  {completionFiles.length > 0 ? (
                    <ul className="file-list">
                      {completionFiles.map((file, index) => (
                        <li key={`${file.name}-${index}`}>{file.name}</li>
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

      {rewardModalOpen && selectedReward ? (
        <div className="modal-overlay" onClick={closeRewardModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Confirmer votre récompense</h2>
            <p className="muted">
              Êtes-vous certain(e) de vouloir utiliser{" "}
              <strong>{selectedReward.points} points</strong> pour{" "}
              <strong>{selectedReward.title}</strong> ?
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
                  Cette récompense est valable uniquement pour un appareil à
                  combustible liquide Qlima toujours sous garantie.
                </div>

                <div className="form-block">
                  <label>
                    Facture d’achat de l’appareil (avec date d’achat)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleRewardInvoiceFileChange}
                  />
                  {rewardInvoiceFile ? (
                    <p className="muted" style={{ marginTop: "8px" }}>
                      Fichier sélectionné : {rewardInvoiceFile.name}
                    </p>
                  ) : null}
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
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleRewardBankDetailsFileChange}
                  />
                  {rewardBankDetailsFile ? (
                    <p className="muted" style={{ marginTop: "8px" }}>
                      Fichier sélectionné : {rewardBankDetailsFile.name}
                    </p>
                  ) : null}
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
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleRewardPurchaseProofFileChange}
                    />
                    {rewardPurchaseProofFile ? (
                      <p className="muted" style={{ marginTop: "8px" }}>
                        Fichier sélectionné : {rewardPurchaseProofFile.name}
                      </p>
                    ) : null}
                  </div>
                ) : selectedReward.code === "refund_50_appliance" ? (
                  <div className="form-block">
                    <label>
                      Ticket de caisse ou facture d’achat de l’appareil à
                      combustible liquide Qlima
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleRewardPurchaseProofFileChange}
                    />
                    {rewardPurchaseProofFile ? (
                      <p className="muted" style={{ marginTop: "8px" }}>
                        Fichier sélectionné : {rewardPurchaseProofFile.name}
                      </p>
                    ) : null}
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
