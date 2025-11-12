'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

export default function PageNouveauDocument() {
  const router = useRouter()
  const [etape, setEtape] = useState(1)
  const [fichiers, setFichiers] = useState<File[]>([])
  const [chargement, setChargement] = useState(false)

  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [client, setClient] = useState('')
  const [exercice, setExercice] = useState('2025')
  const [risque, setRisque] = useState('')
  const [typeCourrier, setTypeCourrier] = useState('')
  const [reference, setReference] = useState('')

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

  const clients = [
    { id: '1', nom: 'Entreprise ABC' },
    { id: '2', nom: 'SARL Transport CI' },
    { id: '3', nom: 'Kouassi Jean-Marie' },
  ]

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
  ]

  const soumettreFormulaire = async (e: React.FormEvent) => {
    e.preventDefault()
    setChargement(true)
    setTimeout(() => {
      setChargement(false)
      router.push('/documents')
    }, 2000)
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Client *</label>
                  <select
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                    required
                  >
                    <option value="">Sélectionner un client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Exercice (Année) *</label>
                  <select
                    value={exercice}
                    onChange={(e) => setExercice(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                    required
                  >
                    {[2025, 2024, 2023, 2022].map((annee) => (
                      <option key={annee} value={annee}>{annee}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Type de Risque *</label>
                  <select
                    value={risque}
                    onChange={(e) => setRisque(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all outline-none"
                    required
                  >
                    <option value="">Sélectionner un risque</option>
                    {risques.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Type de Courrier *</label>
                  <select
                    value={typeCourrier}
                    onChange={(e) => setTypeCourrier(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all outline-none"
                    required
                  >
                    <option value="">Sélectionner un type</option>
                    {courriers.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Référence</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all outline-none"
                    placeholder="Ex: POL-AUTO-2025-001"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all outline-none resize-none"
                    placeholder="Description détaillée du document..."
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
                  disabled={!titre || !client || !risque || !typeCourrier}
                  className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Suivant
                  <Icon name="arrow-right" size="sm" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {etape === 3 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-lg p-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Vérification finale</h2>

              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Icon name="info" size="sm" />
                  Résumé du document
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Titre</p>
                    <p className="font-semibold text-gray-900">{titre}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Client</p>
                    <p className="font-semibold text-gray-900">{clients.find(c => c.id === client)?.nom}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Exercice</p>
                    <p className="font-semibold text-gray-900">{exercice}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Risque</p>
                    <p className="font-semibold text-gray-900">{risques.find(r => r.value === risque)?.label}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Type Courrier</p>
                    <p className="font-semibold text-gray-900">{courriers.find(c => c.value === typeCourrier)?.label}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Référence</p>
                    <p className="font-semibold text-gray-900">{reference || '-'}</p>
                  </div>
                </div>
                {description && (
                  <div className="mt-4">
                    <p className="text-gray-600 text-sm">Description</p>
                    <p className="text-gray-900">{description}</p>
                  </div>
                )}
              </div>

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
                  className="px-8 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors flex items-center gap-2"
                  disabled={chargement}
                >
                  <Icon name="arrow-left" size="sm" />
                  Retour
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={chargement}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2"
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
