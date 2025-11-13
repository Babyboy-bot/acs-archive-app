'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { apiFetchJson } from '@/lib/api'

export default function PageNouveauDocument() {
  const router = useRouter()
  const [etape, setEtape] = useState(1)
  const [fichiers, setFichiers] = useState<File[]>([])
  const [chargement, setChargement] = useState(false)

  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [exerciceId, setExerciceId] = useState('')
  const [risqueId, setRisqueId] = useState('')
  const [typeCourrier, setTypeCourrier] = useState('')
  const [reference, setReference] = useState('')
  const [auteurId, setAuteurId] = useState('')
  const [messageSucces, setMessageSucces] = useState('')
  const [erreur, setErreur] = useState('')

  const [clients, setClients] = useState<{
    id: string
    nom: string
    exercices: {
      id: string
      annee: number
      risques: { id: string; type: string; numeroPolice: string | null }[]
    }[]
  }[]>([])
  const [chargementClients, setChargementClients] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFichiers(prev => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.png', '.jpg', '.jpeg']
    }
  })

  const retirerFichier = (index: number) => {
    setFichiers(prev => prev.filter((_, i) => i !== index))
  }

  const exercicesDisponibles = useMemo(() => {
    if (!clientId) {
      return []
    }
    return clients.find((client) => client.id === clientId)?.exercices ?? []
  }, [clients, clientId])

  const risquesDisponibles = useMemo(() => {
    if (!exerciceId) {
      return []
    }
    return exercicesDisponibles.find((exercice) => exercice.id === exerciceId)?.risques ?? []
  }, [exercicesDisponibles, exerciceId])

  const courriers = [
    { value: 'ACS_VERS_CLIENT', label: 'ACS → Client', icon: 'send' as const },
    { value: 'ACS_VERS_COMPAGNIE', label: 'ACS → Compagnie', icon: 'email' as const },
    { value: 'AVENANT', label: 'Avenant', icon: 'edit' as const },
    { value: 'FACTURE', label: 'Facture', icon: 'card' as const },
    { value: 'REGLEMENT', label: 'Règlement', icon: 'check-circle' as const },
    { value: 'DIVERS', label: 'Divers', icon: 'sparkles' as const },
    { value: 'SINISTRE', label: 'Sinistre', icon: 'warning' as const }
  ]

  const clientSelectionne = useMemo(() => {
    return clients.find((client) => client.id === clientId) ?? null
  }, [clients, clientId])

  const exerciceSelectionne = useMemo(() => {
    return exercicesDisponibles.find((exercice) => exercice.id === exerciceId) ?? null
  }, [exercicesDisponibles, exerciceId])

  const risqueSelectionne = useMemo(() => {
    return risquesDisponibles.find((risque) => risque.id === risqueId) ?? null
  }, [risquesDisponibles, risqueId])

  const typeCourrierSelectionne = useMemo(() => {
    return courriers.find((option) => option.value === typeCourrier) ?? null
  }, [courriers, typeCourrier])

  useEffect(() => {
    const chargerClients = async () => {
      setChargementClients(true)
      setErreur('')
      try {
        const { response, data } = await apiFetchJson('/clients/')
        if (!response.ok || !data) {
          throw new Error((data as any)?.erreur || (data as any)?.detail || 'Impossible de charger les clients')
        }

        const bruts = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.results)
            ? (data as any).results
            : []

        setClients(bruts)
      } catch (error: any) {
        console.error('Erreur chargement clients:', error)
        setErreur(error?.message || 'Erreur lors du chargement des clients')
      } finally {
        setChargementClients(false)
      }
    }

    chargerClients()
  }, [])

  useEffect(() => {
    const utilisateurActif = localStorage.getItem('utilisateurActif')
    if (utilisateurActif) {
      try {
        const parsed = JSON.parse(utilisateurActif)
        if (parsed?.id) {
          setAuteurId(parsed.id)
        }
      } catch (error) {
        console.warn('Impossible de parser utilisateurActif:', error)
      }
    }
  }, [])

  useEffect(() => {
    // Réinitialiser les sélections dépendantes
    setExerciceId('')
    setRisqueId('')
  }, [clientId])

  useEffect(() => {
    setRisqueId('')
  }, [exerciceId])

  const soumettreFormulaire = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setChargement(true)
    setErreur('')
    setMessageSucces('')

    if (!auteurId) {
      setErreur('Impossible d’identifier l’utilisateur courant. Merci de vous reconnecter.')
      setChargement(false)
      return
    }

    if (!clientId || !exerciceId || !risqueId) {
      setErreur('Veuillez sélectionner un client, un exercice et un risque.')
      setChargement(false)
      return
    }

    if (typeCourrier === '') {
      setErreur('Veuillez sélectionner un type de courrier.')
      setChargement(false)
      return
    }

    if (fichiers.length === 0) {
      setErreur('Veuillez sélectionner au moins un fichier.')
      setChargement(false)
      return
    }

    try {
      for (const fichier of fichiers) {
        const formData = new FormData()
        formData.append('file', fichier)
        formData.append('titre', titre.trim())
        formData.append('description', description.trim())
        formData.append('risque_id', risqueId)
        formData.append('type_courrier', typeCourrier)
        formData.append('reference', reference.trim())
        formData.append('auteur_id', auteurId)

        const { response, data } = await apiFetchJson('/documents/upload/', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error((data as any)?.erreur || 'Erreur lors de l’upload')
        }
      }

      setMessageSucces('Document téléversé avec succès. Redirection…')
      setTimeout(() => {
        router.push('/documents')
      }, 1500)
    } catch (error) {
      console.error('Erreur upload:', error)
      setErreur(error instanceof Error ? error.message : 'Erreur lors de l’upload')
      setChargement(false)
    }
  }

  const formatTaille = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent mb-2 flex items-center gap-3">
            <Icon name="upload" size="xl" className="text-red-600" />
            Nouveau Document
          </h1>
          <p className="text-gray-600">Ajoutez un document à l'archive ACS</p>
        </motion.div>

        {erreur && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
          >
            {erreur}
          </motion.div>
        )}

        {messageSucces && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700"
          >
            {messageSucces}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold transition-all ${
                  etape >= num
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg scale-110'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {num}
                </div>
                {num < 3 && (
                  <div className={`w-24 h-1 mx-2 transition-all ${
                    etape > num ? 'bg-gradient-to-r from-red-500 to-blue-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-32 mt-3">
            <span className={`text-sm font-medium ${etape === 1 ? 'text-red-600' : 'text-gray-500'}`}>Fichier</span>
            <span className={`text-sm font-medium ${etape === 2 ? 'text-red-600' : 'text-gray-500'}`}>Informations</span>
            <span className={`text-sm font-medium ${etape === 3 ? 'text-red-600' : 'text-gray-500'}`}>Validation</span>
          </div>
        </motion.div>

        <form onSubmit={soumettreFormulaire}>
          {etape === 1 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-lg p-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Sélectionnez vos fichiers</h2>

              <div
                {...getRootProps()}
                className={`border-4 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-red-500 bg-red-50 scale-105'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <input {...getInputProps()} />
                <motion.div
                  animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
                  className="mb-4"
                >
                  <Icon name="folder" size="xl" className="mx-auto text-gray-400" />
                </motion.div>
                {isDragActive ? (
                  <p className="text-xl font-semibold text-red-600">Déposez les fichiers ici...</p>
                ) : (
                  <>
                    <p className="text-xl font-semibold text-gray-700 mb-2">
                      Glissez-déposez vos fichiers ici
                    </p>
                    <p className="text-gray-500 mb-4">ou cliquez pour parcourir</p>
                    <p className="text-sm text-gray-400">
                      PDF, Word, Excel, Images (Max 10 MB par fichier)
                    </p>
                  </>
                )}
              </div>

              {fichiers.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-bold text-gray-900 mb-4">Fichiers sélectionnés ({fichiers.length})</h3>
                  <div className="space-y-3">
                    {fichiers.map((fichier, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-red-300 transition-all"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white">
                            <Icon name="document" size="md" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{fichier.name}</p>
                            <p className="text-sm text-gray-500">{formatTaille(fichier.size)}</p>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          type="button"
                          onClick={() => retirerFichier(index)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Icon name="trash" size="sm" className="text-red-600" />
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-8">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => setEtape(2)}
                  disabled={fichiers.length === 0}
                  className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Suivant
                  <Icon name="arrow-right" size="sm" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {etape === 2 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-lg p-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Informations du document</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Titre du document *
                  </label>
                  <input
                    type="text"
                    value={titre}
                    onChange={(e) => setTitre(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    placeholder="Ex: Police Automobile 2025"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    placeholder="Ajoutez une description (facultatif)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Client *</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    required
                    disabled={chargementClients}
                  >
                    <option value="">Sélectionner un client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.nom}</option>
                    ))}
                  </select>
                  {clients.length === 0 && !chargementClients && (
                    <p className="text-xs text-amber-600 mt-1">
                      Aucun client disponible. Vérifiez la base avant de téléverser un document.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Exercice *</label>
                  <select
                    value={exerciceId}
                    onChange={(e) => setExerciceId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    required
                    disabled={!clientId || chargementClients}
                  >
                    <option value="">Sélectionner un exercice</option>
                    {exercicesDisponibles.map((exercice) => (
                      <option key={exercice.id} value={exercice.id}>{exercice.annee}</option>
                    ))}
                  </select>
                  {clientId && exercicesDisponibles.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Ce client ne possède aucun exercice. Créez-en un avant de poursuivre.
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Type de courrier *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {courriers.map((option) => {
                      const actif = typeCourrier === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTypeCourrier(option.value)}
                          className={`p-4 border-2 rounded-xl transition-all flex items-center gap-3 ${
                            actif ? 'border-red-500 bg-red-50 text-red-600 shadow-md' : 'border-gray-200 hover:border-red-300'
                          }`}
                        >
                          <Icon name={option.icon} size="sm" />
                          <span className="font-semibold">{option.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  {!typeCourrier && (
                    <p className="text-xs text-gray-500 mt-1">Sélectionnez un type pour continuer.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Risque *</label>
                  <select
                    value={risqueId}
                    onChange={(e) => setRisqueId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    required
                    disabled={!exerciceId || chargementClients}
                  >
                    <option value="">Sélectionner un risque</option>
                    {risquesDisponibles.map((risque) => (
                      <option key={risque.id} value={risque.id}>
                        {risque.type} {risque.numeroPolice ? `- ${risque.numeroPolice}` : ''}
                      </option>
                    ))}
                  </select>
                  {exerciceId && risquesDisponibles.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Aucun risque trouvé pour cet exercice.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Référence</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                    placeholder="Ex: DOC-2025-001 (facultatif)"
                  />
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => setEtape(1)}
                  className="px-8 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors flex items-center gap-2"
                >
                  <Icon name="arrow-left" size="sm" />
                  Retour
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => setEtape(3)}
                  disabled={
                    !titre.trim() || !clientId || !exerciceId || !risqueId || !typeCourrier || chargementClients
                  }
                  className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-40 flex items-center gap-2"
                >
                  Continuer
                  <Icon name="arrow-right" size="sm" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {etape === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-lg p-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Validation finale</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-gray-100 rounded-xl p-6 mb-6 bg-gray-50">
                <div>
                  <p className="text-gray-500 text-sm">Titre</p>
                  <p className="font-semibold text-gray-900">{titre || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Client</p>
                  <p className="font-semibold text-gray-900">{clientSelectionne?.nom ?? '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Exercice</p>
                  <p className="font-semibold text-gray-900">{exerciceSelectionne?.annee ?? '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Risque</p>
                  <p className="font-semibold text-gray-900">{risqueSelectionne ? `${risqueSelectionne.type}${risqueSelectionne.numeroPolice ? ` - ${risqueSelectionne.numeroPolice}` : ''}` : '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Type de courrier</p>
                  <p className="font-semibold text-gray-900">{typeCourrierSelectionne?.label ?? '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Référence</p>
                  <p className="font-semibold text-gray-900">{reference || '-'}</p>
                </div>
              </div>

              {description && (
                <div className="mb-6">
                  <p className="text-gray-500 text-sm">Description</p>
                  <p className="text-gray-900 whitespace-pre-wrap">{description}</p>
                </div>
              )}

              <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 mb-8">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Icon name="folder" size="sm" />
                  Fichiers ({fichiers.length})
                </h3>
                <div className="space-y-2">
                  {fichiers.map((fichier, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center gap-3">
                        <Icon name="document" size="sm" className="text-red-600" />
                        <div>
                          <p className="font-medium text-gray-900">{fichier.name}</p>
                          <p className="text-sm text-gray-500">{formatTaille(fichier.size)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => setEtape(2)}
                  disabled={chargement}
                  className="px-8 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors flex items-center gap-2"
                >
                  <Icon name="arrow-left" size="sm" />
                  Retour
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={chargement}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-40 flex items-center gap-2"
                >
                  {chargement ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Icon name="check" size="sm" />
                      Valider et enregistrer
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </form>
      </main>
    </div>
  )
}
