module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/types/index.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Types TypeScript pour l'application ACS Archive
// Tous les noms sont en français
// Enums (générés par Prisma après prisma generate)
__turbopack_context__.s([
    "RoleUtilisateur",
    ()=>RoleUtilisateur,
    "StatutExercice",
    ()=>StatutExercice,
    "TypeAction",
    ()=>TypeAction,
    "TypeClient",
    ()=>TypeClient,
    "TypeCourrier",
    ()=>TypeCourrier,
    "TypeRisque",
    ()=>TypeRisque
]);
var RoleUtilisateur = /*#__PURE__*/ function(RoleUtilisateur) {
    RoleUtilisateur["ADMIN"] = "ADMIN";
    RoleUtilisateur["ARCHIVISTE"] = "ARCHIVISTE";
    RoleUtilisateur["CONSULTANT"] = "CONSULTANT";
    return RoleUtilisateur;
}({});
var TypeAction = /*#__PURE__*/ function(TypeAction) {
    TypeAction["CREATION"] = "CREATION";
    TypeAction["CONSULTATION"] = "CONSULTATION";
    TypeAction["MODIFICATION"] = "MODIFICATION";
    TypeAction["SUPPRESSION"] = "SUPPRESSION";
    TypeAction["TELECHARGEMENT"] = "TELECHARGEMENT";
    return TypeAction;
}({});
var TypeClient = /*#__PURE__*/ function(TypeClient) {
    TypeClient["ENTREPRISE"] = "ENTREPRISE";
    TypeClient["PARTICULIER"] = "PARTICULIER";
    return TypeClient;
}({});
var TypeRisque = /*#__PURE__*/ function(TypeRisque) {
    TypeRisque["AUTOMOBILE"] = "AUTOMOBILE";
    TypeRisque["SANTE"] = "SANTE";
    TypeRisque["HABITATION"] = "HABITATION";
    TypeRisque["VIE"] = "VIE";
    TypeRisque["RESPONSABILITE_CIVILE"] = "RESPONSABILITE_CIVILE";
    TypeRisque["AUTRE"] = "AUTRE";
    return TypeRisque;
}({});
var TypeCourrier = /*#__PURE__*/ function(TypeCourrier) {
    TypeCourrier["ACS_VERS_CLIENT"] = "ACS_VERS_CLIENT";
    TypeCourrier["ACS_VERS_COMPAGNIE"] = "ACS_VERS_COMPAGNIE";
    TypeCourrier["AVENANT"] = "AVENANT";
    TypeCourrier["FACTURE"] = "FACTURE";
    TypeCourrier["REGLEMENT"] = "REGLEMENT";
    TypeCourrier["DIVERS"] = "DIVERS";
    TypeCourrier["SINISTRE"] = "SINISTRE";
    return TypeCourrier;
}({});
var StatutExercice = /*#__PURE__*/ function(StatutExercice) {
    StatutExercice["ACTIF"] = "ACTIF";
    StatutExercice["ARCHIVE"] = "ARCHIVE";
    StatutExercice["CLOTURE"] = "CLOTURE";
    return StatutExercice;
}({});
}),
"[project]/app/api/assistant-demo/llm.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/*
 * Utilitaires d'intégration LLM pour l'assistant IA.
 * L'objectif est de centraliser la configuration, la construction du prompt
 * et l'appel réseau afin de sécuriser l'intégration d'un modèle de langage.
 */ __turbopack_context__.s([
    "buildPrompt",
    ()=>buildPrompt,
    "generateLlmAnswer",
    ()=>generateLlmAnswer,
    "isLlmConfigured",
    ()=>isLlmConfigured
]);
const PROVIDER = (process.env.ASSISTANT_LLM_PROVIDER ?? 'openai').toLowerCase();
const API_KEY = process.env.ASSISTANT_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
const BASE_URL = process.env.ASSISTANT_LLM_BASE_URL ?? 'https://api.openai.com/v1';
const MODEL = process.env.ASSISTANT_LLM_MODEL ?? 'gpt-4o-mini';
const LLM_ENABLED = (process.env.ASSISTANT_LLM_ENABLED ?? 'true').toLowerCase() !== 'false';
function isLlmConfigured() {
    return Boolean(API_KEY) && LLM_ENABLED;
}
function sanitizeText(value) {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim();
}
function buildPrompt(payload) {
    const intro = `Tu es un assistant spécialisé en archivage pour ACS. Réponds en français dans un style conversationnel naturel, comme si tu parlais à un ami.`;
    const questionBlock = `Question utilisateur : "${payload.question}".`;
    const contextParts = [];
    if (payload.intent === 'documents' && payload.pieces?.length) {
        const documents = payload.pieces.slice(0, 5).map((piece, index)=>{
            const resume = sanitizeText(piece.content);
            const metadata = piece.metadata ?? {};
            const highlights = Array.isArray(metadata.highlights) ? metadata.highlights : [];
            const highlightsText = highlights.map((line)=>`- ${line}`).join('\n');
            return `Document ${index + 1} (${piece.source}, score ${piece.score.toFixed(3)}):\n${resume}\n${highlightsText}`;
        }).join('\n\n');
        contextParts.push('Documents pertinents :\n' + documents);
    }
    if (payload.intent === 'statistiques' && payload.statistiques) {
        const statsText = JSON.stringify(payload.statistiques, null, 2);
        contextParts.push('Statistiques consolidées :\n' + statsText);
    }
    const directives = `Réponds de manière conversationnelle directe, comme si tu discutes avec une personne.
Sois naturel et fluide, sans utiliser de structure formelle ou de listes.
Adapte ton style à la question de l'utilisateur comme si tu étais un humain qui discute.`;
    const context = contextParts.length ? `Contexte disponible :\n${contextParts.join('\n\n')}` : 'Aucun document pertinent n’a été trouvé. Fournis une réponse prudente.';
    return [
        intro,
        questionBlock,
        context,
        directives
    ].join('\n\n');
}
async function callOpenAi(prompt) {
    const url = `${BASE_URL.replace(/\/$/, '')}/chat/completions`;
    const started = Date.now();
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                {
                    role: 'system',
                    content: `Tu es un assistant d'archives intelligent et très convivial. Parle comme un humain naturel et amical, pas comme un robot.
      Utilise un langage simple, direct et engageant. Pose des questions, montre de l'empathie, sois proactif.
      Évite le jargon technique et les phrases trop formelles. Sois comme un collègue serviable et compétent.
      Termine souvent par des questions pour encourager la conversation.
      Adapte ton style : parfois bref et direct, parfois plus détaillé selon le besoin.
      Sois authentique, humain, et crée une connexion avec l'utilisateur.`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.8,
            max_tokens: 600
        })
    });
    const elapsed = Date.now() - started;
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`LLM (${response.status}) ${detail}`);
    }
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
        throw new Error('Réponse LLM vide');
    }
    return {
        content,
        telemetry: {
            provider: PROVIDER,
            model: MODEL,
            durationMs: elapsed,
            tokensInput: json.usage?.prompt_tokens,
            tokensOutput: json.usage?.completion_tokens
        }
    };
}
async function generateLlmAnswer(payload) {
    if (!isLlmConfigured()) {
        throw new Error('LLM non configuré');
    }
    if (PROVIDER !== 'openai') {
        throw new Error(`Fournisseur LLM non pris en charge: ${PROVIDER}`);
    }
    const prompt = buildPrompt(payload);
    return callOpenAi(prompt);
}
}),
"[project]/app/api/assistant-demo/telemetry.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "incrementErrors",
    ()=>incrementErrors,
    "incrementLlmFallback",
    ()=>incrementLlmFallback,
    "incrementLlmSuccess",
    ()=>incrementLlmSuccess,
    "incrementRequest",
    ()=>incrementRequest,
    "journaliserAssistant",
    ()=>journaliserAssistant,
    "metricsSnapshot",
    ()=>metricsSnapshot
]);
const assistantMetrics = {
    startedAt: Date.now(),
    totalRequests: 0,
    documentsRequests: 0,
    statistiquesRequests: 0,
    errors: 0,
    llmSuccess: 0,
    llmFallback: 0
};
function incrementRequest(intent) {
    assistantMetrics.totalRequests += 1;
    if (intent === 'documents') {
        assistantMetrics.documentsRequests += 1;
    } else {
        assistantMetrics.statistiquesRequests += 1;
    }
}
function incrementLlmSuccess() {
    assistantMetrics.llmSuccess += 1;
}
function incrementLlmFallback() {
    assistantMetrics.llmFallback += 1;
}
function incrementErrors() {
    assistantMetrics.errors += 1;
}
function metricsSnapshot() {
    const uptimeSeconds = Math.round((Date.now() - assistantMetrics.startedAt) / 1000);
    return {
        ...assistantMetrics,
        uptimeSeconds
    };
}
function journaliserAssistant(event) {
    const payload = {
        event,
        metrics: metricsSnapshot(),
        timestamp: new Date().toISOString()
    };
    console.info('assistant-telemetry', JSON.stringify(payload));
}
}),
"[project]/app/api/assistant-demo/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$index$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/types/index.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$llm$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/api/assistant-demo/llm.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/api/assistant-demo/telemetry.ts [app-route] (ecmascript)");
function extraireCleClient(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return realIp.trim();
    }
    return 'local';
}
function verifierRateLimit(request) {
    const key = extraireCleClient(request);
    const now = Date.now();
    const timestamps = rateLimitStore.get(key)?.filter((time)=>now - time < RATE_LIMIT_WINDOW_MS) ?? [];
    if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
        rateLimitStore.set(key, timestamps);
        return {
            ok: false,
            remaining: 0
        };
    }
    timestamps.push(now);
    rateLimitStore.set(key, timestamps);
    return {
        ok: true,
        remaining: RATE_LIMIT_MAX_REQUESTS - timestamps.length
    };
}
;
;
;
;
// Configuration des tons de réponse
const TONES = {
    amical: {
        intro: (nb)=>`J'ai retrouvé ${nb === 1 ? 'un document' : `${nb} documents`} qui pourrai${nb > 1 ? 'ent' : 't'} vous être utile${nb > 1 ? 's' : ''}.`,
        conclusion: '\n\nVous pouvez les consulter ou les télécharger à tout moment. 📥\n\nSi vous avez besoin d\'aide pour un autre document ou pour effectuer une recherche, je suis là pour ça ! 😊',
        noResults: "Je n'ai trouvé aucun document correspondant à votre recherche. 🔍\n\nVoulez-vous reformuler votre question ou essayer avec d'autres mots-clés ? Je suis là pour vous aider !",
        useEmojis: true
    },
    formel: {
        intro: (nb)=>`${nb} document${nb > 1 ? 's' : ''} correspondant${nb > 1 ? 's' : ''} à votre recherche ${nb > 1 ? 'ont été identifiés' : 'a été identifié'}.`,
        conclusion: '\n\nCes documents sont disponibles pour consultation et téléchargement. Pour toute assistance supplémentaire, n\'hésitez pas à formuler une nouvelle requête.',
        noResults: "Aucun document ne correspond aux critères de recherche spécifiés. Veuillez reformuler votre demande avec des termes différents.",
        useEmojis: false
    },
    concis: {
        intro: (nb)=>`${nb} document${nb > 1 ? 's' : ''} trouvé${nb > 1 ? 's' : ''}.`,
        conclusion: '\n\nDisponible au téléchargement.',
        noResults: "Aucun résultat. Reformulez votre recherche.",
        useEmojis: false
    },
    premium: {
        intro: (nb)=>`Nous avons identifié ${nb} document${nb > 1 ? 's' : ''} pertinent${nb > 1 ? 's' : ''} pour votre demande.`,
        conclusion: '\n\n✨ Ces documents sont à votre disposition pour consultation immédiate ou téléchargement sécurisé.\n\nNotre assistant reste à votre écoute pour toute recherche complémentaire ou assistance personnalisée.',
        noResults: "Aucun document ne correspond actuellement à votre recherche. 🔍\n\nNous vous invitons à affiner vos critères ou à nous solliciter pour une assistance personnalisée.",
        useEmojis: true
    }
};
function construireInsightsDocuments(pieces) {
    if (!pieces.length) {
        return [];
    }
    const insights = [];
    const clients = new Map();
    const categories = new Map();
    pieces.forEach((piece)=>{
        const metadata = piece.metadata ?? {};
        const client = metadata.client ?? 'Client non renseigné';
        const categorie = metadata.categorie ?? 'Catégorie non renseignée';
        clients.set(client, (clients.get(client) ?? 0) + 1);
        categories.set(categorie, (categories.get(categorie) ?? 0) + 1);
    });
    if (clients.size) {
        const principal = [
            ...clients.entries()
        ].sort((a, b)=>b[1] - a[1])[0];
        if (principal) {
            insights.push(`Client le plus représenté : ${principal[0]} (${principal[1]} document${principal[1] > 1 ? 's' : ''}).`);
        }
    }
    if (categories.size) {
        const categorie = [
            ...categories.entries()
        ].sort((a, b)=>b[1] - a[1])[0];
        if (categorie) {
            insights.push(`Catégorie dominante : ${categorie[0]} (${categorie[1]} document${categorie[1] > 1 ? 's' : ''}).`);
        }
    }
    const total = pieces.length;
    insights.push(`Nombre de pièces pertinentes identifiées : ${total}.`);
    return insights;
}
function construireActionsDocuments(pieces) {
    if (!pieces.length) {
        return [];
    }
    const actions = [];
    let docsSansDescription = 0;
    let docsAnciennete = 0;
    const maintenant = Date.now();
    pieces.forEach((piece)=>{
        const metadata = piece.metadata ?? {};
        const description = metadata.description;
        const dateDoc = metadata.date_document;
        if (!description || description.trim().length < 20) {
            docsSansDescription += 1;
        }
        if (dateDoc) {
            const parsed = Date.parse(dateDoc);
            if (!Number.isNaN(parsed) && maintenant - parsed > FIVE_YEARS_MS) {
                docsAnciennete += 1;
            }
        }
    });
    if (docsSansDescription) {
        actions.push(`Compléter la description de ${docsSansDescription} document${docsSansDescription > 1 ? 's' : ''} pour faciliter la recherche.`);
    }
    if (docsAnciennete) {
        actions.push(`Revoir la conservation de ${docsAnciennete} document${docsAnciennete > 1 ? 's' : ''} âgé${docsAnciennete > 1 ? 's' : ''} de plus de 5 ans.`);
    }
    if (!actions.length) {
        actions.push('Aucune action urgente détectée sur les pièces proposées. Vérifier que leur indexation reste à jour.');
    }
    return actions;
}
function construireNarrationHeuristique(intent, resume, insights, actions) {
    // Pour les documents, le résumé est déjà rédigé dans un ton conversationnel
    // (construireResumeDocuments ajoute une conclusion naturelle).
    if (intent === 'documents') {
        return resume;
    }
    // Pour les statistiques, enrichir légèrement la réponse avec une petite conclusion
    let reponse = resume;
    const details = [];
    if (insights && insights.length) {
        details.push(insights[0]);
    }
    if (actions && actions.length) {
        details.push(actions[0]);
    }
    if (details.length) {
        reponse += `\n\n${details.join(' ')}`;
    }
    reponse += '\n\nCes indicateurs sont basés sur vos documents archivés. Si vous voulez, je peux vous aider à creuser un point précis.';
    return reponse;
}
const API_BASE_URL = ("TURBOPACK compile-time value", "http://127.0.0.1:8000/api") ?? 'http://127.0.0.1:8000/api';
const API_BASE = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
const DEFAULT_TOP_K = 3;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const USE_FAISS = process.env.NEXT_PUBLIC_ASSISTANT_USE_FAISS === 'true';
const ASSISTANT_ENABLED = (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED ?? 'true').toLowerCase() !== 'false';
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.NEXT_PUBLIC_ASSISTANT_RATE_LIMIT ?? '12');
const rateLimitStore = new Map();
const ROLES_AUTORISES_DOCUMENTS = new Set([
    __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$index$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["RoleUtilisateur"].ADMIN,
    __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$index$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["RoleUtilisateur"].ARCHIVISTE,
    __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$index$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["RoleUtilisateur"].CONSULTANT
]);
const ROLES_AUTORISES_STATISTIQUES = new Set([
    __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$index$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["RoleUtilisateur"].ADMIN,
    __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$index$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["RoleUtilisateur"].ARCHIVISTE,
    __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$index$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["RoleUtilisateur"].CONSULTANT
]);
function extraireRole(request) {
    const header = request.headers.get('x-user-role')?.trim().toUpperCase();
    if (!header) {
        return null;
    }
    if (header === 'ADMIN' || header === 'ARCHIVISTE' || header === 'CONSULTANT') {
        return header;
    }
    return null;
}
function construireReponseRestreinte(question, intent, role) {
    const message = "Je suis désolé, mais vous ne disposez pas des droits nécessaires pour accéder à cette information. Merci de contacter un administrateur pour obtenir l'autorisation.";
    const réponse = {
        question,
        type: intent,
        resume: message,
        pieces: intent === 'documents' ? [] : undefined,
        statistiques: intent === 'statistiques' ? undefined : undefined,
        insights: [],
        actions: [],
        narration: {
            texte: message,
            source: 'heuristique'
        },
        restriction: {
            reason: 'PERMISSION_DENIED',
            role
        }
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["journaliserAssistant"])({
        type: 'response',
        intent,
        durationMs: 0,
        llmUsed: false
    });
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(réponse);
}
class BackendError extends Error {
    status;
    constructor(message, status){
        super(message);
        this.status = status;
    }
}
function detectIntent(question) {
    const lower = question.toLowerCase();
    const statsKeywords = [
        'combien',
        'nombre',
        'statistique',
        'statistiques',
        'kpi',
        'taux',
        'top',
        'retard',
        'alerte',
        'volume'
    ];
    if (statsKeywords.some((keyword)=>lower.includes(keyword))) {
        return 'statistiques';
    }
    return 'documents';
}
function buildBackendUrl(path) {
    return new URL(path, API_BASE);
}
async function fetchJson(url, token) {
    const headers = new Headers();
    headers.set('Accept', 'application/json');
    if (token) {
        headers.set('Authorization', token);
    }
    const response = await fetch(url, {
        headers,
        cache: 'no-store'
    });
    const text = await response.text();
    // Vérifier si la réponse est du HTML (erreur Django)
    if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
        console.error('Le backend a retourné du HTML au lieu de JSON:', text.substring(0, 200));
        throw new BackendError('Erreur interne du serveur Django', 500);
    }
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (error) {
        console.error('Erreur lors du parsing JSON:', error);
        console.error('Réponse brute:', text.substring(0, 500));
        throw new BackendError('Réponse invalide du serveur', 500);
    }
    if (!response.ok) {
        const detail = data?.detail ?? data?.erreur;
        throw new BackendError(detail ?? `Erreur API (${response.status})`, response.status);
    }
    return data;
}
function toTitle(value) {
    if (!value) return null;
    const formatted = value.replace(/_/g, ' ').toLowerCase();
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
function formatDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return new Intl.DateTimeFormat('fr-FR').format(date);
}
function construireMetadataDocument(doc, resultat) {
    const exercice = doc.risque_detail?.exercice_info?.annee;
    const client = doc.risque_detail?.exercice_info?.client ?? resultat?.client ?? null;
    const dateDocument = doc.date_document ?? doc.cree_le ?? resultat?.creeLe ?? null;
    const dateFormatee = formatDate(dateDocument);
    const type = doc.type_courrier ? toTitle(doc.type_courrier) : null;
    const categorie = doc.categorie_nom ?? doc.categorie ?? null;
    return {
        titre: doc.titre,
        description: doc.description ?? null,
        type,
        categorie,
        client,
        exercice,
        reference: doc.reference ?? resultat?.reference ?? null,
        date_document: dateDocument,
        date_document_formatee: dateFormatee,
        statut_archive: doc.est_archive ?? null,
        derniere_mise_a_jour: doc.cree_le ?? null
    };
}
function construireHighlights(metadata) {
    const highlights = [];
    const client = metadata.client;
    const categorie = metadata.categorie;
    const type = metadata.type;
    const date = metadata.date_document_formatee;
    if (client) {
        highlights.push(`Client : ${client}`);
    }
    if (categorie) {
        highlights.push(`Catégorie : ${categorie}`);
    }
    if (type) {
        highlights.push(`Type : ${type}`);
    }
    if (date) {
        highlights.push(`Date : ${date}`);
    }
    const reference = metadata.reference;
    if (reference) {
        highlights.push(`Référence : ${reference}`);
    }
    return highlights;
}
function construireContenuDocument(doc, resultat) {
    const lignes = [];
    if (doc.description) {
        lignes.push(doc.description.trim());
    }
    const client = doc.risque_detail?.exercice_info?.client ?? resultat?.client;
    if (client) {
        lignes.push(`Client : ${client}`);
    }
    if (doc.reference ?? resultat?.reference) {
        lignes.push(`Référence : ${doc.reference ?? resultat?.reference}`);
    }
    if (doc.type_courrier) {
        lignes.push(`Type de courrier : ${toTitle(doc.type_courrier)}`);
    }
    if (doc.categorie_nom ?? doc.categorie) {
        lignes.push(`Catégorie : ${doc.categorie_nom ?? doc.categorie}`);
    }
    const date = formatDate(doc.date_document ?? doc.cree_le ?? resultat?.creeLe ?? null);
    if (date) {
        lignes.push(`Date : ${date}`);
    }
    return lignes.join('\n') || 'Informations limitées sur ce document.';
}
function tokenizeText(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/gi).filter(Boolean);
}
function buildDocumentTokens(doc, metadata) {
    const segments = [
        {
            value: doc.titre,
            weight: 3
        },
        {
            value: doc.description,
            weight: 2
        },
        {
            value: metadata.client,
            weight: 2
        },
        {
            value: metadata.categorie,
            weight: 2
        },
        {
            value: metadata.type,
            weight: 2
        },
        {
            value: metadata.reference,
            weight: 2
        },
        {
            value: doc.risque_detail?.type,
            weight: 1
        }
    ];
    const tokens = [];
    for (const segment of segments){
        if (!segment.value) continue;
        const baseTokens = tokenizeText(String(segment.value));
        if (!baseTokens.length) continue;
        for(let i = 0; i < segment.weight; i += 1){
            tokens.push(...baseTokens);
        }
    }
    return tokens.length ? tokens : tokenizeText(doc.titre ?? '');
}
function compterFrequences(tokens) {
    const frequences = new Map();
    for (const token of tokens){
        const courant = frequences.get(token) ?? 0;
        frequences.set(token, courant + 1);
    }
    return frequences;
}
function calculerScoreBM25(questionTokens, termFreq, docLength, avgDocLength, df, docCount) {
    if (!questionTokens.length) {
        return 0;
    }
    const k1 = 1.5;
    const b = 0.75;
    const longueur = docLength || 1;
    const longueurMoyenne = avgDocLength || 1;
    let score = 0;
    for (const token of questionTokens){
        const freq = termFreq.get(token) ?? 0;
        if (freq === 0) {
            continue;
        }
        const docFreq = df.get(token) ?? 0;
        const idf = Math.log(1 + (docCount - docFreq + 0.5) / (docFreq + 0.5));
        const numerator = freq * (k1 + 1);
        const denominator = freq + k1 * (1 - b + b * longueur / longueurMoyenne);
        score += idf * (numerator / denominator);
    }
    return Number.isFinite(score) ? score : 0;
}
async function recupererDocumentRecent(token) {
    if (!token) {
        return null;
    }
    const url = buildBackendUrl('documents/');
    url.searchParams.set('ordering', '-cree_le');
    url.searchParams.set('page_size', '1');
    const data = await fetchJson(url, token);
    const results = Array.isArray(data) ? data : data?.results ?? [];
    const doc = results[0];
    if (!doc) {
        return null;
    }
    const metadata = construireMetadataDocument(doc);
    const highlights = construireHighlights(metadata);
    return {
        id: doc.id,
        source: doc.titre,
        content: construireContenuDocument(doc),
        metadata: {
            ...metadata,
            highlights
        },
        score: 0.1,
        isFallback: true
    };
}
async function rechercherDocumentsFaiss(question, token, topK) {
    const url = buildBackendUrl('assistant/documents/search/faiss/');
    url.searchParams.set('q', question);
    url.searchParams.set('top_k', String(topK));
    url.searchParams.set('include_fallback', 'true');
    try {
        const data = await fetchJson(url, token);
        const results = data?.results ?? [];
        if (!results.length) {
            return null;
        }
        return results.map((result)=>({
                id: result.id,
                source: result.titre,
                content: result.content,
                metadata: {
                    ...result.metadata,
                    highlights: result.highlights ?? []
                },
                score: result.score,
                isFallback: result.metadata?.isFallback === true
            }));
    } catch (error) {
        console.warn('Assistant FAISS search unavailable, falling back to TF-IDF.', error);
        return null;
    }
}
async function rechercherDocuments(question, token, topK) {
    if (!token) {
        throw new BackendError('Authentification requise pour interroger les documents.', 401);
    }
    if (USE_FAISS) {
        const faissPieces = await rechercherDocumentsFaiss(question, token, topK);
        if (faissPieces && faissPieces.length > 0) {
            return faissPieces;
        }
    }
    const searchUrl = buildBackendUrl('assistant/documents/search/tfidf/');
    searchUrl.searchParams.set('q', question);
    searchUrl.searchParams.set('top_k', String(topK));
    const data = await fetchJson(searchUrl, token);
    const results = data?.results ?? [];
    if (!results.length) {
        const fallback = await recupererDocumentRecent(token);
        return fallback ? [
            fallback
        ] : [];
    }
    return results.map((result)=>({
            id: result.id,
            source: result.titre,
            content: result.content,
            metadata: {
                ...result.metadata,
                highlights: result.highlights ?? []
            },
            score: result.score,
            isFallback: result.metadata?.isFallback === true
        }));
}
function construireResumeDocuments(_question, pieces, tone = 'amical') {
    const toneConfig = TONES[tone];
    if (!pieces || pieces.length === 0) {
        return toneConfig.noResults;
    }
    const premiere = pieces[0];
    const metadata = premiere.metadata ?? {};
    const nbDocs = pieces.length;
    // Introduction naturelle
    let reponse = nbDocs === 1 ? "J'ai retrouvé un document qui pourrait vous être utile." : `J'ai retrouvé ${nbDocs} documents qui pourraient vous être utiles.`;
    reponse += "\n\n";
    // Emoji selon le type
    let emoji = '';
    const type = metadata.type?.toLowerCase() || '';
    const categorie = metadata.categorie?.toLowerCase() || '';
    if (toneConfig.useEmojis) {
        if (type.includes('sinistre') || categorie.includes('sinistre')) emoji = '⚠️ ';
        else if (type.includes('contrat') || categorie.includes('contrat')) emoji = '📋 ';
        else if (type.includes('facture') || categorie.includes('facture')) emoji = '💰 ';
        else if (type.includes('rapport') || categorie.includes('rapport')) emoji = '📊 ';
        else if (type.includes('courrier') || categorie.includes('courrier')) emoji = '✉️ ';
        else emoji = '📄 ';
    }
    // Titre du document
    const titre = metadata.titre || 'Document';
    reponse += `${emoji}${titre}\n`;
    // Infos structurées, sans gras
    if (metadata.client) reponse += `Client : ${metadata.client}\n`;
    if (metadata.categorie) reponse += `Catégorie : ${metadata.categorie}\n`;
    if (metadata.type) reponse += `Type : ${metadata.type}\n`;
    if (metadata.date_document) {
        const date = new Date(metadata.date_document);
        if (!isNaN(date.getTime())) reponse += `Date : ${date.toLocaleDateString('fr-FR')}\n`;
    }
    if (metadata.reference) reponse += `Référence : ${metadata.reference}\n`;
    // Résumé naturel
    const contenu = premiere.content || '';
    if (contenu.length > 50) {
        const montantMatch = contenu.match(/\d+[\s\u00A0]?(?:\d{3}[\s\u00A0]?)*[€$£]|montant[:\s]+\d+/i);
        const statutMatch = contenu.match(/(?:statut|état|status)[:\s]+([^\n.]+)|(?:en cours|traité|validé|en attente|clos)/i);
        const details = [];
        if (montantMatch) details.push(montantMatch[0]);
        if (statutMatch) {
            const statut = statutMatch[1] || statutMatch[0];
            details.push(statut.trim());
        }
        if (details.length > 0) {
            reponse += `\nRésumé : ${details.join('. ')}.`;
        } else {
            const lignes = contenu.split('\n').map((l)=>l.trim()).filter((l)=>l.length > 10 && l.length < 150).slice(0, 2);
            if (lignes.length > 0) reponse += `\nRésumé : ${lignes.join(' ')}`;
        }
    }
    // Autres documents
    if (nbDocs > 1) {
        const autresClients = new Set(pieces.slice(1).map((p)=>p.metadata?.client).filter(Boolean));
        if (autresClients.size === 1) {
            reponse += `\n\nLes autres documents sont aussi liés au client ${Array.from(autresClients)[0]}.`;
        } else if (autresClients.size > 1) {
            reponse += `\n\nLes autres documents concernent : ${Array.from(autresClients).join(', ')}.`;
        } else {
            reponse += `\n\n${nbDocs - 1} autre${nbDocs > 2 ? 's' : ''} document${nbDocs > 2 ? 's' : ''} disponible${nbDocs > 2 ? 's' : ''}.`;
        }
    }
    // Conclusion naturelle
    reponse += '\n\nVous pouvez les consulter ou les télécharger à tout moment.';
    reponse += "\n\nSi vous avez besoin d'aide pour un autre document ou pour une recherche, je suis là pour vous aider !";
    return reponse;
}
async function recupererTousLesDocuments(token) {
    if (!token) {
        throw new BackendError('Authentification requise pour consulter les statistiques.', 401);
    }
    const documents = [];
    let nextUrl = buildBackendUrl('documents/');
    nextUrl.searchParams.set('ordering', '-cree_le');
    nextUrl.searchParams.set('page_size', '100');
    let pages = 0;
    const maxPages = 5;
    while(nextUrl && pages < maxPages){
        const data = await fetchJson(nextUrl, token);
        const results = Array.isArray(data) ? data : data?.results ?? [];
        documents.push(...results);
        const nextLink = data?.next;
        nextUrl = nextLink ? new URL(nextLink, API_BASE) : null;
        pages += 1;
    }
    return documents;
}
function calculerStatistiques(documents) {
    const mois = new Map();
    const categories = new Map();
    const clients = new Map();
    let documentsEnRetard = 0;
    let alertesPeremption = 0;
    const maintenant = Date.now();
    for (const doc of documents){
        const dateSource = doc.date_document ?? doc.cree_le;
        if (dateSource) {
            const date = new Date(dateSource);
            if (!Number.isNaN(date.getTime())) {
                const cle = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                mois.set(cle, (mois.get(cle) ?? 0) + 1);
                if (!(doc.est_archive ?? false) && maintenant - date.getTime() > THIRTY_DAYS_MS) {
                    documentsEnRetard += 1;
                }
                if (maintenant - date.getTime() > FIVE_YEARS_MS) {
                    alertesPeremption += 1;
                }
            }
        }
        const categorie = doc.categorie_nom ?? doc.categorie ?? 'Non catégorisé';
        categories.set(categorie, (categories.get(categorie) ?? 0) + 1);
        const client = doc.risque_detail?.exercice_info?.client ?? 'Client inconnu';
        clients.set(client, (clients.get(client) ?? 0) + 1);
    }
    const documents_par_mois = Array.from(mois.entries()).sort(([a], [b])=>a.localeCompare(b)).slice(-6).reduce((acc, [cle, total])=>{
        acc[cle] = total;
        return acc;
    }, {});
    const top_categories = Array.from(categories.entries()).sort(([, a], [, b])=>b - a).slice(0, 5).map(([categorie, compte])=>({
            categorie,
            compte
        }));
    const top_clients = Array.from(clients.entries()).sort(([, a], [, b])=>b - a).slice(0, 5).map(([client, compte])=>({
            client,
            compte
        }));
    const total = documents.length;
    const taux_conformite = total > 0 ? Math.max(0, Math.min(1, (total - documentsEnRetard) / total)) : 1;
    return {
        documents_par_mois,
        top_categories,
        top_clients,
        kpi: {
            taux_conformite,
            documents_en_retard: documentsEnRetard,
            alertes_peremption: alertesPeremption
        }
    };
}
async function collecterStatistiques(token) {
    const documents = await recupererTousLesDocuments(token);
    if (!documents.length) {
        return {
            documents_par_mois: {},
            top_categories: [],
            top_clients: [],
            kpi: {
                taux_conformite: 1,
                documents_en_retard: 0,
                alertes_peremption: 0
            }
        };
    }
    return calculerStatistiques(documents);
}
function construireResumeStatistiques(statistiques) {
    const lignes = [];
    if (statistiques.kpi) {
        lignes.push(`Taux de conformité : ${(statistiques.kpi.taux_conformite * 100).toFixed(1)} %. Documents en retard : ${statistiques.kpi.documents_en_retard}. Alertes de péremption : ${statistiques.kpi.alertes_peremption}.`);
    }
    if (statistiques.top_clients?.length) {
        const topClients = statistiques.top_clients.slice(0, 3).map((client)=>`${client.client} (${client.compte})`).join(', ');
        lignes.push(`TOP clients par volume d'archives : ${topClients}.`);
    }
    if (statistiques.top_categories?.length) {
        const topCategories = statistiques.top_categories.slice(0, 3).map((categorie)=>`${categorie.categorie} (${categorie.compte})`).join(', ');
        lignes.push(`Catégories principales : ${topCategories}.`);
    }
    if (!lignes.length) {
        return 'Aucune statistique exploitable pour le moment.';
    }
    return lignes.join(' ');
}
function construireInsightsStatistiques(statistiques) {
    const insights = [];
    if (statistiques.top_clients?.length) {
        const premiers = statistiques.top_clients.slice(0, 3).map((client)=>`${client.client} (${client.compte})`).join(', ');
        insights.push(`Top clients : ${premiers}.`);
    }
    if (statistiques.top_categories?.length) {
        const categories = statistiques.top_categories.slice(0, 3).map((categorie)=>`${categorie.categorie} (${categorie.compte})`).join(', ');
        insights.push(`Catégories les plus actives : ${categories}.`);
    }
    const evolution = Object.entries(statistiques.documents_par_mois ?? {}).sort(([a], [b])=>a.localeCompare(b));
    if (evolution.length >= 2) {
        const [prevKey, prevValue] = evolution[evolution.length - 2];
        const [lastKey, lastValue] = evolution[evolution.length - 1];
        if (prevValue && lastValue) {
            const delta = (lastValue - prevValue) / prevValue * 100;
            insights.push(`Variation du volume entre ${prevKey} et ${lastKey} : ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} %.`);
        }
    }
    return insights;
}
function construireActionsStatistiques(statistiques) {
    const actions = [];
    const kpi = statistiques.kpi;
    if (kpi) {
        if (kpi.taux_conformite < 0.9) {
            actions.push('Prioriser la réduction des documents en retard pour améliorer le taux de conformité.');
        } else {
            actions.push('Maintenir la surveillance : le taux de conformité reste satisfaisant.');
        }
        if (kpi.alertes_peremption > 0) {
            actions.push(`Planifier une revue des ${kpi.alertes_peremption} document${kpi.alertes_peremption > 1 ? 's' : ''} proche${kpi.alertes_peremption > 1 ? 's' : ''} de la péremption.`);
        }
    }
    if (!actions.length) {
        actions.push('Aucune action prioritaire détectée. Continuer le suivi régulier des indicateurs.');
    }
    return actions;
}
async function POST(request) {
    let payload;
    try {
        payload = await request.json();
    } catch (error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            erreur: 'Corps de requête invalide'
        }, {
            status: 400
        });
    }
    const question = payload.question?.trim();
    if (!question) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            erreur: 'La question est requise'
        }, {
            status: 400
        });
    }
    const authorization = request.headers.get('authorization');
    const token = authorization?.trim() ? authorization : null;
    try {
        if (!ASSISTANT_ENABLED) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                erreur: "Assistant désactivé"
            }, {
                status: 503
            });
        }
        const rateLimit = verifierRateLimit(request);
        if (!rateLimit.ok) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                erreur: 'Trop de requêtes, réessayez dans quelques instants.'
            }, {
                status: 429
            });
        }
        const intent = detectIntent(question);
        const role = extraireRole(request);
        if (!role) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                erreur: 'Rôle utilisateur manquant ou invalide.'
            }, {
                status: 401
            });
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["incrementRequest"])(intent);
        const startedAt = Date.now();
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["journaliserAssistant"])({
            type: 'request',
            intent,
            questionLength: question.length
        });
        if (intent === 'statistiques') {
            if (!ROLES_AUTORISES_STATISTIQUES.has(role)) {
                return construireReponseRestreinte(question, intent, role);
            }
            const statistiques = await collecterStatistiques(token);
            const resume = construireResumeStatistiques(statistiques);
            const insights = construireInsightsStatistiques(statistiques);
            const actions = construireActionsStatistiques(statistiques);
            let narration;
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$llm$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isLlmConfigured"])()) {
                try {
                    const { content, telemetry } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$llm$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateLlmAnswer"])({
                        question,
                        intent,
                        statistiques
                    });
                    narration = {
                        texte: content,
                        source: 'llm',
                        telemetry
                    };
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["incrementLlmSuccess"])();
                } catch (llmError) {
                    console.warn('Assistant LLM (statistiques) indisponible, fallback heuristique.', llmError);
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["incrementLlmFallback"])();
                }
            }
            if (!narration) {
                narration = {
                    texte: construireNarrationHeuristique(intent, resume, insights, actions),
                    source: 'heuristique'
                };
            }
            const réponse = {
                question,
                type: 'statistiques',
                resume,
                statistiques,
                insights,
                actions,
                narration
            };
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["journaliserAssistant"])({
                type: 'response',
                intent,
                durationMs: Date.now() - startedAt,
                llmUsed: narration.source === 'llm'
            });
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(réponse);
        }
        if (!ROLES_AUTORISES_DOCUMENTS.has(role)) {
            return construireReponseRestreinte(question, intent, role);
        }
        const pieces = await rechercherDocuments(question, token, payload.topK ?? DEFAULT_TOP_K);
        const tone = payload.tone ?? 'amical' // Ton par défaut : amical
        ;
        const resume = construireResumeDocuments(question, pieces, tone);
        const insights = construireInsightsDocuments(pieces);
        const actions = construireActionsDocuments(pieces);
        let narration;
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$llm$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isLlmConfigured"])()) {
            try {
                const { content, telemetry } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$llm$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateLlmAnswer"])({
                    question,
                    intent,
                    pieces
                });
                narration = {
                    texte: content,
                    source: 'llm',
                    telemetry
                };
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["incrementLlmSuccess"])();
            } catch (llmError) {
                console.warn('Assistant LLM (documents) indisponible, fallback heuristique.', llmError);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["incrementLlmFallback"])();
            }
        }
        if (!narration) {
            narration = {
                texte: construireNarrationHeuristique(intent, resume, insights, actions),
                source: 'heuristique'
            };
        }
        const réponse = {
            question,
            type: 'documents',
            resume,
            pieces,
            insights,
            actions,
            narration
        };
        console.info('assistant-demo', {
            intent,
            questionLongueur: question.length,
            pieces: pieces.length,
            statistiques: false,
            llm: narration?.source === 'llm'
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["journaliserAssistant"])({
            type: 'response',
            intent,
            durationMs: Date.now() - startedAt,
            pieces: pieces.length,
            llmUsed: narration.source === 'llm'
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(réponse);
    } catch (error) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["incrementErrors"])();
        console.error('Erreur assistant-demo', error);
        if (error instanceof BackendError) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["journaliserAssistant"])({
                type: 'error',
                intent: undefined,
                durationMs: 0,
                message: error.message,
                status: error.status
            });
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                erreur: error.message
            }, {
                status: error.status
            });
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$assistant$2d$demo$2f$telemetry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["journaliserAssistant"])({
            type: 'error',
            intent: undefined,
            durationMs: 0,
            message: error?.message ?? 'Erreur interne'
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            erreur: "Erreur interne de l'assistant"
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__10cf7796._.js.map