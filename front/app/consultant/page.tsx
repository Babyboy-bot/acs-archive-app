"use client";

import { FormEvent, useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import {
  getToken,
  getUtilisateurActif,
  SessionUtilisateur,
  seDeconnecter,
} from "@/lib/session";
import { apiFetchJson } from "@/lib/api";
import { RoleUtilisateur } from "@/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import dynamic from "next/dynamic";
const Blob3D = dynamic(() => import("@/components/ui/Blob3D"), { ssr: false });
import ReactMarkdown from "react-markdown";
import { AlertModal } from "@/components/ui/AlertModal";
// PdfThumbnail retiré - on utilise iframe directement avec l'URL media

// Type pour les suggestions de clients
type ClientSuggestion = {
  id: string;
  nom: string;
  numero_client?: string;
  type?: string;
};
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
  isStreaming?: boolean;
}


// Générer des suggestions intelligentes basées sur le contexte
function genererSuggestionsIntelligentes(messages: Message[]): string[] {
  const suggestions: string[] = [];
  const now = new Date();
  const moisActuel = now.toLocaleDateString("fr-FR", { month: "long" });
  const anneeActuelle = now.getFullYear();

  suggestions.push(`Documents ajoutés en ${moisActuel} ${anneeActuelle}`);

  // Extraire des clients potentiels depuis les messages utilisateur
  const clientsMentionnes = new Set<string>();
  messages
    .filter((m) => m.role === "user")
    .slice(-20)
    .forEach((m) => {
      const matches = m.content.match(/\b([A-Z0-9]{2,6})\b/gi);
      if (!matches) return;
      matches.forEach((candidate) => {
        const value = candidate.toUpperCase();
        if (value.length >= 2 && value.length <= 6 && /[A-Z]/i.test(value)) {
          clientsMentionnes.add(value);
        }
      });
    });

  const topClients = [...clientsMentionnes].slice(0, 2);
  topClients.forEach((client) => {
    suggestions.push(`Derniers documents de ${client}`);
  });

  suggestions.push(`Factures de ${anneeActuelle}`);
  suggestions.push("Avenants récents");

  return suggestions.slice(0, 4);
}

const SUGGESTIONS_DEFAUT = [
  "Avenant N° 0529 2024 de 3CB risque MRP",
  "trouve moi le document N°190",
  "trouve moi le document avec le montant 29 185 franc",
];



