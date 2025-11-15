/*
 * Utilitaires d'intégration LLM pour l'assistant IA.
 * L'objectif est de centraliser la configuration, la construction du prompt
 * et l'appel réseau afin de sécuriser l'intégration d'un modèle de langage.
 */

import type { DocumentPiece } from './types'

const PROVIDER = (process.env.ASSISTANT_LLM_PROVIDER ?? 'openai').toLowerCase()
const API_KEY = process.env.ASSISTANT_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? ''
const BASE_URL = process.env.ASSISTANT_LLM_BASE_URL ?? 'https://api.openai.com/v1'
const MODEL = process.env.ASSISTANT_LLM_MODEL ?? 'gpt-4o-mini'
const LLM_ENABLED = (process.env.ASSISTANT_LLM_ENABLED ?? 'true').toLowerCase() !== 'false'

export type LlmTelemetry = {
  provider: string
  model: string
  durationMs: number
  tokensInput?: number
  tokensOutput?: number
}

export type LlmPayload = {
  question: string
  intent: 'documents' | 'statistiques'
  pieces?: DocumentPiece[]
  statistiques?: Record<string, unknown>
}

export type LlmResult = {
  content: string
  telemetry: LlmTelemetry
}

export function isLlmConfigured(): boolean {
  return Boolean(API_KEY) && LLM_ENABLED
}

function sanitizeText(value: string | undefined | null): string {
  if (!value) return ''
  return value.replace(/\s+/g, ' ').trim()
}

export function buildPrompt(payload: LlmPayload): string {
  const intro = `Tu es un assistant spécialisé en archivage pour ACS. Réponds en français dans un style professionnel.`
  const questionBlock = `Question utilisateur : "${payload.question}".`

  const contextParts: string[] = []

  if (payload.intent === 'documents' && payload.pieces?.length) {
    const documents = payload.pieces
      .slice(0, 5)
      .map((piece, index) => {
        const resume = sanitizeText(piece.content)
        const metadata = piece.metadata ?? {}
        const highlights = Array.isArray(metadata.highlights)
          ? (metadata.highlights as string[])
          : []
        const highlightsText = highlights.map((line) => `- ${line}`).join('\n')
        return `Document ${index + 1} (${piece.source}, score ${piece.score.toFixed(3)}):\n${resume}\n${highlightsText}`
      })
      .join('\n\n')

    contextParts.push('Documents pertinents :\n' + documents)
  }

  if (payload.intent === 'statistiques' && payload.statistiques) {
    const statsText = JSON.stringify(payload.statistiques, null, 2)
    contextParts.push('Statistiques consolidées :\n' + statsText)
  }

  const directives = `Objectifs :
1. Fournir une réponse synthétique (3-5 phrases) adaptée à la question.
2. Souligner les points-clés utiles à un décideur.
3. Proposer des recommandations concrètes si pertinentes.

Structure attendue :
- Synthèse : ...
- Points clés : ... (liste)
- Recommandations : ... (liste, optionnelle)
`

  const context = contextParts.length
    ? `Contexte disponible :\n${contextParts.join('\n\n')}`
    : 'Aucun document pertinent n’a été trouvé. Fournis une réponse prudente.'

  return [intro, questionBlock, context, directives].join('\n\n')
}

async function callOpenAi(prompt: string): Promise<LlmResult> {
  const url = `${BASE_URL.replace(/\/$/, '')}/chat/completions`
  const started = Date.now()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'Tu es un assistant IA spécialisé dans la gouvernance documentaire et l’archivage.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 600,
    }),
  })

  const elapsed = Date.now() - started

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`LLM (${response.status}) ${detail}`)
  }

  const json = (await response.json()) as {
    choices: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const content = json.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('Réponse LLM vide')
  }

  return {
    content,
    telemetry: {
      provider: PROVIDER,
      model: MODEL,
      durationMs: elapsed,
      tokensInput: json.usage?.prompt_tokens,
      tokensOutput: json.usage?.completion_tokens,
    },
  }
}

export async function generateLlmAnswer(payload: LlmPayload): Promise<LlmResult> {
  if (!isLlmConfigured()) {
    throw new Error('LLM non configuré')
  }

  if (PROVIDER !== 'openai') {
    throw new Error(`Fournisseur LLM non pris en charge: ${PROVIDER}`)
  }

  const prompt = buildPrompt(payload)
  return callOpenAi(prompt)
}
