import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'

type CorpusEntry = {
  id: string
  source: string
  content: string
  metadata: Record<string, unknown>
}

type QueryPayload = {
  question?: string
  topK?: number
}

const CORPUS_PATH = path.join(process.cwd(), 'experiments', 'assistant-ia', 'indexes', 'corpus.json')

async function loadCorpus(): Promise<CorpusEntry[]> {
  const data = await fs.readFile(CORPUS_PATH, 'utf-8')
  return JSON.parse(data) as CorpusEntry[]
}

function scoreEntry(entry: CorpusEntry, question: string): number {
  const haystack = `${entry.content}\n${JSON.stringify(entry.metadata ?? {})}`.toLowerCase()
  const terms = question.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) {
    return 0
  }
  let score = 0
  for (const term of terms) {
    const occurrences = haystack.split(term).length - 1
    score += occurrences
  }
  return score
}

export async function POST(request: Request) {
  let payload: QueryPayload
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ erreur: 'Corps de requête invalide' }, { status: 400 })
  }

  const question = payload.question?.trim()
  if (!question) {
    return NextResponse.json({ erreur: 'La question est requise' }, { status: 400 })
  }

  try {
    const corpus = await loadCorpus()
    const scored = corpus
      .map((entry) => ({ entry, score: scoreEntry(entry, question) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, payload.topK ?? 3)
      .map(({ entry, score }) => ({ ...entry, score }))

    return NextResponse.json({ question, reponses: scored })
  } catch (error: any) {
    console.error('Erreur assistant-demo', error)
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ erreur: "Corpus non disponible. Exécutez 'py experiments/assistant-ia/build_index.py'" }, { status: 500 })
    }
    return NextResponse.json({ erreur: "Erreur interne de l'assistant" }, { status: 500 })
  }
}
