'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { Bouton } from '@/components/ui/Bouton'
import { ChampTexte } from '@/components/ui/ChampTexte'
import { ZoneTexte } from '@/components/ui/ZoneTexte'
import { Alerte } from '@/components/ui/Alerte'

export default function PageNouveauDocument() {
  const router = useRouter()
  const [titre, setTitre] = useState('')
  const [categorie, setCategorie] = useState('')
  const [description, setDescription] = useState('')
  const [etiquettes, setEtiquettes] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState(false)

  const categories = ['Contrats', 'Polices', 'Sinistres', 'Factures', 'Rapports', 'Autres']

  const gererFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFichier(e.target.files[0])
    }
  }

  const gererSoumission = async (e: React.FormEvent) => {
    e.preventDefault()
    setChargement(true)

    // TODO: Implémenter l'upload réel
    setTimeout(() => {
      setChargement(false)
      setSucces(true)
      
      // Redirection après 2 secondes
      setTimeout(() => {
        router.push('/documents')
      }, 2000)
    }, 1500)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1F2937' }}>Nouveau Document</h1>
          <p style={{ color: '#6B7280' }}>Téléversez un nouveau document dans l'archive</p>
        </div>

        <div className="max-w-3xl mx-auto">
          {succes && (
            <div className="mb-6">
              <Alerte 
                type="succes" 
                message="Document téléversé avec succès ! Redirection..." 
              />
            </div>
          )}

          <div className="bg-white rounded-xl shadow-md p-8">
            <form onSubmit={gererSoumission} className="space-y-6">
              {/* Zone de dépôt de fichier */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Fichier <span style={{ color: '#D32027' }}>*</span>
                </label>
                <div 
                  className="border-2 border-dashed rounded-xl p-8 text-center transition-all hover:border-opacity-100 cursor-pointer"
                  style={{ 
                    borderColor: fichier ? '#0066B3' : '#D1D5DB',
                    backgroundColor: fichier ? 'rgba(0, 102, 179, 0.05)' : '#F9FAFB'
                  }}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  {fichier ? (
                    <div>
                      <div className="text-5xl mb-3">📄</div>
                      <p className="font-medium" style={{ color: '#0066B3' }}>{fichier.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {(fichier.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFichier(null)
                        }}
                        className="mt-3 text-sm hover:opacity-80"
                        style={{ color: '#D32027' }}
                      >
                        Supprimer
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-5xl mb-3">📁</div>
                      <p className="font-medium mb-2" style={{ color: '#374151' }}>
                        Cliquez pour sélectionner un fichier
                      </p>
                      <p className="text-sm text-gray-500">
                        ou glissez-déposez ici
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        PDF, Word, Excel, Images (Max 10 MB)
                      </p>
                    </div>
                  )}
                </div>
                <input
                  id="file-input"
                  type="file"
                  onChange={gererFichier}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                />
              </div>

              {/* Titre */}
              <ChampTexte
                etiquette="Titre du document"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex: Contrat Assurance Auto - CLIENT001"
                obligatoire
              />

              {/* Catégorie */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Catégorie <span style={{ color: '#D32027' }}>*</span>
                </label>
                <select
                  value={categorie}
                  onChange={(e) => setCategorie(e.target.value)}
                  required
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{ borderColor: '#D1D5DB' }}
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <ZoneTexte
                etiquette="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez brièvement le contenu du document..."
                rows={4}
              />

              {/* Étiquettes */}
              <ChampTexte
                etiquette="Étiquettes"
                value={etiquettes}
                onChange={(e) => setEtiquettes(e.target.value)}
                placeholder="Ex: urgent, client-vip, 2025"
              />
              <p className="text-xs text-gray-500 -mt-4">
                Séparez les étiquettes par des virgules
              </p>

              {/* Boutons */}
              <div className="flex items-center gap-4 pt-4">
                <Bouton
                  type="submit"
                  variante="primaire"
                  taille="grand"
                  chargement={chargement}
                  disabled={!fichier || !titre || !categorie}
                  className="flex-1"
                >
                  {chargement ? 'Téléversement...' : 'Téléverser le document'}
                </Bouton>
                <Bouton
                  type="button"
                  variante="secondaire"
                  taille="grand"
                  onClick={() => router.back()}
                  disabled={chargement}
                >
                  Annuler
                </Bouton>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
