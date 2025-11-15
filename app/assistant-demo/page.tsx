'use client'

import { FormEvent, useState } from 'react'
import { Icon } from '@/components/Icon'

interface ReponseAssistant {
  id: string
  source: string
  content: string
  metadata: Record<string, unknown>
  score: number
}

export default function AssistantDemoPage() {
  const [question, setQuestion] = useState('Quels documents concernent la responsabilité civile ?')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [reponses, setReponses] = useState<ReponseAssistant[]>([])

  const interrogerAssistant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const propre = question.trim()
    if (!propre) {
      setErreur('Merci de saisir une question.')
      return
    }
    setChargement(true)
    setErreur(null)
    setReponses([])

    try {
      const response = await fetch('/api/assistant-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: propre }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.erreur ?? 'Erreur inconnue')
      }

      setReponses(payload.reponses ?? [])
    } catch (error) {
      console.error('Assistant demo', error)
      setErreur((error as Error).message)
    } finally {
      setChargement(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-10">
        <div className="max-w-3xl mx-auto space-y-8">
          <header className="text-center space-y-3">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent">
              Assistant IA (démo)
            </h1>
            <p className="text-gray-600">
              Prototype hors production utilisant un corpus factice généré dans <code>experiments/assistant-ia</code>.
            </p>
          </header>

          <section className="bg-white rounded-2xl shadow-lg p-6">
            <form onSubmit={interrogerAssistant} className="space-y-4">
              <div>
                <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                  Votre question
                </label>
                <textarea
                  id="question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={3}
                  placeholder="Exemple : Quels sont les documents archivés pour Mutuelle Santé+ en 2024 ?"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={chargement}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  <Icon name="sparkles" size="sm" />
                  {chargement ? 'Recherche…' : 'Interroger'}
                </button>
              </div>
            </form>

            {erreur ? (
              <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {erreur}
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            {reponses.length > 0 ? (
              <div className="space-y-4">
                {reponses.map((item) => (
                  <article key={item.id} className="bg-white rounded-2xl shadow p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                        {item.source}
                      </span>
                      <span className="text-xs text-gray-400">Score : {item.score.toFixed(3)}</span>
                    </div>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-line">{item.content}</p>
                    {item.metadata ? (
                      <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 overflow-x-auto">
                        {JSON.stringify(item.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500">
                {chargement ? 'Recherche en cours…' : "Aucun résultat pour l'instant."}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
