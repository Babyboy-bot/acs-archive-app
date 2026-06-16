'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { AppLayout } from '@/components'
import { Icon } from '@/components/Icon'
import { apiFetch, apiFetchJson } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useEnforceNonConsultant } from '@/hooks/useEnforceNonConsultant'
import Link from 'next/link'

type Compagnie = {
  id: string
  nom: string
  numero_client: string | null
}

export default function PageNouveauBordereau() {
  const { estAuthentifie, chargement: authChargement } = useRequireAuth()
  useEnforceNonConsultant()
  const router = useRouter()

  const [fichier, setFichier] = useState<File | null>(null)
  const [titre, setTitre] = useState('')
  const [reference, setReference] = useState('')
  const [annee, setAnnee] = useState(String(new Date().getFullYear()))
  const [compagnieId, setCompagnieId] = useState('')

  const [compagnies, setCompagnies] = useState<Compagnie[]>([])
  const [chargementCompagnies, setChargementCompagnies] = useState(false)

  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState('')

  const chargerCompagnies = async () => {
    setChargementCompagnies(true)
    try {
      const { data } = await apiFetchJson<Compagnie[]>('/compagnies/')
      setCompagnies(data ?? [])
    } catch {
      setErreur('Impossible de charger les compagnies.')
    } finally {
      setChargementCompagnies(false)
    }
  }

  useEffect(() => {
    if (estAuthentifie) chargerCompagnies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estAuthentifie])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    if (!f) return
    setFichier(f)
    if (!titre) {
      setTitre(f.name.replace(/\.[^/.]+$/, ''))
    }
    const match = f.name.replace(/\.[^/.]+$/, '').match(/N[°º]?\s*\d+/i)
    if (!reference && match) {
      setReference(match[0].replace(/\s+/, ''))
    }
  }, [titre, reference])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.tiff', '.webp'],
    },
  })

  const retirerFichier = () => setFichier(null)

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur('')
    setSucces('')

    if (!fichier || !titre.trim() || !annee || !compagnieId) {
      setErreur('Veuillez remplir tous les champs obligatoires et sélectionner un fichier.')
      return
    }

    setChargement(true)
    try {
      const formData = new FormData()
      formData.append('file', fichier)
      formData.append('titre', titre.trim())
      formData.append('annee', annee)
      formData.append('compagnie_id', compagnieId)
      if (reference.trim()) formData.append('reference', reference.trim())

      const resp = await apiFetch('/bordereaux/upload/', {
        method: 'POST',
        body: formData,
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.erreur ?? `Erreur ${resp.status}`)
      }

      setSucces('Bordereau téléversé avec succès !')
      setTimeout(() => router.push('/bordereaux'), 1500)
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur lors du téléversement.')
    } finally {
      setChargement(false)
    }
  }

  const anneesDisponibles = Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i)

  if (authChargement) return null

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        {/* En-tête */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/bordereaux"
            className="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-muted transition-colors"
          >
            <Icon name="arrow-left" size="sm" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-theme-primary">Nouveau bordereau</h1>
            <p className="text-sm text-theme-secondary mt-0.5">Uploader un bordereau de compagnie</p>
          </div>
        </div>

        <form onSubmit={soumettre} className="space-y-5">
          {/* Zone de dépôt */}
          <div className="bg-theme-card border border-theme rounded-xl p-5">
            <h2 className="font-semibold text-theme-primary mb-3 flex items-center gap-2">
              <Icon name="upload" size="sm" className="text-[#D32027]" />
              Fichier
            </h2>

            {!fichier ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-[#D32027] bg-red-50 dark:bg-red-900/10'
                    : 'border-theme hover:border-[#D32027] hover:bg-theme-muted/30'
                }`}
              >
                <input {...getInputProps()} />
                <Icon name="document" size="lg" className="mx-auto mb-3 text-theme-secondary opacity-50" />
                <p className="text-sm text-theme-secondary">
                  {isDragActive ? 'Déposez le fichier ici…' : 'Glissez un fichier ou cliquez pour choisir'}
                </p>
                <p className="text-xs text-theme-secondary mt-1 opacity-70">PDF, PNG, JPG, TIFF, WEBP</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-theme-muted/40 rounded-lg border border-theme"
              >
                <Icon name="document" size="sm" className="text-[#D32027] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary truncate">{fichier.name}</p>
                  <p className="text-xs text-theme-secondary">
                    {(fichier.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retirerFichier}
                  className="p-1.5 rounded-lg text-theme-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Icon name="close" size="sm" />
                </button>
              </motion.div>
            )}
          </div>

          {/* Métadonnées */}
          <div className="bg-theme-card border border-theme rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-theme-primary flex items-center gap-2">
              <Icon name="edit" size="sm" className="text-[#D32027]" />
              Informations
            </h2>

            {/* Titre */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1.5">
                Titre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={titre}
                onChange={e => setTitre(e.target.value)}
                placeholder="Ex: Bordereau AXA – Automobile 2024"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-theme bg-theme-base text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#D32027]"
              />
            </div>

            {/* Référence */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1.5">
                Référence
              </label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Ex: REF-2024-001"
                className="w-full px-3 py-2.5 rounded-lg border border-theme bg-theme-base text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#D32027]"
              />
            </div>

            {/* Année + Compagnie sur la même ligne */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1.5">
                  Exercice (année) <span className="text-red-500">*</span>
                </label>
                <select
                  value={annee}
                  onChange={e => setAnnee(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-theme bg-theme-base text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#D32027]"
                >
                  {anneesDisponibles.map(a => (
                    <option key={a} value={String(a)}>{a}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1.5">
                  Compagnie <span className="text-red-500">*</span>
                </label>
                {chargementCompagnies ? (
                  <div className="px-3 py-2.5 text-sm text-theme-secondary">Chargement…</div>
                ) : compagnies.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    Aucune compagnie. Contactez un administrateur.
                  </div>
                ) : (
                  <select
                    value={compagnieId}
                    onChange={e => setCompagnieId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-theme bg-theme-base text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#D32027]"
                  >
                    <option value="">— Sélectionner —</option>
                    {compagnies.map(c => (
                      <option key={c.id} value={c.id}>{c.nom}{c.numero_client ? ` (${c.numero_client})` : ''}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          {erreur && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              <Icon name="warning" size="sm" />
              {erreur}
            </div>
          )}
          {succes && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
              <Icon name="check-circle" size="sm" />
              {succes}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Link
              href="/bordereaux"
              className="px-4 py-2.5 rounded-lg border border-theme text-theme-secondary hover:text-theme-primary hover:bg-theme-muted transition-colors text-sm font-medium"
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={chargement || !fichier || !titre.trim() || !annee || !compagnieId}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D32027] text-white font-medium text-sm hover:bg-[#b91c1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {chargement ? (
                <>
                  <Icon name="clock" size="sm" className="animate-spin" />
                  Envoi…
                </>
              ) : (
                <>
                  <Icon name="upload" size="sm" />
                  Téléverser
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
