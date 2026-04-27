'use client'

import { Sidebar } from '@/components/Sidebar'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { apiFetchJson } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'

export default function PageNouveauDocument() {
  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const { estAuthentifie, chargement: authChargement } = useRequireAuth()
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
  // Mode bulk : données par fichier
  const [titresParFichier, setTitresParFichier] = useState<string[]>([])
  const [referencesParFichier, setReferencesParFichier] = useState<string[]>([])
  const [progressBulk, setProgressBulk] = useState<{ done: number; total: number } | null>(null)
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
  const [rechercheClient, setRechercheClient] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)

  // Fermer le dropdown client quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setClientDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const clientsFiltres = useMemo(() => {
    if (!rechercheClient.trim()) {
      return clients.slice(0, 50)
    }
    const rechercheLower = rechercheClient.toLowerCase()
    return clients.filter(client => 
      client.nom.toLowerCase().includes(rechercheLower)
    ).slice(0, 50)
  }, [clients, rechercheClient])

  const extraireNomSansExtension = (nom: string) => nom.replace(/\.[^/.]+$/, '')

  const extraireReference = (nom: string) => {
    const nomSansExt = nom.replace(/\.[^/.]+$/, '')
    const match = nomSansExt.match(/N[°º]?\s*\d+/i)
    if (match) return match[0].replace(/\s+/, '')
    return nomSansExt.split(' ')[0]
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFichiers(prev => [...prev, ...acceptedFiles])
    setTitresParFichier(prev => [...prev, ...acceptedFiles.map(f => f.name.replace(/\.[^/.]+$/, ''))])
    setReferencesParFichier(prev => [...prev, ...acceptedFiles.map(f => extraireReference(f.name))])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.png', '.jpg', '.jpeg']
    }
  })

  const retirerFichier = (index: number) => {
    setFichiers(prev => prev.filter((_, i) => i !== index))
    setTitresParFichier(prev => prev.filter((_, i) => i !== index))
    setReferencesParFichier(prev => prev.filter((_, i) => i !== index))
  }

  const mettreAJourTitre = (index: number, valeur: string) => {
    setTitresParFichier(prev => prev.map((t, i) => i === index ? valeur : t))
  }

  const mettreAJourReference = (index: number, valeur: string) => {
    setReferencesParFichier(prev => prev.map((r, i) => i === index ? valeur : r))
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

        const normalises = bruts.map((client: any) => ({
          id: client.id,
          nom: client.nom,
          exercices: Array.isArray(client.exercices)
            ? client.exercices.map((exercice: any) => ({
                id: exercice.id,
                annee: exercice.annee,
                risques: Array.isArray(exercice.risques)
                  ? exercice.risques.map((risque: any) => ({
                      id: risque.id,
                      type: risque.type,
                      numeroPolice: risque.numeroPolice ?? risque.numero_police ?? null
                    }))
                  : []
              }))
            : []
        }))

        setClients(normalises)
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

    const estBulk = fichiers.length > 1
    if (estBulk) setProgressBulk({ done: 0, total: fichiers.length })

    try {
      for (let idx = 0; idx < fichiers.length; idx++) {
        const fichier = fichiers[idx]
        const titreFichier = estBulk
          ? (titresParFichier[idx] || extraireNomSansExtension(fichier.name))
          : titre
        const referenceFichier = estBulk ? (referencesParFichier[idx] || '') : reference

        const formData = new FormData()
        formData.append('file', fichier)
        formData.append('titre', titreFichier.trim())
        formData.append('description', description.trim())
        formData.append('risque_id', risqueId)
        formData.append('type_courrier', typeCourrier)
        formData.append('reference', referenceFichier.trim())
        formData.append('auteur_id', auteurId)

        const { response, data } = await apiFetchJson('/documents/upload/', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error((data as any)?.erreur || `Erreur sur le fichier ${fichier.name}`)
        }
        if (estBulk) setProgressBulk({ done: idx + 1, total: fichiers.length })
      }

      setProgressBulk(null)
      setMessageSucces(estBulk
        ? `${fichiers.length} documents téléversés avec succès. Redirection…`
        : 'Document téléversé avec succès. Redirection…')
      setTimeout(() => {
        router.push('/documents')
      }, 1500)
    } catch (error) {
      console.error('Erreur upload:', error)
      setProgressBulk(null)
      setErreur(error instanceof Error ? error.message : 'Erreur lors du téléversement')
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

  // Attendre la vérification d'authentification (après tous les hooks)
  if (authChargement || !estAuthentifie) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-base">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-theme-secondary text-sm">Vérification de l'authentification...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-theme-base text-theme-primary flex">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-10 overflow-auto">
        {/* En-tête minimaliste */}
        <motion.header 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <p className="text-sm font-medium text-theme-secondary uppercase tracking-wider mb-1">Téléversement</p>
          <h1 className="text-3xl font-semibold text-theme-primary">Nouveau document</h1>
        </motion.header>

        {erreur && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm"
          >
            {erreur}
          </motion.div>
        )}

        {messageSucces && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 text-green-700 dark:text-green-400 text-sm"
          >
            {messageSucces}
          </motion.div>
        )}

        {/* Indicateur d'étapes */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all ${
                  etape >= num
                    ? 'bg-red-600 text-white'
                    : 'bg-theme-muted text-theme-secondary'
                }`}>
                  {num}
                </div>
                {num < 3 && (
                  <div className={`w-16 h-0.5 mx-2 transition-all ${
                    etape > num ? 'bg-red-600' : 'bg-theme-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-16 mt-2">
            <span className={`text-xs ${etape === 1 ? 'text-red-600 font-medium' : 'text-theme-secondary'}`}>Fichier</span>
            <span className={`text-xs ${etape === 2 ? 'text-red-600 font-medium' : 'text-theme-secondary'}`}>Informations</span>
            <span className={`text-xs ${etape === 3 ? 'text-red-600 font-medium' : 'text-theme-secondary'}`}>Validation</span>
          </div>
        </motion.div>

        <form onSubmit={soumettreFormulaire}>
          {etape === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-theme-card border border-theme rounded-xl p-6"
            >
              <h2 className="text-sm font-semibold text-theme-primary mb-4">Sélectionnez vos fichiers</h2>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                    : 'border-theme hover:border-red-300 hover:bg-theme-muted/50'
                }`}
              >
                <input {...getInputProps()} />
                <Icon name="upload" size="lg" className="mx-auto mb-3 text-theme-secondary" />
                {isDragActive ? (
                  <p className="text-sm font-medium text-red-600">Déposez les fichiers ici...</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-theme-primary mb-1">Glissez-déposez vos fichiers</p>
                    <p className="text-xs text-theme-secondary">ou cliquez pour parcourir</p>
                    <p className="text-xs text-theme-secondary mt-2">PDF, Word, Excel, Images (Max 10 MB)</p>
                  </>
                )}
              </div>

              {fichiers.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-medium text-theme-secondary uppercase tracking-wider mb-3">
                    {fichiers.length} fichier{fichiers.length > 1 ? 's' : ''} sélectionné{fichiers.length > 1 ? 's' : ''}
                  </h3>
                  <div className="space-y-2">
                    {fichiers.map((fichier, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-theme-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 bg-theme-muted rounded-lg flex items-center justify-center flex-shrink-0">
                            <Icon name="document" size="sm" className="text-theme-secondary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-theme-primary truncate">{fichier.name}</p>
                            <p className="text-xs text-theme-secondary">{formatTaille(fichier.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => retirerFichier(index)}
                          className="p-2 text-theme-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Icon name="trash" size="sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6 pt-4 border-t border-theme">
                <button
                  type="button"
                  onClick={() => setEtape(2)}
                  disabled={fichiers.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Suivant
                  <Icon name="arrow-right" size="sm" />
                </button>
              </div>
            </motion.div>
          )}

          {etape === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-theme-card border border-theme rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-theme-primary">
                  {fichiers.length > 1 ? `Upload en lot — ${fichiers.length} fichiers` : 'Informations du document'}
                </h2>
                {fichiers.length > 1 && (
                  <span className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full font-medium">
                    Mode lot
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Titre — solo uniquement */}
                {fichiers.length === 1 && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-theme-secondary mb-1.5">Titre *</label>
                    <input
                      type="text"
                      value={titre}
                      onChange={(e) => setTitre(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-theme-base border border-theme rounded-lg focus:border-red-400 outline-none"
                      placeholder="Ex: Police Automobile 2025"
                      required
                    />
                  </div>
                )}

                {/* Description — solo uniquement */}
                {fichiers.length === 1 && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-theme-secondary mb-1.5">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm bg-theme-base border border-theme rounded-lg focus:border-red-400 outline-none resize-none"
                      placeholder="Description optionnelle"
                    />
                  </div>
                )}

                {/* Client — commun */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1.5">Client *</label>
                  <div className="relative" ref={clientDropdownRef}>
                    <input
                      type="text"
                      value={rechercheClient}
                      onChange={(e) => {
                        setRechercheClient(e.target.value)
                        setClientDropdownOpen(true)
                      }}
                      onFocus={() => setClientDropdownOpen(true)}
                      className="w-full px-3 py-2 text-sm bg-theme-base border border-theme rounded-lg focus:border-red-400 outline-none"
                      placeholder="Tapez pour rechercher un client..."
                      disabled={chargementClients}
                    />
                    {clientDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-theme-card border border-theme rounded-lg shadow-lg max-h-60 overflow-auto">
                        {clientsFiltres.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-theme-secondary">Aucun client trouvé</div>
                        ) : (
                          clientsFiltres.map((client) => (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => {
                                setClientId(client.id)
                                setRechercheClient(client.nom)
                                setClientDropdownOpen(false)
                                setExerciceId('')
                                setRisqueId('')
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-theme-muted transition-colors ${
                                clientId === client.id ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'text-theme-primary'
                              }`}
                            >
                              {client.nom}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {clients.length === 0 && !chargementClients && (
                    <p className="text-xs text-amber-600 mt-1">Aucun client disponible</p>
                  )}
                </div>

                {/* Exercice — commun */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1.5">Exercice *</label>
                  <select
                    value={exerciceId}
                    onChange={(e) => setExerciceId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-theme-base border border-theme rounded-lg focus:border-red-400 outline-none"
                    required
                    disabled={!clientId || chargementClients}
                  >
                    <option value="">Sélectionner</option>
                    {exercicesDisponibles.map((exercice) => (
                      <option key={exercice.id} value={exercice.id}>{exercice.annee}</option>
                    ))}
                  </select>
                  {clientId && exercicesDisponibles.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Aucun exercice disponible</p>
                  )}
                </div>

                {/* Type de courrier — commun */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-theme-secondary mb-1.5">Type de courrier *</label>
                  <div className="flex flex-wrap gap-2">
                    {courriers.map((option) => {
                      const actif = typeCourrier === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTypeCourrier(option.value)}
                          className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                            actif 
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium' 
                              : 'border-theme hover:bg-theme-muted text-theme-primary'
                          }`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Risque — commun */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1.5">Risque *</label>
                  <select
                    value={risqueId}
                    onChange={(e) => setRisqueId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-theme-base border border-theme rounded-lg focus:border-red-400 outline-none"
                    required
                    disabled={!exerciceId || chargementClients}
                  >
                    <option value="">Sélectionner</option>
                    {risquesDisponibles.map((risque) => (
                      <option key={risque.id} value={risque.id}>
                        {risque.type} {risque.numeroPolice ? `- ${risque.numeroPolice}` : ''}
                      </option>
                    ))}
                  </select>
                  {exerciceId && risquesDisponibles.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Aucun risque disponible</p>
                  )}
                </div>

                {/* Référence — solo uniquement */}
                {fichiers.length === 1 && (
                  <div>
                    <label className="block text-xs font-medium text-theme-secondary mb-1.5">Référence</label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-theme-base border border-theme rounded-lg focus:border-red-400 outline-none"
                      placeholder="Ex: DOC-2025-001"
                    />
                  </div>
                )}
              </div>

              {/* Mode bulk : tableau titre/référence par fichier */}
              {fichiers.length > 1 && (
                <div className="mt-6">
                  <p className="text-xs font-medium text-theme-secondary uppercase tracking-wider mb-3">
                    Titre et référence par fichier
                  </p>
                  <div className="space-y-2">
                    {fichiers.map((fichier, index) => (
                      <div key={index} className="p-3 bg-theme-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon name="document" size="sm" className="text-theme-secondary flex-shrink-0" />
                          <p className="text-xs text-theme-secondary truncate">{fichier.name}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-theme-secondary mb-1">Titre</label>
                            <input
                              type="text"
                              value={titresParFichier[index] ?? ''}
                              onChange={(e) => mettreAJourTitre(index, e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-theme-base border border-theme rounded-lg focus:border-red-400 outline-none"
                              placeholder="Titre du document"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-theme-secondary mb-1">Référence</label>
                            <input
                              type="text"
                              value={referencesParFichier[index] ?? ''}
                              onChange={(e) => mettreAJourReference(index, e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-theme-base border border-theme rounded-lg focus:border-red-400 outline-none"
                              placeholder="Ex: DOC-2025-001"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-6 pt-4 border-t border-theme">
                <button
                  type="button"
                  onClick={() => setEtape(1)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm text-theme-secondary hover:bg-theme-muted rounded-lg transition-colors"
                >
                  <Icon name="arrow-left" size="sm" />
                  Retour
                </button>
                <button
                  type="button"
                  onClick={() => setEtape(3)}
                  disabled={(fichiers.length === 1 && !titre.trim()) || !clientId || !exerciceId || !risqueId || !typeCourrier || chargementClients}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Continuer
                  <Icon name="arrow-right" size="sm" />
                </button>
              </div>
            </motion.div>
          )}

          {etape === 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-theme-card border border-theme rounded-xl p-6"
            >
              <h2 className="text-sm font-semibold text-theme-primary mb-4">Validation finale</h2>

              {/* Métadonnées communes */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-theme-muted/50 rounded-lg mb-4">
                {fichiers.length === 1 && (
                  <div>
                    <p className="text-xs text-theme-secondary">Titre</p>
                    <p className="text-sm font-medium text-theme-primary">{titre || '-'}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-theme-secondary">Client</p>
                  <p className="text-sm font-medium text-theme-primary">{clientSelectionne?.nom ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-theme-secondary">Exercice</p>
                  <p className="text-sm font-medium text-theme-primary">{exerciceSelectionne?.annee ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-theme-secondary">Risque</p>
                  <p className="text-sm font-medium text-theme-primary">{risqueSelectionne ? `${risqueSelectionne.type}${risqueSelectionne.numeroPolice ? ` - ${risqueSelectionne.numeroPolice}` : ''}` : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-theme-secondary">Type</p>
                  <p className="text-sm font-medium text-theme-primary">{typeCourrierSelectionne?.label ?? '-'}</p>
                </div>
                {fichiers.length === 1 && (
                  <div>
                    <p className="text-xs text-theme-secondary">Référence</p>
                    <p className="text-sm font-medium text-theme-primary">{reference || '-'}</p>
                  </div>
                )}
              </div>

              {description && fichiers.length === 1 && (
                <div className="mb-4 p-3 bg-theme-muted/50 rounded-lg">
                  <p className="text-xs text-theme-secondary mb-1">Description</p>
                  <p className="text-sm text-theme-primary">{description}</p>
                </div>
              )}

              {/* Liste fichiers */}
              <div className="mb-6">
                <p className="text-xs font-medium text-theme-secondary uppercase tracking-wider mb-2">
                  {fichiers.length} fichier{fichiers.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-2">
                  {fichiers.map((fichier, index) => (
                    <div key={index} className="p-3 bg-theme-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Icon name="document" size="sm" className="text-theme-secondary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-theme-primary truncate">{fichier.name}</p>
                          <p className="text-xs text-theme-secondary">{formatTaille(fichier.size)}</p>
                        </div>
                      </div>
                      {fichiers.length > 1 && (
                        <div className="mt-2 ml-7 flex gap-4">
                          <p className="text-xs text-theme-secondary">
                            Titre : <span className="text-theme-primary font-medium">{titresParFichier[index] || extraireNomSansExtension(fichier.name)}</span>
                          </p>
                          {referencesParFichier[index] && (
                            <p className="text-xs text-theme-secondary">
                              Réf : <span className="text-theme-primary font-medium">{referencesParFichier[index]}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Barre de progression bulk */}
              {progressBulk && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-theme-secondary mb-1">
                    <span>Téléversement en cours…</span>
                    <span>{progressBulk.done}/{progressBulk.total}</span>
                  </div>
                  <div className="w-full bg-theme-muted rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progressBulk.done / progressBulk.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-theme">
                <button
                  type="button"
                  onClick={() => setEtape(2)}
                  disabled={chargement}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm text-theme-secondary hover:bg-theme-muted rounded-lg transition-colors"
                >
                  <Icon name="arrow-left" size="sm" />
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={chargement}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {chargement ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {progressBulk ? `${progressBulk.done}/${progressBulk.total} envoyés…` : 'Envoi…'}
                    </>
                  ) : (
                    <>
                      <Icon name="check" size="sm" />
                      {fichiers.length > 1 ? `Enregistrer ${fichiers.length} documents` : 'Enregistrer'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </form>
      </main>
    </div>
  )
}
