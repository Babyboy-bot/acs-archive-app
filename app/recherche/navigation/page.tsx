'use client'

import { useState } from 'react'
import { Navigation } from '@/components/Navigation'
import { Bouton } from '@/components/ui/Bouton'
import Link from 'next/link'

export default function PageNavigationHierarchique() {
  const [niveauActuel, setNiveauActuel] = useState<'clients' | 'exercices' | 'risques' | 'documents'>('clients')
  const [clientSelectionne, setClientSelectionne] = useState<string | null>(null)
  const [exerciceSelectionne, setExerciceSelectionne] = useState<number | null>(null)
  const [risqueSelectionne, setRisqueSelectionne] = useState<string | null>(null)

  // Données simulées
  const clients = [
    { id: '1', nom: 'Entreprise ABC', type: 'ENTREPRISE', exercices: 3, documents: 45 },
    { id: '2', nom: 'SARL Transport CI', type: 'ENTREPRISE', exercices: 2, documents: 67 },
    { id: '3', nom: 'Société DELTA', type: 'ENTREPRISE', exercices: 4, documents: 123 },
    { id: '4', nom: 'Kouassi Jean', type: 'PARTICULIER', exercices: 1, documents: 12 },
  ]

  const exercices = [
    { id: '1', annee: 2025, statut: 'ACTIF', risques: 3, documents: 23 },
    { id: '2', annee: 2024, statut: 'ARCHIVE', risques: 4, documents: 15 },
    { id: '3', annee: 2023, statut: 'CLOTURE', risques: 2, documents: 7 },
  ]

  const risques = [
    { id: '1', type: 'AUTOMOBILE', numeroPolice: 'POL-AUTO-2025-001', documents: 12 },
    { id: '2', type: 'SANTE', numeroPolice: 'POL-SANTE-2025-002', documents: 8 },
    { id: '3', type: 'HABITATION', numeroPolice: 'POL-HAB-2025-003', documents: 3 },
  ]

  const documents = [
    { id: '1', titre: 'Police Automobile 2025', typeCourrier: 'ACS_VERS_CLIENT', date: '2025-11-01', taille: '2.4 MB' },
    { id: '2', titre: 'Cotation Compagnie XYZ', typeCourrier: 'ACS_VERS_COMPAGNIE', date: '2025-10-28', taille: '850 KB' },
    { id: '3', titre: 'Avenant contrat', typeCourrier: 'ACS_VERS_CLIENT', date: '2025-10-15', taille: '1.2 MB' },
  ]

  const risqueConfig: Record<string, { label: string; couleur: string; icon: string }> = {
    AUTOMOBILE: { label: 'Automobile', couleur: '#D32027', icon: '🚗' },
    SANTE: { label: 'Santé', couleur: '#10B981', icon: '🏥' },
    HABITATION: { label: 'Habitation', couleur: '#F59E0B', icon: '🏠' },
    VIE: { label: 'Vie', couleur: '#8B5CF6', icon: '❤️' },
    RESPONSABILITE_CIVILE: { label: 'RC', couleur: '#0066B3', icon: '🛡️' },
    AUTRE: { label: 'Autre', couleur: '#6B7280', icon: '📋' },
  }

  const statutConfig: Record<string, { label: string; couleur: string }> = {
    ACTIF: { label: 'Actif', couleur: '#10B981' },
    ARCHIVE: { label: 'Archivé', couleur: '#F59E0B' },
    CLOTURE: { label: 'Clôturé', couleur: '#6B7280' },
  }

  const selectionnerClient = (clientId: string) => {
    setClientSelectionne(clientId)
    setNiveauActuel('exercices')
  }

  const selectionnerExercice = (annee: number) => {
    setExerciceSelectionne(annee)
    setNiveauActuel('risques')
  }

  const selectionnerRisque = (risqueId: string) => {
    setRisqueSelectionne(risqueId)
    setNiveauActuel('documents')
  }

  const remonterNiveau = () => {
    if (niveauActuel === 'documents') {
      setRisqueSelectionne(null)
      setNiveauActuel('risques')
    } else if (niveauActuel === 'risques') {
      setExerciceSelectionne(null)
      setNiveauActuel('exercices')
    } else if (niveauActuel === 'exercices') {
      setClientSelectionne(null)
      setNiveauActuel('clients')
    }
  }

  const breadcrumb = []
  if (clientSelectionne) {
    const client = clients.find(c => c.id === clientSelectionne)
    breadcrumb.push({ label: client?.nom || '', niveau: 'clients' })
  }
  if (exerciceSelectionne) {
    breadcrumb.push({ label: String(exerciceSelectionne), niveau: 'exercices' })
  }
  if (risqueSelectionne) {
    const risque = risques.find(r => r.id === risqueSelectionne)
    breadcrumb.push({ label: risqueConfig[risque?.type || 'AUTRE'].label, niveau: 'risques' })
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#1F2937' }}>
              📂 Navigation Hiérarchique
            </h1>
            <p style={{ color: '#6B7280' }}>
              Parcourez vos documents par structure d'archivage
            </p>
          </div>
          <Link href="/recherche">
            <Bouton variante="secondaire">
              🔍 Recherche avancée
            </Bouton>
          </Link>
        </div>

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setClientSelectionne(null)
                  setExerciceSelectionne(null)
                  setRisqueSelectionne(null)
                  setNiveauActuel('clients')
                }}
                className="text-blue-600 hover:underline"
              >
                🏠 Accueil
              </button>
              {breadcrumb.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-gray-400">/</span>
                  <span className="font-medium" style={{ color: '#1F2937' }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bouton retour */}
        {niveauActuel !== 'clients' && (
          <div className="mb-6">
            <Bouton onClick={remonterNiveau} variante="secondaire">
              ← Retour au niveau précédent
            </Bouton>
          </div>
        )}

        {/* Niveau 1: Clients */}
        {niveauActuel === 'clients' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">1️⃣</span>
              <h2 className="text-2xl font-bold" style={{ color: '#1F2937' }}>
                Sélectionnez un Client
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => selectionnerClient(client.id)}
                  className="bg-white rounded-xl shadow-md p-6 text-left hover:shadow-xl transition-all border-l-4"
                  style={{ borderColor: '#D32027' }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl">
                      {client.type === 'ENTREPRISE' ? '🏢' : '👤'}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full" style={{ 
                      backgroundColor: client.type === 'ENTREPRISE' ? 'rgba(211, 32, 39, 0.1)' : 'rgba(0, 102, 179, 0.1)',
                      color: client.type === 'ENTREPRISE' ? '#D32027' : '#0066B3'
                    }}>
                      {client.type === 'ENTREPRISE' ? 'Entreprise' : 'Particulier'}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-2" style={{ color: '#1F2937' }}>
                    {client.nom}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>📅 {client.exercices} exercices</span>
                    <span>📄 {client.documents} docs</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Niveau 2: Exercices */}
        {niveauActuel === 'exercices' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">2️⃣</span>
              <h2 className="text-2xl font-bold" style={{ color: '#1F2937' }}>
                Sélectionnez un Exercice (Année)
              </h2>
            </div>
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {exercices.map((exercice) => (
                <button
                  key={exercice.id}
                  onClick={() => selectionnerExercice(exercice.annee)}
                  className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-xl transition-all border-t-4"
                  style={{ borderColor: '#0066B3' }}
                >
                  <div className="text-4xl mb-2">📅</div>
                  <h3 className="font-bold text-3xl mb-2" style={{ color: '#0066B3' }}>
                    {exercice.annee}
                  </h3>
                  <span 
                    className="inline-block px-3 py-1 rounded-full text-sm font-medium mb-3"
                    style={{ 
                      backgroundColor: `${statutConfig[exercice.statut].couleur}15`,
                      color: statutConfig[exercice.statut].couleur
                    }}
                  >
                    {statutConfig[exercice.statut].label}
                  </span>
                  <div className="text-sm text-gray-600">
                    <div>{exercice.risques} risques</div>
                    <div>{exercice.documents} documents</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Niveau 3: Risques */}
        {niveauActuel === 'risques' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">3️⃣</span>
              <h2 className="text-2xl font-bold" style={{ color: '#1F2937' }}>
                Sélectionnez un Type de Risque
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {risques.map((risque) => {
                const config = risqueConfig[risque.type]
                return (
                  <button
                    key={risque.id}
                    onClick={() => selectionnerRisque(risque.id)}
                    className="bg-white rounded-xl shadow-md p-6 text-left hover:shadow-xl transition-all border-l-4"
                    style={{ borderColor: config.couleur }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-4xl">{config.icon}</div>
                      <span 
                        className="px-3 py-1 rounded-full text-sm font-medium"
                        style={{ 
                          backgroundColor: `${config.couleur}15`,
                          color: config.couleur
                        }}
                      >
                        {risque.documents} docs
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-1" style={{ color: '#1F2937' }}>
                      {config.label}
                    </h3>
                    <p className="text-sm text-gray-600">N° {risque.numeroPolice}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Niveau 4: Documents */}
        {niveauActuel === 'documents' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">4️⃣</span>
              <h2 className="text-2xl font-bold" style={{ color: '#1F2937' }}>
                Documents
              </h2>
            </div>

            {/* Types de courrier */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* ACS → Client */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: '#D32027' }}>
                  <span>📧</span> Courrier ACS → Client
                </h3>
                <div className="space-y-3">
                  {documents.filter(d => d.typeCourrier === 'ACS_VERS_CLIENT').map((doc) => (
                    <div 
                      key={doc.id}
                      className="border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer"
                      style={{ borderColor: '#E5E7EB' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium mb-1" style={{ color: '#1F2937' }}>{doc.titre}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>📅 {doc.date}</span>
                            <span>📦 {doc.taille}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="p-2 hover:bg-gray-100 rounded" title="Voir">👁️</button>
                          <button className="p-2 hover:bg-gray-100 rounded" title="Télécharger">⬇️</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ACS → Compagnie */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: '#0066B3' }}>
                  <span>📨</span> Courrier ACS → Compagnie
                </h3>
                <div className="space-y-3">
                  {documents.filter(d => d.typeCourrier === 'ACS_VERS_COMPAGNIE').map((doc) => (
                    <div 
                      key={doc.id}
                      className="border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer"
                      style={{ borderColor: '#E5E7EB' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium mb-1" style={{ color: '#1F2937' }}>{doc.titre}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>📅 {doc.date}</span>
                            <span>📦 {doc.taille}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="p-2 hover:bg-gray-100 rounded" title="Voir">👁️</button>
                          <button className="p-2 hover:bg-gray-100 rounded" title="Télécharger">⬇️</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
