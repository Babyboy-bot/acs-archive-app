'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { apiFetchJson } from '@/lib/api'
import { getUtilisateurActif } from '@/lib/session'

export default function PageEditionDocument() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const documentId = params?.id

  const [chargement, setChargement] = useState(true)
  const [sauvegarde, setSauvegarde] = useState(false)
  const [erreur, setErreur] = useState('')

  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [risqueId, setRisqueId] = useState('')
  const [typeCourrier, setTypeCourrier] = useState('')
  const [auteurId, setAuteurId] = useState<string | null>(null)
  
  const [client, setClient] = useState('')
  const [exercice, setExercice] = useState('')

  // Charger le document
  useEffect(() => {
    const chargerDocument = async () => {
      setChargement(true)
      try {
        const { response, data } = await apiFetchJson(`/documents/${documentId}/`)
        if (!response.ok || !data || typeof data !== 'object') {
          throw new Error((data as any)?.detail || 'Document introuvable')
        }

        setTitre((data as any).titre ?? '')
        setDescription((data as any).description ?? '')
        setReference((data as any).reference ?? '')
        setRisqueId((data as any).risque ?? (data as any).risque_id ?? '')
        setTypeCourrier((data as any).type_courrier ?? (data as any).typeCourrier ?? '')

        const risque = (data as any).risque_detail ?? (data as any).risque
        const exercice = risque?.exercice ?? risque?.exercice_info
        setClient(exercice?.client ?? 'Client inconnu')
        setExercice(exercice?.annee ?? '—')
      } catch (error) {
        console.error('Erreur chargement document:', error)
        setErreur(error instanceof Error ? error.message : 'Erreur lors du chargement')
      } finally {
        setChargement(false)
      }
    }

    const utilisateur = getUtilisateurActif()
    if (utilisateur?.id) {
      setAuteurId(utilisateur.id)
    }

    chargerDocument()
  }, [documentId])


  const risques = [
    { value: 'AUTOMOBILE', label: 'Automobile', color: '#D32027' },
    { value: 'SANTE', label: 'Santé', color: '#10B981' },
    { value: 'HABITATION', label: 'Habitation', color: '#F59E0B' },
    { value: 'VIE', label: 'Vie', color: '#8B5CF6' },
    { value: 'RESPONSABILITE_CIVILE', label: 'RC', color: '#0066B3' },
  ]

  const courriers = [
    { value: 'ACS_VERS_CLIENT', label: 'ACS → Client', icon: 'send' as const },
    { value: 'ACS_VERS_COMPAGNIE', label: 'ACS → Compagnie', icon: 'email' as const },
    { value: 'AVENANT', label: 'Avenant', icon: 'edit' as const },
    { value: 'FACTURE', label: 'Facture', icon: 'card' as const },
    { value: 'REGLEMENT', label: 'Règlement', icon: 'check-circle' as const },
    { value: 'DIVERS', label: 'Divers', icon: 'sparkles' as const },
    { value: 'SINISTRE', label: 'Sinistre', icon: 'warning' as const },
  ]

  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSauvegarde(true)
    setErreur('')

    try {
      const payload: Record<string, unknown> = {
        titre: titre.trim(),
        description: description.trim(),
        reference: reference.trim() || null,
        type_courrier: typeCourrier,
        risque: risqueId,
      }

      if (auteurId) {
        payload.auteur = auteurId
      }

      const { response, data } = await apiFetchJson(`/documents/${documentId}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok || !data) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || 'Erreur lors de la sauvegarde')
      }

      router.push('/documents')
    } catch (error) {
      setErreur('Erreur de connexion')
      setSauvegarde(false)
    }
  }

  if (chargement) {
    return (
      <div className="min-h-screen bg-theme-base text-theme-primary">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        </main>
      </div>
    )
  }

  if (erreur && !titre) {
    return (
      <div className="min-h-screen bg-theme-base text-theme-primary">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
            <Icon name="warning" size="xl" className="text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-800 mb-2">{erreur}</h2>
            <button
              onClick={() => router.push('/documents')}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700"
            >
              Retour aux documents
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-theme-base text-theme-primary">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/documents')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Icon name="arrow-left" size="md" />
            </button>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
                <Icon name="edit" size="xl" className="text-red-600" />
                Modifier le Document
              </h1>
              <p className="text-gray-600 mt-2">
                Client: <strong>{client}</strong> • Exercice: <strong>{exercice}</strong>
              </p>
            </div>
          </div>
        </motion.div>

        {erreur && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3"
          >
            <Icon name="warning" size="sm" className="text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">{erreur}</p>
            </div>
            <button
              onClick={() => setErreur('')}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Fermer
            </button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-8"
        >
          <form onSubmit={sauvegarder} className="space-y-6">
            {/* Titre */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Titre du document *
              </label>
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                placeholder="Ex: Police Automobile 2025"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none resize-none"
                placeholder="Description optionnelle du document..."
              />
            </div>

            {/* Référence */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Référence
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                placeholder="Ex: DOC-2025-001"
              />
            </div>

            {/* Type de courrier */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Type de courrier *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courriers.map((courrier) => (
                  <motion.button
                    key={courrier.value}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTypeCourrier(courrier.value)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      typeCourrier === courrier.value
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        typeCourrier === courrier.value ? 'bg-red-500' : 'bg-gray-100'
                      }`}>
                        <Icon 
                          name={courrier.icon} 
                          size="md" 
                          className={typeCourrier === courrier.value ? 'text-white' : 'text-gray-600'}
                        />
                      </div>
                      <div>
                        <p className={`font-semibold ${
                          typeCourrier === courrier.value ? 'text-red-700' : 'text-gray-900'
                        }`}>
                          {courrier.label}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center gap-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push('/documents')}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={sauvegarde}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sauvegarde ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Icon name="check" size="sm" />
                    Sauvegarder les modifications
                  </>
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </main>
    </div>
  )
}
