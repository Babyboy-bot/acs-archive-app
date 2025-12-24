"use client";

import { FormEvent, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import {
  getToken,
  getUtilisateurActif,
  SessionUtilisateur,
  supprimerSession,
} from "@/lib/session";
import { apiFetchJson } from "@/lib/api";
import { RoleUtilisateur } from "@/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import Blob3D from "@/components/ui/Blob3D";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AlertModal } from "@/components/ui/AlertModal";
import { applyTheme } from "@/lib/theme";

interface PieceJustificativeMetadata extends Record<string, unknown> {
  url?: string;
  nom_fichier?: string;
  titre?: string;
  description?: string;
  date_document?: string;
  date_document_formatee?: string;
  client?: string;
  exercice?: string;
  type?: string;
  highlights?: string[];
  fichier_url?: string;
  type_fichier?: string;
}

interface PieceJustificative {
  id: string;
  source: string;
  content: string;
  metadata: PieceJustificativeMetadata;
  score: number;
  isFallback?: boolean;
  url?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  pieces?: PieceJustificative[];
  isError?: boolean;
}

interface AssistantConversationSummary {
  id: string;
  titre: string;
  cree_le: string;
  modifie_le: string;
  dernier_message_le?: string | null;
  nombre_messages?: number;
}

const SUGGESTIONS = [
  "Recherche le document Avenant N° 0529 2024 de 3CB risque MRP",
  "Donne moi le bilan du système",
  "Qu'est ce qu'un risque dans notre contexte ?",
];

const LOCAL_STORAGE_KEY = "acs-assistant-conversation-v1";
const ACTIVE_CONVERSATION_KEY = "acs-assistant-active-conversation-id";

export default function ConsultantChatPage() {
  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const { estAuthentifie, chargement: authChargement } = useRequireAuth();

  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<
    AssistantConversationSummary[]
  >([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [utilisateur, setUtilisateur] = useState<SessionUtilisateur | null>(
    null
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // États pour les modales
  const [modaleSuppressionConversation, setModaleSuppressionConversation] = useState<{
    open: boolean;
    conversation: AssistantConversationSummary | null;
  }>({ open: false, conversation: null });
  const [alerteModal, setAlerteModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: "error" | "warning" | "success" | "info";
  }>({ open: false, title: "", message: "", variant: "error" });
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [modaleTutoriel, setModaleTutoriel] = useState(false);

  // État pour la modale de prévisualisation document
  const [modaleDocument, setModaleDocument] = useState<{
    open: boolean;
    piece: PieceJustificative | null;
    url: string | null;
  }>({ open: false, piece: null, url: null });

  // État pour le mode d'affichage des documents (grille ou liste)
  const [vueDocuments, setVueDocuments] = useState<"grille" | "liste">("grille");

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      if (stored === "dark" || stored === "light") return stored;
    }
    return "light";
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isDark = theme === "dark";

  useEffect(() => {
    setMounted(true);
    // Synchroniser le thème avec le localStorage dès le montage ou navigation
    const syncTheme = () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("theme");
        if (stored === "dark" || stored === "light") setTheme(stored);
      }
    };
    syncTheme();
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  // Appliquer le thème globalement (ajoute/enlève la classe 'dark' et persiste localStorage)
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const user = getUtilisateurActif();
    setUtilisateur(user);

    if (!user) return;

    const chargerConversations = async () => {
      try {
        const { data } = await apiFetchJson<any>("assistant/conversations/");
        const items = Array.isArray(data) ? data : data?.results ?? [];
        setConversations(items);

        // Tenter de restaurer la conversation active depuis le localStorage
        if (typeof window !== "undefined") {
          try {
            const savedId = window.localStorage.getItem(
              ACTIVE_CONVERSATION_KEY
            );
            if (
              savedId &&
              items.some((c: AssistantConversationSummary) => c.id === savedId)
            ) {
              setConversationId(savedId);
            }
          } catch (error) {
            console.error(
              "Erreur lors du chargement de la conversation active de l'assistant:",
              error
            );
          }
        }
      } catch (error) {
        console.error(
          "Erreur lors du chargement des conversations de l'assistant:",
          error
        );
      }
    };

    void chargerConversations();
  }, []);

  // Charger l'historique de conversation depuis localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Array<
        Omit<Message, "timestamp"> & { timestamp: string }
      >;

      const restored: Message[] = parsed.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));

      if (restored.length > 0) {
        setMessages(restored);
      }
    } catch (error) {
      console.error(
        "Erreur lors du chargement de l'historique de conversation:",
        error
      );
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sauvegarder l'historique à chaque mise à jour des messages
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const serialisable = messages.map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      }));
      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(serialisable)
      );
    } catch (error) {
      console.error(
        "Erreur lors de la sauvegarde de l'historique de conversation:",
        error
      );
    }
  }, [messages]);

  const handleLogout = () => {
    supprimerSession();
    router.push("/connexion");
  };

  const buildFileUrl = (fichierUrl: string): string => {
    if (!fichierUrl) return fichierUrl;
    if (!fichierUrl.startsWith("/")) return fichierUrl;

    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";
    const backendOrigin = apiBase.replace(/\/+$/, "").replace(/\/api$/, "");
    return `${backendOrigin}${fichierUrl}`;
  };

  const telechargerPiece = async (piece: PieceJustificative) => {
    try {
      const fichierUrl = piece.metadata?.fichier_url;
      if (!fichierUrl) {
        afficherAlerte("Document non disponible", "Ce document n'a pas de fichier téléchargeable", "warning");
        return;
      }

      const finalUrl = buildFileUrl(fichierUrl);

      const token = getToken();
      const headers: Record<string, string> = {
        Accept: "application/octet-stream, application/pdf, image/*, */*",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(finalUrl, { method: "GET", headers });
      if (!response.ok) throw new Error(`Erreur ${response.status}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = piece.metadata?.titre || `document-${piece.id}`;
      document.body.appendChild(lien);
      lien.click();
      document.body.removeChild(lien);
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Erreur téléchargement:", error);
      afficherAlerte("Erreur", "Erreur lors du téléchargement", "error");
    }
  };

  const ouvrirPiece = async (piece: PieceJustificative) => {
    try {
      let fichierUrl = piece.metadata?.fichier_url as string | undefined | null;

      // Fallback : si l'URL n'est pas présente dans les métadonnées (anciennes conversations),
      // on récupère le document complet via l'API /documents/<id>/
      if (!fichierUrl) {
        try {
          const { data } = await apiFetchJson<any>(`documents/${piece.id}/`);
          fichierUrl = (data?.fichier_url as string | undefined) ?? null;
        } catch (error) {
          console.error(
            "Erreur lors de la récupération du document pour ouverture:",
            error
          );
        }
      }

      if (!fichierUrl) {
        afficherAlerte("Document non disponible", "Ce document n'a pas de fichier à ouvrir", "warning");
        return;
      }

      const finalUrl = buildFileUrl(fichierUrl);

      // Ouvrir dans la modale au lieu d'un nouvel onglet
      setModaleDocument({ open: true, piece, url: finalUrl });
    } catch (error) {
      console.error("Erreur lors de l'ouverture du document:", error);
      afficherAlerte("Erreur", "Impossible d'ouvrir ce document pour le moment", "error");
    }
  };

  const imprimerPiece = (piece: PieceJustificative) => {
    const fichierUrl = piece.metadata?.fichier_url;
    if (!fichierUrl) {
      afficherAlerte("Document non disponible", "Ce document n'a pas de fichier imprimable", "warning");
      return;
    }

    const finalUrl = buildFileUrl(fichierUrl);

    const printWindow = window.open(finalUrl, "_blank");
    if (!printWindow) {
      afficherAlerte("Erreur", "Impossible d'ouvrir le document pour impression", "error");
      return;
    }

    printWindow.onload = () => {
      try {
        printWindow.print();
      } catch (error) {
        console.error("Erreur lors de l'impression :", error);
      }
    };
  };

  const envoyerMessage = async (e: FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const token = getToken();
      const utilisateur = getUtilisateurActif();

      let currentConversationId = conversationId;

      // Si l'ID de conversation n'est pas en mémoire (ex : rechargement / hot reload),
      // essayer de le récupérer depuis le localStorage.
      if (!currentConversationId && typeof window !== "undefined") {
        try {
          const savedId = window.localStorage.getItem(ACTIVE_CONVERSATION_KEY);
          if (savedId) {
            currentConversationId = savedId;
            setConversationId(savedId);
          }
        } catch (error) {
          console.error(
            "Erreur lors de la restauration de la conversation active de l'assistant:",
            error
          );
        }
      }
      try {
        const titrePropose =
          userMessage.content.length > 100
            ? userMessage.content.slice(0, 100)
            : userMessage.content;

        if (!currentConversationId) {
          const { data } = await apiFetchJson<any>("assistant/conversations/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titre: titrePropose }),
          });

          if (data && data.id) {
            currentConversationId = data.id as string;
            setConversationId(currentConversationId);
            if (typeof window !== "undefined") {
              try {
                window.localStorage.setItem(
                  ACTIVE_CONVERSATION_KEY,
                  currentConversationId
                );
              } catch (error) {
                console.error(
                  "Erreur lors de la sauvegarde de la conversation active de l'assistant:",
                  error
                );
              }
            }
            setConversations((prev) => {
              const existe = prev.find((c) => c.id === currentConversationId);
              if (existe) return prev;
              return [data as AssistantConversationSummary, ...prev];
            });
          }
        } else if (
          titrePropose &&
          !conversations.find((c) => c.id === currentConversationId && c.titre)
        ) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === currentConversationId
                ? { ...c, titre: c.titre || titrePropose }
                : c
            )
          );
        }

        if (currentConversationId) {
          await apiFetchJson<any>("assistant/messages/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversation: currentConversationId,
              role: "USER",
              contenu: question,
              metadata: {},
            }),
          });
        }
      } catch (error) {
        console.error(
          "Erreur lors de la sauvegarde de la conversation de l'assistant (message utilisateur):",
          error
        );
      }

      const response = await fetch("/api/assistant-demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(utilisateur?.role && { "x-user-role": utilisateur.role }),
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error("Erreur serveur");
      }

      const data = await response.json();

      // Normaliser les pièces justificatives
      let pieces: PieceJustificative[] = [];
      if (data.pieces && Array.isArray(data.pieces)) {
        pieces = data.pieces.map((p: any, i: number) => ({
          id: p.id || `piece-${i}`,
          source: p.source || "",
          content: p.content || "",
          metadata: p.metadata || {},
          score: p.score || 0,
          isFallback: p.isFallback || false,
        }));
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          data.narration?.texte ||
          data.resume ||
          "Je n'ai pas trouvé de résultat.",
        timestamp: new Date(),
        pieces,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (currentConversationId) {
        try {
          await apiFetchJson<any>("assistant/messages/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversation: currentConversationId,
              role: "ASSISTANT",
              contenu: assistantMessage.content,
              metadata: { pieces },
            }),
          });
        } catch (error) {
          console.error(
            "Erreur lors de la sauvegarde de la conversation de l'assistant (réponse):",
            error
          );
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Désolé, une erreur est survenue. Veuillez réessayer.",
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const ouvrirModaleSuppressionConversation = (conv: AssistantConversationSummary) => {
    setModaleSuppressionConversation({ open: true, conversation: conv });
  };

  const fermerModaleSuppressionConversation = () => {
    setModaleSuppressionConversation({ open: false, conversation: null });
  };

  const confirmerSuppressionConversation = async () => {
    const { conversation } = modaleSuppressionConversation;
    if (!conversation) return;

    setSuppressionEnCours(true);
    try {
      await apiFetchJson<any>(`assistant/conversations/${conversation.id}/`, {
        method: "DELETE",
      });

      setConversations((prev) => prev.filter((c) => c.id !== conversation.id));

      if (conversationId === conversation.id) {
        setConversationId(null);
        setMessages([]);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
            window.localStorage.removeItem(LOCAL_STORAGE_KEY);
          } catch (error) {
            console.error(
              "Erreur lors du nettoyage de la conversation active de l'assistant:",
              error
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "Erreur lors de la suppression de la conversation de l'assistant:",
        error
      );
      setAlerteModal({
        open: true,
        title: "Erreur",
        message: "Impossible de supprimer cette conversation pour le moment.",
        variant: "error",
      });
    } finally {
      setSuppressionEnCours(false);
      fermerModaleSuppressionConversation();
    }
  };

  const afficherAlerte = (title: string, message: string, variant: "error" | "warning" | "success" | "info" = "error") => {
    setAlerteModal({ open: true, title, message, variant });
  };

  const fermerAlerte = () => {
    setAlerteModal({ open: false, title: "", message: "", variant: "error" });
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const chargerConversation = async (id: string) => {
    if (!id || id === conversationId) return;

    setIsLoading(true);
    try {
      const { data } = await apiFetchJson<any>(
        `assistant/messages/?conversation=${id}`
      );
      const items = Array.isArray(data) ? data : data?.results ?? [];

      const nouveauxMessages: Message[] = items.map((m: any) => {
        const apiRole = (m.role as string) || "ASSISTANT";
        const role: "user" | "assistant" =
          apiRole === "USER" ? "user" : "assistant";
        const timestamp = m.cree_le
          ? new Date(m.cree_le as string)
          : new Date();
        const metadata = (m.metadata as Record<string, unknown> | null) ?? {};

        let pieces: PieceJustificative[] | undefined;
        const rawPieces = (metadata as any).pieces as any[] | undefined;
        if (Array.isArray(rawPieces) && rawPieces.length > 0) {
          pieces = rawPieces.map((p: any, index: number) => ({
            id: p.id || `piece-${index}`,
            source: p.source || "",
            content: p.content || "",
            metadata: p.metadata || {},
            score: p.score || 0,
            isFallback: p.isFallback || false,
          }));
        }

        return {
          id: (m.id as string) || `${role}-${timestamp.getTime()}`,
          role,
          content: (m.contenu as string) || "",
          timestamp,
          ...(pieces ? { pieces } : {}),
        };
      });

      setConversationId(id);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
        } catch (error) {
          console.error(
            "Erreur lors de la sauvegarde de la conversation active de l'assistant:",
            error
          );
        }
      }
      setMessages(nouveauxMessages);
    } catch (error) {
      console.error(
        "Erreur lors du chargement de la conversation de l'assistant:",
        error
      );
    } finally {
      setIsLoading(false);
    }
  };

  const nouvelleConversation = () => {
    setMessages([]);
    setConversationId(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
        window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
      } catch (error) {
        console.error(
          "Erreur lors de la réinitialisation de l'historique de conversation:",
          error
        );
      }
    }
  };

  // Attendre la vérification d'authentification (après tous les hooks)
  if (authChargement || !estAuthentifie) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-base">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-theme-secondary text-sm">
            Vérification de l'authentification...
          </p>
        </div>
      </div>
    );
  }

  if (!mounted) return null;
  return (
    <div
      className={"flex h-screen w-full overflow-x-hidden bg-theme-base text-theme-primary"}
    >
      {/* Sidebar moderne */}
      <aside
        className={`${sidebarOpen ? "w-72" : "w-0"
          } flex-shrink-0 overflow-hidden transition-all duration-500 ease-out bg-theme-card border-r border-theme`}
      >
        <div className="flex flex-col h-full p-4">
          {/* Header sidebar */}
          <div className="flex items-center gap-3 mb-16 px-2">
            <div className="">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Icon name="sparkles" size="sm" className="text-white" />
              </div>
            </div>
            <div>
              <h2
                className={"font-semibold text-sm text-theme-primary"}
              >
                ACS Assistant
              </h2>
              <p
                className={"text-xs text-theme-secondary"}
              >
                Intelligence documentaire
              </p>
            </div>
          </div>

          {/* Nouveau chat */}
          <button
            onClick={nouvelleConversation}
            className={"group flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium mb-4 transition-all duration-300 bg-theme-card border border-theme text-theme-primary hover:bg-theme-muted"}
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${isDark ? "bg-cyan-500/30" : "bg-cyan-500/20"
                }`}
            >
              <Icon
                name="plus"
                size="xs"
                className={isDark ? "text-cyan-300" : "text-cyan-600"}
              />
            </div>
            Nouvelle conversation
          </button>

          {/* Historique */}
          <div className="flex-1 overflow-y-auto space-y-1">
            <p
              className={"text-[10px] font-semibold uppercase tracking-wider px-3 py-2 text-theme-secondary"}
            >
              Historique
            </p>
            {conversations.map((conv) => (
              <div key={conv.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => chargerConversation(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      chargerConversation(conv.id);
                    }
                  }}
                  className={`group w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-200 cursor-pointer ${conv.id === conversationId
                      ? "bg-theme-muted text-theme-primary"
                      : "text-theme-secondary hover:bg-theme-muted hover:text-theme-primary"
                    }`}
                >
                  <Icon
                    name="document"
                    size="xs"
                    className={
                      conv.id === conversationId
                        ? isDark
                          ? "text-cyan-400"
                          : "text-cyan-500"
                        : ""
                    }
                  />
                  <span className="flex-1 truncate text-left text-[13px]">
                    {conv.titre || "Nouvelle conversation"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      ouvrirModaleSuppressionConversation(conv);
                    }}
                    className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all ${isDark
                        ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                        : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                      }`}
                    aria-label="Supprimer"
                  >
                    <Icon name="trash" size="xs" />
                  </button>
                </div>
              </div>
            ))}
            {conversations.length === 0 && (
              <div
                className={`px-3 py-8 text-center ${isDark ? "text-slate-600" : "text-slate-400"
                  }`}
              >
                <Icon
                  name="document"
                  size="lg"
                  className="mx-auto mb-2 opacity-30"
                />
                <p className="text-xs">Aucune conversation</p>
              </div>
            )}
          </div>

          {/* Utilisateur */}
          <div
            className={`mt-4 pt-4 ${isDark ? "border-t border-white/5" : "border-t border-slate-100"
              }`}
          >
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isDark ? "bg-white/5" : "bg-slate-50"
                }`}
            >
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-zinc-700 flex items-center justify-center text-white text-sm font-semibold">
                  {(
                    utilisateur?.prenom?.[0] ||
                    utilisateur?.nom?.[0] ||
                    "?"
                  ).toUpperCase()}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-slate-900"
                    }`}
                >
                  {utilisateur?.prenom} {utilisateur?.nom}
                </p>
                <p
                  className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-500"
                    }`}
                >
                  {utilisateur?.role === "ADMIN"
                    ? "Administrateur"
                    : "Consultant"}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-10 mb-4">
              {utilisateur?.role === "ADMIN" && (
                <button
                  onClick={() => router.push("/tableau-de-bord")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${isDark
                      ? "text-slate-400 hover:text-white hover:bg-white/5"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    }`}
                >
                  <Icon name="home" size="xs" />
                  Dashboard
                </button>
              )}
              <button
                onClick={handleLogout}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${isDark
                    ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                    : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                  }`}
              >
                <Icon name="logout" size="xs" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Zone principale */}
      <div className="flex-1 min-w-0 flex flex-col relative overflow-x-hidden">
        {/* Header flottant */}
        <div
          className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 ${isDark
              ? "bg-gradient-to-b from-theme-base via-theme-base/80 to-transparent"
              : "bg-gradient-to-b from-white via-white/80 to-transparent"
            }`}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2.5 rounded-xl transition-all duration-300 ${isDark
                ? "text-slate-500 hover:text-white hover:bg-white/10"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
          >
            <Icon name={sidebarOpen ? "chevron-left" : "menu"} size="sm" />
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setModaleTutoriel(true)}
              className={`p-2.5 rounded-xl transition-all duration-300 text-theme-secondary hover:text-theme-primary hover:bg-theme-muted`}
              title="Tutoriel"
            >
              <Icon name="info" size="sm" />
            </button>
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label={isDark ? "Mode clair" : "Mode sombre"}
              className={`relative w-14 h-8 flex items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner
                ${isDark ? "bg-slate-800" : "bg-gradient-to-r from-amber-100 to-cyan-100"}
              `}
            >
              {/* Thumb */}
              <span
                className={`absolute top-1 w-6 h-6 z-5 rounded-full shadow-md transition-all duration-300 flex items-center justify-center
                  ${isDark
                    ? "left-7 bg-slate-600 text-cyan-400"
                    : "left-1 bg-amber-400 text-white"
                  }
                `}
              >
                <Icon name={isDark ? "moon" : "sun"} size="xs" />
              </span>
              <span className="sr-only">
                {isDark ? "Mode clair" : "Mode sombre"}
              </span>
              {/* Track icons */}
              <span className="absolute right-2 top-2 text-blue-600 text-xs">
                <Icon name="moon" size="xs" />
              </span>
              <span className="absolute left-2 top-2 text-white text-xs">
                <Icon name="sun" size="xs" />
              </span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto pt-16">
          {messages.length === 0 ? (
            // Écran de bienvenue moderne
            <div className="h-full flex flex-col items-center justify-center px-4 pb-12">
              {/* Logo animé */}
              <Blob3D />

              <h1
                className={`text-4xl font-bold mb-3 bg-gradient-to-r from-cyan-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent`}
              >
                ACS Assistant
              </h1>
              <p
                className={`text-center max-w-lg mb-10 text-base ${isDark ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                Explorez vos archives intelligemment. Posez une question sur vos
                documents, contrats ou pièces justificatives.
              </p>

              {/* Suggestions modernes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full px-4">
                {SUGGESTIONS.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`group relative p-5 rounded-lg text-left text-sm transition-all duration-300 overflow-hidden ${isDark
                        ? "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30"
                        : "bg-white hover:bg-cyan-50/50 border border-slate-200 hover:border-cyan-300 shadow-sm hover:shadow-lg hover:shadow-cyan-500/10"
                      }`}
                  >
                    <div
                      className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`}
                    />
                    <div
                      className={`w-8 h-8 rounded-xl mb-3 flex items-center justify-center ${isDark ? "bg-cyan-500/20" : "bg-cyan-100"
                        }`}
                    >
                      <Icon
                        name="sparkles"
                        size="xs"
                        className={isDark ? "text-cyan-400" : "text-cyan-500"}
                      />
                    </div>
                    <p
                      className={`font-medium ${isDark ? "text-white" : "text-slate-700"
                        }`}
                    >
                      {suggestion}
                    </p>
                  </button>
                ))}
              </div>

              {/* Indicateur de capacités */}
              <div
                className={`mt-12 flex items-center gap-6 text-xs ${isDark ? "text-slate-600" : "text-slate-400"
                  }`}
              >
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Recherche sémantique
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Analyse de documents
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Réponses contextuelles
                </span>
              </div>
            </div>
          ) : (
            // Conversation moderne
            <div className="max-w-4xl mx-auto w-full py-8 px-6">
              {messages.map((message, idx) => (
                <div
                  key={message.id}
                  className={`mb-6 ${message.role === "user" ? "flex justify-end" : ""
                    }`}
                >
                  {message.role === "user" ? (
                    // Message utilisateur - bulle à droite
                    <div className="max-w-[80%]">
                      <div
                        className={`px-5 py-3.5 rounded-3xl rounded-tr-md ${isDark
                            ? "bg-gradient-to-r from-cyan-600 to-purple-600 text-white"
                            : "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-sm shadow-cyan-500/20"
                          }`}
                      >
                        <p className="text-[15px] leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                      <p
                        className={`text-[10px] mt-1.5 text-right ${isDark ? "text-slate-600" : "text-slate-400"
                          }`}
                      >
                        {message.timestamp.toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ) : (
                    // Message assistant
                    <div className="flex">
                      <div className="flex-1 max-w-[85%]">
                        <div
                          className={`rounded-tl-md px-5 py-4`}
                        >
                          <p
                            className={`text-[15px] leading-relaxed whitespace-pre-wrap ${isDark ? "text-slate-200" : "text-slate-700"
                              }`}
                          >
                            {message.content}
                          </p>

                          {/* Pièces justificatives modernisées */}
                          {message.pieces && message.pieces.length > 0 && (
                            <div
                              className={`mt-5 pt-4 ${isDark
                                  ? "border-t border-white/10"
                                  : "border-t border-slate-100"
                                }`}
                            >
                              {/* Header avec compteur et toggle vue */}
                              <div className="flex items-center justify-between mb-3">
                                <p
                                  className={`text-xs font-medium flex items-center gap-2 ${isDark ? "text-slate-400" : "text-slate-500"
                                    }`}
                                >
                                  <Icon name="document" size="xs" />
                                  {message.pieces.length} document
                                  {message.pieces.length > 1 ? "s" : ""} trouvé
                                  {message.pieces.length > 1 ? "s" : ""}
                                </p>
                                {/* Toggle vue grille/liste */}
                                <div className={`flex items-center rounded-lg p-0.5 ${isDark ? "bg-slate-800" : "bg-slate-100"
                                  }`}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setVueDocuments("grille"); }}
                                    className={`p-1.5 rounded-md transition-all ${vueDocuments === "grille"
                                        ? (isDark ? "bg-cyan-500/20 text-cyan-400" : "bg-white text-cyan-600 shadow-sm")
                                        : (isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")
                                      }`}
                                    title="Vue grille"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setVueDocuments("liste"); }}
                                    className={`p-1.5 rounded-md transition-all ${vueDocuments === "liste"
                                        ? (isDark ? "bg-cyan-500/20 text-cyan-400" : "bg-white text-cyan-600 shadow-sm")
                                        : (isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")
                                      }`}
                                    title="Vue liste"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Vue Grille */}
                              {vueDocuments === "grille" && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                  {message.pieces.map((piece) => (
                                    <div
                                      key={piece.id}
                                      onClick={() => void ouvrirPiece(piece)}
                                      className={`group rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${isDark
                                          ? "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50"
                                          : "bg-slate-50 hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300"
                                        }`}
                                    >
                                      {/* Miniature du document */}
                                      <div className={`relative aspect-[3/4] flex flex-col items-center justify-center overflow-hidden ${isDark ? "bg-slate-800" : "bg-gradient-to-br from-slate-100 to-slate-200"
                                        }`}>
                                        {(() => {
                                          const ext = piece.metadata?.fichier_url?.split('.').pop()?.toLowerCase() || '';
                                          const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
                                          const isPdf = ext === 'pdf';
                                          const proxyUrl = piece.metadata?.fichier_url
                                            ? `/api/proxy/document?url=${encodeURIComponent(piece.metadata.fichier_url)}`
                                            : null;

                                          if (isImage && proxyUrl) {
                                            return (
                                              <img
                                                src={proxyUrl}
                                                alt={piece.metadata?.titre || "Document"}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                              />
                                            );
                                          }

                                          if (isPdf && proxyUrl) {
                                            return (
                                              <iframe
                                                src={`${proxyUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                                                className="w-full h-full border-0 pointer-events-none"
                                                title={piece.metadata?.titre || "PDF"}
                                              />
                                            );
                                          }

                                          // Fallback: icône pour les autres types
                                          return (
                                            <>
                                              <div className={`w-12 h-14 rounded-lg flex items-center justify-center ${isDark ? "bg-blue-500/20" : "bg-blue-100"
                                                }`}>
                                                <Icon
                                                  name="document"
                                                  size="md"
                                                  className={isDark ? "text-blue-400" : "text-blue-500"}
                                                />
                                              </div>
                                              <span className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${isDark ? "text-blue-400" : "text-blue-500"
                                                }`}>
                                                {ext.toUpperCase() || 'DOC'}
                                              </span>
                                            </>
                                          );
                                        })()}
                                        {/* Overlay au hover */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                                          <span className="text-white text-xs font-medium flex items-center gap-1">
                                            <Icon name="eye" size="xs" className="text-white" />
                                            Voir
                                          </span>
                                        </div>
                                      </div>
                                      {/* Infos du document */}
                                      <div className="p-2">
                                        <h4
                                          className={`font-medium text-xs truncate group-hover:text-cyan-500 transition-colors ${isDark ? "text-white" : "text-slate-800"
                                            }`}
                                        >
                                          {piece.metadata?.titre || piece.source || "Document"}
                                        </h4>
                                        {piece.metadata?.client && (
                                          <span className={`text-[9px] truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                            {piece.metadata.client}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Vue Liste */}
                              {vueDocuments === "liste" && (
                                <div className="space-y-2">
                                  {message.pieces.map((piece) => {
                                    const ext = piece.metadata?.fichier_url?.split('.').pop()?.toLowerCase() || '';
                                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
                                    const isPdf = ext === 'pdf';
                                    return (
                                      <div
                                        key={piece.id}
                                        onClick={() => void ouvrirPiece(piece)}
                                        className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${isDark
                                            ? "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50"
                                            : "bg-slate-50 hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300"
                                          }`}
                                      >
                                        {/* Icône type fichier */}
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isPdf
                                            ? (isDark ? "bg-red-500/20" : "bg-red-100")
                                            : isImage
                                              ? (isDark ? "bg-emerald-500/20" : "bg-emerald-100")
                                              : (isDark ? "bg-blue-500/20" : "bg-blue-100")
                                          }`}>
                                          <Icon
                                            name="document"
                                            size="sm"
                                            className={
                                              isPdf
                                                ? (isDark ? "text-red-400" : "text-red-500")
                                                : isImage
                                                  ? (isDark ? "text-emerald-400" : "text-emerald-500")
                                                  : (isDark ? "text-blue-400" : "text-blue-500")
                                            }
                                          />
                                        </div>
                                        {/* Infos */}
                                        <div className="flex-1 min-w-0">
                                          <h4 className={`font-medium text-sm truncate group-hover:text-cyan-500 transition-colors ${isDark ? "text-white" : "text-slate-800"
                                            }`}>
                                            {piece.metadata?.titre || piece.source || "Document"}
                                          </h4>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            {piece.metadata?.client && (
                                              <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                                {piece.metadata.client}
                                              </span>
                                            )}
                                            {piece.metadata?.type && (
                                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"
                                                }`}>
                                                {piece.metadata.type}
                                              </span>
                                            )}
                                            <span className={`text-[10px] font-medium uppercase ${isPdf
                                                ? (isDark ? "text-red-400" : "text-red-500")
                                                : isImage
                                                  ? (isDark ? "text-emerald-400" : "text-emerald-500")
                                                  : (isDark ? "text-blue-400" : "text-blue-500")
                                              }`}>
                                              {ext.toUpperCase() || 'DOC'}
                                            </span>
                                          </div>
                                        </div>
                                        {/* Action */}
                                        <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "text-cyan-400" : "text-cyan-600"
                                          }`}>
                                          <Icon name="eye" size="sm" />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <p
                          className={`text-[10px] mt-1.5 ${isDark ? "text-slate-600" : "text-slate-400"
                            }`}
                        >
                          {message.timestamp.toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator moderne */}
              {isLoading && (
                <div className="flex gap-4 mb-6">
                  <div className="flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                      <Icon
                        name="sparkles"
                        size="sm"
                        className="text-white animate-pulse"
                      />
                    </div>
                  </div>
                  <div
                    className={`flex-1 rounded-2xl rounded-tl-md px-5 py-4 ${isDark
                        ? "bg-white/5 border border-white/10"
                        : "bg-white border border-slate-200 shadow-sm"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div
                          className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-cyan-400" : "bg-cyan-500"
                            }`}
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-purple-400" : "bg-purple-500"
                            }`}
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-fuchsia-400" : "bg-fuchsia-500"
                            }`}
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                      <span
                        className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"
                          }`}
                      >
                        Recherche en cours...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Zone de saisie moderne */}
        <div
          className={`p-2 mb-2`}
        >
          <form onSubmit={envoyerMessage} className="max-w-3xl mx-auto">
            <div
              className={`relative flex items-center rounded-xl transition-all duration-300 ${isDark
                  ? "bg-white/5 border border-white/10 focus-within:border-cyan-500/50 focus-within:bg-white/10"
                  : "bg-white border border-slate-200 shadow-lg shadow-slate-200/50 focus-within:border-cyan-400 focus-within:shadow-cyan-500/10"
                }`}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez votre question..."
                disabled={isLoading}
                className={`flex-1 py-4 px-5 bg-transparent rounded-l-xl outline-none text-[15px] ${isDark
                    ? "text-white"
                    : "text-slate-800"
                  }`}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`p-4 rounded-r-xl transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed ${input.trim() && !isLoading
                    ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
                    : isDark
                      ? "bg-white/5 text-slate-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
              >
                <Icon name="arrow-right" size="sm" />
              </button>
            </div>
            <p
              className={`text-[11px] text-center mt-2 ${isDark ? "text-slate-600" : "text-slate-400"
                }`}
            >
              ACS Assistant peut faire des erreurs. Vérifiez les informations
              importantes.
            </p>
          </form>
        </div>
      </div>

      {/* Modale de confirmation suppression conversation */}
      <ConfirmModal
        isOpen={modaleSuppressionConversation.open}
        onClose={fermerModaleSuppressionConversation}
        onConfirm={confirmerSuppressionConversation}
        title="Supprimer la conversation"
        message={`Êtes-vous sûr de vouloir supprimer la conversation "${modaleSuppressionConversation.conversation?.titre || "Nouvelle conversation"}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        isLoading={suppressionEnCours}
        isDark={isDark}
      />

      {/* Modale d'alerte */}
      <AlertModal
        isOpen={alerteModal.open}
        onClose={fermerAlerte}
        title={alerteModal.title}
        message={alerteModal.message}
        variant={alerteModal.variant}
        isDark={isDark}
      />

      {/* Modale Tutoriel Assistant */}
      {modaleTutoriel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModaleTutoriel(false)
          }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative max-w-2xl w-full p-6 rounded-2xl bg-theme-card border border-theme shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutoriel-title"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-theme-muted flex items-center justify-center flex-shrink-0">
                <Icon name="info" size="sm" className="text-theme-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="tutoriel-title" className="text-lg font-semibold text-theme-primary">Comment utiliser l'Assistant IA</h3>
                <p className="mt-1 text-sm text-theme-secondary">
                  L’assistant répond à des questions sur vos documents et exercices. Pour de meilleurs résultats, soyez précis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModaleTutoriel(false)}
                className="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-muted"
                aria-label="Fermer"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium text-theme-primary mb-1">Conseils</h4>
                <ul className="list-disc pl-5 space-y-1 text-theme-secondary">
                  <li>Précisez le <span className="font-medium">client</span>, l’<span className="font-medium">année</span>, le <span className="font-medium">type de document</span> et le <span className="font-medium">risque</span>.</li>
                  <li>Utilisez des mots-clés exacts (ex: « avenant », « police », « échéance »).</li>
                  <li>Ajoutez des filtres temporels: « ce mois », « 2023 », « entre 2019 et 2021 ».</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-theme-primary mb-1">Exemples de requêtes</h4>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-theme-muted text-theme-primary flex items-start justify-between gap-3">
                    <span className="text-sm">Trouve-moi l’avenant 2018 du client 3CB risque Automobile</span>
                    <button
                      type="button"
                      onClick={() => { setInput("Trouve-moi l’avenant 2018 du client 3CB risque Automobile"); setModaleTutoriel(false); }}
                      className="shrink-0 px-3 py-1.5 text-xs rounded-md bg-theme-card border border-theme hover:bg-theme-muted"
                    >
                      Utiliser
                    </button>
                  </div>
                  <div className="p-3 rounded-lg bg-theme-muted text-theme-primary">Quels sont les derniers avenants de 2025 ?</div>
                  <div className="p-3 rounded-lg bg-theme-muted text-theme-primary">Montre-moi les documents du client SANLAM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale de prévisualisation document plein écran */}
      {modaleDocument.open && modaleDocument.url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setModaleDocument({ open: false, piece: null, url: null })}
        >
          <div
            className={`relative w-[95vw] h-[95vh] max-w-6xl rounded-2xl overflow-hidden shadow-2xl ${isDark ? "bg-slate-900" : "bg-white"
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"
              }`}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Icon name="document" size="sm" className={isDark ? "text-cyan-400" : "text-cyan-600"} />
                <h3 className={`font-medium text-sm truncate ${isDark ? "text-white" : "text-slate-800"}`}>
                  {modaleDocument.piece?.metadata?.titre || modaleDocument.piece?.source || "Document"}
                </h3>
                {modaleDocument.piece?.metadata?.client && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-600"
                    }`}>
                    {modaleDocument.piece.metadata.client}
                  </span>
                )}
              </div>
              <button
                onClick={() => setModaleDocument({ open: false, piece: null, url: null })}
                className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                  }`}
                title="Fermer"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            {/* Contenu du document */}
            <div className="w-full h-[calc(100%-56px)] overflow-auto">
              {(() => {
                const fichierUrl = modaleDocument.piece?.metadata?.fichier_url || modaleDocument.url;
                const proxyUrl = `/api/proxy/document?url=${encodeURIComponent(fichierUrl)}`;
                const ext = fichierUrl.split('.').pop()?.toLowerCase() || '';
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
                const isPdf = ext === 'pdf';

                if (isImage) {
                  return (
                    <div className="w-full h-full flex items-center justify-center p-4">
                      <img
                        src={proxyUrl}
                        alt={modaleDocument.piece?.metadata?.titre || "Document"}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                      />
                    </div>
                  );
                }

                if (isPdf) {
                  return (
                    <iframe
                      src={`${proxyUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                      className="w-full h-full border-0"
                      title={modaleDocument.piece?.metadata?.titre || "Document PDF"}
                    />
                  );
                }

                return (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                    <Icon name="document" size="xl" className={isDark ? "text-slate-600" : "text-slate-300"} />
                    <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Aperçu non disponible pour ce type de fichier
                    </p>
                    <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      {ext.toUpperCase()}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