export default function ConsultantChatPage() {
  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const { estAuthentifie, chargement: authChargement } = useRequireAuth();

  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Autocomplétion clients
  const [clientSuggestions, setClientSuggestions] = useState<ClientSuggestion[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const clientSearchDebounce = useRef<NodeJS.Timeout | null>(null);
  const [utilisateur, setUtilisateur] = useState<SessionUtilisateur | null>(
    null
  );
  // États pour les modales
  const [alerteModal, setAlerteModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: "error" | "warning" | "success" | "info";
  }>({ open: false, title: "", message: "", variant: "error" });
  const [etapeOnboarding, setEtapeOnboarding] = useState<number | null>(null);

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
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('acs_onboarding_done')) {
      setEtapeOnboarding(0);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogout = async () => {
    await seDeconnecter();
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
      logActionDoc(piece, 'DOWNLOAD')

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

  const logActionDoc = (piece: PieceJustificative, action: string) => {
    apiFetchJson(`/documents/${piece.id}/log-view/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => {})
  }

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
      logActionDoc(piece, 'READ')
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
    logActionDoc(piece, 'PRINT')

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
          }
        }
      } catch (error) {
        console.error("Erreur création conversation:", error);
      }

      if (!currentConversationId) {
        throw new Error("Conversation introuvable");
      }

      // Ajouter un message assistant vide en attente du stream
      const streamingMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: streamingMsgId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true },
      ]);
      setIsLoading(false);

      // Appel SSE streaming
      const streamResponse = await fetch("/api/assistant-demo/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(utilisateur?.role && { "x-user-role": utilisateur.role }),
        },
        body: JSON.stringify({ question, conversationId: currentConversationId }),
      });

      if (!streamResponse.ok || !streamResponse.body) {
        throw new Error("Erreur serveur streaming");
      }

      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;
          try {
            const event = JSON.parse(dataStr) as { type: string; chunk?: string; pieces?: any[] };
            if (event.type === "pieces" && Array.isArray(event.pieces)) {
              const pieces: PieceJustificative[] = event.pieces.map((p: any, i: number) => ({
                id: p.id || `piece-${i}`,
                source: p.source || "",
                content: p.content || "",
                metadata: p.metadata || {},
                score: p.score || 0,
                isFallback: false,
              }));
              setMessages((prev) =>
                prev.map((m) => (m.id === streamingMsgId ? { ...m, pieces } : m))
              );
            } else if (event.type === "chunk" && event.chunk) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingMsgId ? { ...m, content: m.content + event.chunk } : m
                )
              );
            } else if (event.type === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingMsgId ? { ...m, isStreaming: false } : m
                )
              );
            }
          } catch {
            // chunk SSE non JSON, ignorer
          }
        }
      }
      // S'assurer que isStreaming est false en fin de stream
      setMessages((prev) =>
        prev.map((m) => (m.id === streamingMsgId ? { ...m, isStreaming: false } : m))
      );
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


  const afficherAlerte = (title: string, message: string, variant: "error" | "warning" | "success" | "info" = "error") => {
    setAlerteModal({ open: true, title, message, variant });
  };

  const fermerAlerte = () => {
    setAlerteModal({ open: false, title: "", message: "", variant: "error" });
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  // Recherche de clients pour autocomplétion
  const rechercherClients = useCallback(async (query: string) => {
    if (query.length < 2) {
      setClientSuggestions([]);
      setShowClientSuggestions(false);
      return;
    }
    try {
      const { data } = await apiFetchJson<ClientSuggestion[]>(
        `/clients/?search=${encodeURIComponent(query)}&simple=1`
      );
      const clients = Array.isArray(data) ? data.slice(0, 6) : [];
      setClientSuggestions(clients);
      setShowClientSuggestions(clients.length > 0);
      setSelectedSuggestionIndex(-1);
    } catch (error) {
      console.error("Erreur autocomplétion clients:", error);
      setClientSuggestions([]);
      setShowClientSuggestions(false);
    }
  }, []);

  // Gérer le changement d'input avec détection de client
  // L'autocomplétion ne se déclenche QUE après des mots-clés spécifiques
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    
    // Détecter UNIQUEMENT après des mots-clés précis:
    // - "de X", "du X", "pour X" (après documents, factures, etc.)
    // - "client X"
    // - "@X" (raccourci explicite)
    const clientPatterns = [
      /(?:de|du|pour)\s+([A-Z0-9]{2,})$/i,  // "de 3CB", "du 3CB", "pour 3CB"
      /client\s+([A-Z0-9]{2,})$/i,           // "client 3CB"
      /@([A-Z0-9]{2,})$/i,                   // "@3CB" (raccourci)
    ];
    
    let clientQuery: string | null = null;
    for (const pattern of clientPatterns) {
      const match = value.match(pattern);
      if (match && match[1]) {
        clientQuery = match[1];
        break;
      }
    }
    
    if (clientQuery && clientQuery.length >= 2) {
      if (clientSearchDebounce.current) clearTimeout(clientSearchDebounce.current);
      clientSearchDebounce.current = setTimeout(() => rechercherClients(clientQuery!), 200);
    } else {
      setShowClientSuggestions(false);
      setClientSuggestions([]);
    }
  };

  // Sélectionner un client suggéré
  const handleSelectClient = (client: ClientSuggestion) => {
    // Remplacer le dernier mot par le nom du client
    const words = input.split(/\s+/);
    words[words.length - 1] = client.nom;
    setInput(words.join(" ") + " ");
    setShowClientSuggestions(false);
    setClientSuggestions([]);
  };

  // Navigation clavier dans les suggestions
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showClientSuggestions || clientSuggestions.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < clientSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : clientSuggestions.length - 1
      );
    } else if (e.key === "Enter" && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      handleSelectClient(clientSuggestions[selectedSuggestionIndex]);
    } else if (e.key === "Escape") {
      setShowClientSuggestions(false);
    }
  };

  const nouvelleConversation = () => {
    setMessages([]);
    setConversationId(null);
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
      {/* Zone principale */}
      <div className="flex-1 min-w-0 flex flex-col relative overflow-x-hidden">
        {/* Header */}
        <div
          className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 ${
            isDark
              ? "bg-gradient-to-b from-[#0f0f0f] via-[#0f0f0f]/80 to-transparent"
              : "bg-gradient-to-b from-white via-white/80 to-transparent"
          }`}
        >
          {/* Logo + titre */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Icon name="sparkles" size="xs" className="text-white" />
            </div>
            <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-800"}`}>ACS
              <span className="hidden sm:inline"> Assistant</span>
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Nouvelle conversation */}
            <button
              onClick={nouvelleConversation}
              title="Nouvelle conversation"
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                isDark ? "border-white/10 text-slate-400 hover:text-white hover:bg-white/10" : "border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <Icon name="plus" size="xs" />
              <span className="hidden sm:inline">Nouveau</span>
            </button>

            {/* Aide / Tutoriel */}
            <button
              onClick={() => setEtapeOnboarding(0)}
              title="Guide d'utilisation"
              className={`w-7 h-7 rounded-full border text-xs font-bold transition-colors ${
                isDark ? "border-white/20 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50" : "border-slate-300 text-slate-500 hover:text-cyan-600 hover:border-cyan-400"
              }`}
            >
              ?
            </button>

            {/* Dashboard (admin) */}
            {utilisateur?.role === "ADMIN" && (
              <button
                onClick={() => router.push("/tableau-de-bord")}
                title="Dashboard"
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                <Icon name="home" size="xs" />
              </button>
            )}

            {/* Toggle thème — pill sur desktop, icône sur mobile */}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label={isDark ? "Mode clair" : "Mode sombre"}
              className={`sm:hidden p-2 rounded-lg transition-colors ${isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
            >
              <Icon name={isDark ? "moon" : "sun"} size="xs" />
            </button>
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label={isDark ? "Mode clair" : "Mode sombre"}
              className={`hidden sm:relative sm:flex w-14 h-8 items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner ${
                isDark ? "bg-slate-800" : "bg-gradient-to-r from-amber-100 to-cyan-100"
              }`}
            >
              <span className={`absolute top-1 w-6 h-6 rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${
                isDark ? "left-7 bg-slate-600 text-cyan-400" : "left-1 bg-amber-400 text-white"
              }`}>
                <Icon name={isDark ? "moon" : "sun"} size="xs" />
              </span>
              <span className="sr-only">{isDark ? "Mode clair" : "Mode sombre"}</span>
              <span className="absolute right-2 top-2 text-blue-600 text-xs"><Icon name="moon" size="xs" /></span>
              <span className="absolute left-2 top-2 text-white text-xs"><Icon name="sun" size="xs" /></span>
            </button>

            {/* Avatar utilisateur */}
            <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
              isDark ? "bg-white/5" : "bg-slate-100"
            }`}>
              <div className="w-6 h-6 rounded-md bg-zinc-700 flex items-center justify-center text-white text-xs font-semibold">
                {(utilisateur?.prenom?.[0] || utilisateur?.nom?.[0] || "?").toUpperCase()}
              </div>
              <span className={`text-xs hidden sm:block ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                {utilisateur?.prenom}
              </span>
            </div>

            {/* Déconnexion */}
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className={`p-2 rounded-lg transition-colors ${
                isDark ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-400 hover:text-red-500 hover:bg-red-50"
              }`}
            >
              <Icon name="logout" size="xs" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto pt-16">
          {messages.length === 0 ? (
            // Écran de bienvenue moderne
            <div className="h-full flex flex-col items-center justify-center px-4 pb-4 sm:pb-12">
              {/* Logo animé — masqué sur mobile pour gagner de l'espace */}
              <div className="hidden sm:block"><Blob3D /></div>

              <h1
                className={`text-2xl sm:text-4xl font-bold mb-2 sm:mb-3 mt-4 sm:mt-0 bg-gradient-to-r from-cyan-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent`}
              >
                ACS Assistant
              </h1>
              <p
                className={`text-center max-w-lg mb-5 sm:mb-10 text-sm sm:text-base ${isDark ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                Explorez vos archives intelligemment. Posez une question sur vos
                documents, contrats ou pièces justificatives.
              </p>

              {/* Suggestions intelligentes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 max-w-4xl w-full px-2 sm:px-4">
                {(messages.length > 0
                  ? genererSuggestionsIntelligentes(messages)
                  : SUGGESTIONS_DEFAUT
                ).map((suggestion: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`group relative flex sm:block items-center gap-3 p-3 sm:p-5 rounded-lg text-left text-sm transition-all duration-300 overflow-hidden ${
                      isDark
                        ? "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30"
                        : "bg-white hover:bg-cyan-50/50 border border-slate-200 hover:border-cyan-300 shadow-sm hover:shadow-lg hover:shadow-cyan-500/10"
                    }`}
                  >
                    <div
                      className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`}
                    />
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl sm:mb-3 flex-shrink-0 flex items-center justify-center ${isDark ? "bg-cyan-500/20" : "bg-cyan-100"
                        }`}
                    >
                      <Icon
                        name="sparkles"
                        size="xs"
                        className={isDark ? "text-cyan-400" : "text-cyan-500"}
                      />
                    </div>
                    <p
                      className={`font-medium text-xs sm:text-sm ${isDark ? "text-white" : "text-slate-700"
                        }`}
                    >
                      {suggestion}
                    </p>
                  </button>
                ))}
              </div>

              {/* Indicateur de capacités */}
              <div
                className={`mt-6 sm:mt-12 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs ${isDark ? "text-slate-600" : "text-slate-400"
                  }`}
              >
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Recherche par mots-clés
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Analyse de documents
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Réponses par IA
                </span>
              </div>
            </div>
          ) : (
            // Conversation moderne
            <div className="max-w-4xl mx-auto w-full py-4 sm:py-8 px-3 sm:px-6">
              {messages.map((message, idx) => (
                <div
                  key={message.id}
                  className={`mb-6 ${message.role === "user" ? "flex justify-end" : ""
                    }`}
                >
                  {message.role === "user" ? (
                    // Message utilisateur - bulle à droite
                    <div className="max-w-[90%] sm:max-w-[80%]">
                      <div
                        className={`px-5 py-3.5 rounded-3xl rounded-tr-md ${
                          isDark
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
                          <div className={`text-[15px] leading-relaxed ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                            {message.isStreaming && !message.content ? (
                              <span className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-cyan-400" : "bg-cyan-500"}`} style={{ animationDelay: "0ms" }} />
                                <span className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-purple-400" : "bg-purple-500"}`} style={{ animationDelay: "150ms" }} />
                                <span className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-fuchsia-400" : "bg-fuchsia-500"}`} style={{ animationDelay: "300ms" }} />
                              </span>
                            ) : (
                              <>
                                <ReactMarkdown
                                  components={{
                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                    em: ({ children }) => <em className="italic">{children}</em>,
                                    ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                                    li: ({ children }) => <li>{children}</li>,
                                    code: ({ children }) => <code className={`px-1 py-0.5 rounded text-sm font-mono ${isDark ? "bg-slate-700" : "bg-slate-100"}`}>{children}</code>,
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                                {message.isStreaming && (
                                  <span className="inline-block w-0.5 h-4 bg-cyan-400 ml-0.5 animate-pulse align-middle" />
                                )}
                              </>
                            )}
                          </div>

                          {/* Pièces justificatives modernisées */}
                          {message.pieces && message.pieces.length > 0 && (
                            <div
                              className={`mt-5 pt-4 ${
                                isDark
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
                                    className={`p-1.5 rounded-md transition-all ${
                                      vueDocuments === "grille"
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
                                    className={`p-1.5 rounded-md transition-all ${
                                      vueDocuments === "liste"
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
                                      className={`group rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                                        isDark
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
                                          const fileUrl = piece.metadata?.fichier_url || null;

                                          if (isImage && fileUrl) {
                                            return (
                                              <img
                                                src={fileUrl}
                                                alt={piece.metadata?.titre || "Document"}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                              />
                                            );
                                          }

                                          if (isPdf && piece.metadata?.fichier_url) {
                                            // Utiliser l'URL directe /media/ car nginx sert ces fichiers sans auth
                                            const fichierUrl = piece.metadata.fichier_url as string;
                                            const mediaUrl = fichierUrl.startsWith('/media/')
                                              ? fichierUrl
                                              : `/media/${fichierUrl.replace(/^\//, '')}`;
                                            return (
                                              <iframe
                                                src={`${mediaUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                                                className="w-full h-full border-0 pointer-events-none"
                                                title={(piece.metadata?.titre as string) || "PDF"}
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
                                        className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                                          isDark
                                            ? "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50"
                                            : "bg-slate-50 hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300"
                                        }`}
                                      >
                                        {/* Icône type fichier */}
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                          isPdf 
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
                                            <span className={`text-[10px] font-medium uppercase ${
                                              isPdf 
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
                    className={`flex-1 rounded-2xl rounded-tl-md px-5 py-4 ${
                      isDark
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
            <div className="relative">
              {/* Suggestions de clients */}
              {showClientSuggestions && clientSuggestions.length > 0 && (
                <div className={`absolute bottom-full left-0 right-0 mb-2 rounded-xl overflow-hidden shadow-xl z-50 ${
                  isDark ? "bg-slate-800 border border-slate-700" : "bg-white border border-slate-200"
                }`}>
                  <div className={`px-3 py-2 text-xs font-medium ${isDark ? "text-slate-400 bg-slate-700/50" : "text-slate-500 bg-slate-50"}`}>
                    Clients suggérés
                  </div>
                  {clientSuggestions.map((client, index) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleSelectClient(client)}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                        index === selectedSuggestionIndex
                          ? isDark ? "bg-cyan-500/20" : "bg-cyan-50"
                          : isDark ? "hover:bg-white/5" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                        {client.nom.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${isDark ? "text-white" : "text-slate-800"}`}>
                          {client.nom}
                        </div>
                        {client.numero_client && (
                          <div className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Code: {client.numero_client}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              <div
                className={`flex items-center rounded-xl transition-all duration-300 ${
                  isDark
                    ? "bg-white/5 border border-white/10 focus-within:border-cyan-500/50 focus-within:bg-white/10"
                    : "bg-white border border-slate-200 shadow-lg shadow-slate-200/50 focus-within:border-cyan-400 focus-within:shadow-cyan-500/10"
                }`}
              >
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Posez votre question..."
                  disabled={isLoading}
                  className={`flex-1 bg-transparent py-4 px-5 outline-none text-[15px] disabled:opacity-50 ${
                    isDark
                      ? "text-white placeholder-slate-500"
                      : "text-slate-800 placeholder-slate-400"
                  }`}
                />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`mr-2 p-3 rounded-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed ${
                  input.trim() && !isLoading
                    ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
                    : isDark
                    ? "bg-white/5 text-slate-600"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <Icon name="arrow-right" size="sm" />
              </button>
              </div>
            </div>
            <p
              className={`text-[11px] text-center mt-2 ${
                isDark ? "text-slate-600" : "text-slate-400"
              }`}
            >
              ACS Assistant peut faire des erreurs. Vérifiez les informations
              importantes.
            </p>
          </form>
        </div>
      </div>


      {/* Modale d'alerte */}
      <AlertModal
        isOpen={alerteModal.open}
        onClose={fermerAlerte}
        title={alerteModal.title}
        message={alerteModal.message}
        variant={alerteModal.variant}
        isDark={isDark}
      />
      {/* Onboarding / Guide d'utilisation */}
      {etapeOnboarding !== null && (() => {
        const fermer = () => {
          localStorage.setItem('acs_onboarding_done', '1');
          setEtapeOnboarding(null);
        };
        const etapes = [
          {
            gradient: 'from-cyan-500 to-purple-500',
            icone: '✨',
            titre: 'Bienvenue sur ACS Assistant',
            corps: (
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Posez une question en <span className="font-semibold">langage naturel</span> pour retrouver
                n&apos;importe quel document dans les archives ACS — contrats, avenants, factures, sinistres et plus.
              </p>
            ),
          },
          {
            gradient: 'from-blue-500 to-cyan-500',
            icone: '🔍',
            titre: 'Comment rechercher',
            corps: (
              <div className="space-y-3">
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Précisez le <strong>client</strong>, <strong>l&apos;année</strong>, le <strong>type</strong> et le <strong>risque</strong> pour des résultats précis.
                </p>
                <div className="space-y-2">
                  {[
                    "Avenant N° 0529 2024 client 3CB risque MRP",
                    "Factures de SANLAM 2024",
                    "Dernier contrat automobile de AXA",
                  ].map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => { setInput(ex); fermer(); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors ${
                        isDark ? 'bg-white/5 hover:bg-cyan-500/20 text-slate-300 border border-white/10' : 'bg-slate-100 hover:bg-cyan-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span>{ex}</span>
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-600'}`}>Utiliser</span>
                    </button>
                  ))}
                </div>
              </div>
            ),
          },
          {
            gradient: 'from-purple-500 to-fuchsia-500',
            icone: '📄',
            titre: 'Consulter et télécharger',
            corps: (
              <div className="space-y-3">
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Les documents trouvés s&apos;affichent sous chaque réponse.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { icone: '👁️', label: 'Cliquez sur une carte pour afficher le document en plein écran' },
                    { icone: '⬇️', label: 'Bouton télécharger pour sauvegarder le fichier' },
                    { icone: '⊞', label: 'Basculez entre vue grille et liste en haut à droite' },
                  ].map((f) => (
                    <div key={f.label} className={`flex items-start gap-3 p-2.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <span className="text-base">{f.icone}</span>
                      <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
          {
            gradient: 'from-fuchsia-500 to-rose-500',
            icone: '💡',
            titre: 'Astuces',
            corps: (
              <div className="space-y-2">
                {[
                  'Utilisez le code client exact : 3CB, SANLAM, AXA, SONAR…',
                  "Cherchez par numéro : « document N° 190 » ou « N° 2263 »",
                  'Précisez le type : avenant, police, facture, sinistre, contrat…',
                  "Filtrez par période : « 2023 », « entre 2019 et 2021 »",
                ].map((tip) => (
                  <div key={tip} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                      isDark ? 'bg-fuchsia-500/30 text-fuchsia-300' : 'bg-fuchsia-100 text-fuchsia-600'
                    }`}>✓</span>
                    <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{tip}</span>
                  </div>
                ))}
              </div>
            ),
          },
        ];
        const etape = etapes[etapeOnboarding];
        const estDerniere = etapeOnboarding === etapes.length - 1;
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={fermer}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className={`relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
                isDark ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200'
              }`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {/* Barre de progression gradient */}
              <div className={`h-1 bg-gradient-to-r ${etape.gradient} transition-all duration-500`}
                style={{ width: `${((etapeOnboarding + 1) / etapes.length) * 100}%` }}
              />

              <div className="p-6">
                {/* Icône + titre */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${etape.gradient} flex items-center justify-center text-xl shadow-lg`}>
                    {etape.icone}
                  </div>
                  <div className="flex-1">
                    <p className={`text-[10px] font-medium uppercase tracking-wider mb-0.5 ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}>Étape {etapeOnboarding + 1} / {etapes.length}</p>
                    <h3 className={`text-base font-semibold leading-tight ${
                      isDark ? 'text-white' : 'text-slate-800'
                    }`}>{etape.titre}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={fermer}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                    aria-label="Fermer"
                  >
                    <Icon name="close" size="sm" />
                  </button>
                </div>

                {/* Corps de l'étape */}
                <div className="mb-6">{etape.corps}</div>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                  {/* Pastilles de progression */}
                  <div className="flex gap-1.5">
                    {etapes.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setEtapeOnboarding(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === etapeOnboarding
                            ? `w-6 bg-gradient-to-r ${etape.gradient}`
                            : isDark ? 'w-1.5 bg-white/20' : 'w-1.5 bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {etapeOnboarding > 0 && (
                      <button
                        type="button"
                        onClick={() => setEtapeOnboarding(etapeOnboarding - 1)}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                          isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        Précédent
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => estDerniere ? fermer() : setEtapeOnboarding(etapeOnboarding + 1)}
                      className={`px-4 py-1.5 text-xs font-medium rounded-lg text-white bg-gradient-to-r ${etape.gradient} hover:opacity-90 transition-opacity shadow-sm`}
                    >
                      {estDerniere ? 'Commencer ✓' : 'Suivant →'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
              <div className="flex items-center gap-2">
                {modaleDocument.piece && (
                  <button
                    onClick={() => modaleDocument.piece && void telechargerPiece(modaleDocument.piece)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-slate-400 hover:text-cyan-400" : "hover:bg-slate-200 text-slate-500 hover:text-blue-600"}`}
                    title="Télécharger"
                  >
                    <Icon name="download" size="sm" />
                  </button>
                )}
                <button
                  onClick={() => setModaleDocument({ open: false, piece: null, url: null })}
                  className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-slate-200 text-slate-500 hover:text-slate-800"}`}
                  title="Fermer"
                >
                  <Icon name="close" size="sm" />
                </button>
              </div>
            </div>

            {/* Contenu du document */}
            <div className="w-full h-[calc(100%-56px)] overflow-auto">
              {(() => {
                const fichierUrl = modaleDocument.piece?.metadata?.fichier_url || modaleDocument.url;
                const ext = fichierUrl.split('.').pop()?.toLowerCase() || '';
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
                const isPdf = ext === 'pdf';

                if (isImage) {
                  return (
                    <div className="w-full h-full flex items-center justify-center p-4">
                      <img
                        src={fichierUrl}
                        alt={modaleDocument.piece?.metadata?.titre || "Document"}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                      />
                    </div>
                  );
                }

                if (isPdf) {
                  return (
                    <iframe
                      src={`${fichierUrl}#toolbar=0&navpanes=0&scrollbar=1`}
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
