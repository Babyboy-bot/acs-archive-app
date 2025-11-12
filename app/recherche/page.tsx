'use client'

import { useState } from 'react'
import { Navigation } from '@/components/Navigation'
import { Bouton } from '@/components/ui/Bouton'
import { ChampTexte } from '@/components/ui/ChampTexte'
import Link from 'next/link'

export default function PageRecherche() {
  const [client, setClient] = useState('')
  const [exercice, setExercice] = useState('')
  const [risque, setRisque] = useState('')
  const [typeCourrier, setTypeCourrier] = useState('')
  const [motCle, setMotCle] = useState('')
  const [afficherResultats, setAfficherResultats] = useState(false)

  const typesRisque = [
    { value: '', label: 'Tous les risques' },
    { value: 'AUTOMOBILE', label: 'Automobile' },
    { value: 'SANTE', label: 'Santé' },
    { value: 'HABITATION', label: 'Habitation' },
    { value: 'VIE', label: 'Vie' },
    { value: 'RESPONSABILITE_CIVILE', label: 'Responsabilité Civile' },
    { value: 'AUTRE', label: 'Autre' },
  ]

  const typesCourrier = [
    { value: '', label: 'Tous les courriers' },
    { value: 'ACS_VERS_CLIENT', label: 'ACS → Client' },
    { value: 'ACS_VERS_COMPAGNIE', label: 'ACS → Compagnie' },
  ]

  // Données simulées
  const resultats = [
    {
      id: 1,
      client: 'Entreprise ABC',
      exercice: 2025,
      risque: 'AUTOMOBILE',
      typeCourrier: 'ACS_VERS_CLIENT',
      titre: 'Police Auto - Contrat 2025',
      reference: 'POL-AUTO-2025-001',
      date: '2025-11-01',
      chemin: 'ABC / 2025 / Automobile / ACS→Client',
    },
    {
      id: 2,
      client: 'Entreprise ABC',
      exercice: 2025,
      risque: 'AUTOMOBILE',
      typeCourrier: 'ACS_VERS_COMPAGNIE',
      titre: 'Demande cotation - Compagnie XYZ',
      reference: 'COT-AUTO-2025-012',
      date: '2025-10-28',
      chemin: 'ABC / 2025 / Automobile / ACS→Compagnie',
    },
    {
      id: 3,
      client: 'Entreprise ABC',
      exercice: 2025,
      risque: 'SANTE',
      typeCourrier: 'ACS_VERS_CLIENT',
      titre: 'Attestation santé collective',
      reference: 'ATT-SANTE-2025-045',
      date: '2025-11-10',
      chemin: 'ABC / 2025 / Santé / ACS→Client',
    },
    {
      id: 4,
      client: 'SARL Transport CI',
      exercice: 2024,
      risque: 'AUTOMOBILE',
      typeCourrier: 'ACS_VERS_CLIENT',
      titre: 'Avenant contrat flotte',
      reference: 'AVE-AUTO-2024-089',
      date: '2024-12-15',
      chemin: 'SARL Transport CI / 2024 / Automobile / ACS→Client',
    },
  ]

  const gererRecherche = (e: React.FormEvent) => {
    e.preventDefault()
    setAfficherResultats(true)
  }

  const reinitialiser = () => {
    setClient('')
    setExercice('')
    setRisque('')
    setTypeCourrier('')
    setMotCle('')
    setAfficherResultats(false)
  }

  const risqueLabels: Record<string, { label: string; couleur: string; icon: string }> = {
    AUTOMOBILE: { label: 'Automobile', couleur: '#D32027', icon: '🚗' },
    SANTE: { label: 'Santé', couleur: '#10B981', icon: '🏥' },
    HABITATION: { label: 'Habitation', couleur: '#F59E0B', icon: '🏠' },
    VIE: { label: 'Vie', couleur: '#8B5CF6', icon: '❤️' },
    RESPONSABILITE_CIVILE: { label: 'RC', couleur: '#0066B3', icon: '🛡️' },
    AUTRE: { label: 'Autre', couleur: '#6B7280', icon: '📋' },
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1F2937' }}>
            🔍 Recherche de Documents
          </h1>
          <p style={{ color: '#6B7280' }}>
            Trouvez rapidement vos documents par Client → Exercice → Risque
          </p>
        </div>

        {/* Formulaire de recherche */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-6">
          <h2 className="text-xl font-bold mb-6" style={{ color: '#1F2937' }}>
            Critères de recherche
          </h2>

          <form onSubmit={gererRecherche} className="space-y-6">
            {/* Niveau 1: Client */}
            <div className="border-l-4 pl-4" style={{ borderColor: '#D32027' }}>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                <span className="text-lg">1️⃣</span> Client
              </label>
              <ChampTexte
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Nom du client..."
              />
            </div>

            {/* Niveau 2: Exercice */}
            <div className="border-l-4 pl-4" style={{ borderColor: '#0066B3' }}>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                <span className="text-lg">2️⃣</span> Exercice (Année)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[2025, 2024, 2023, 2022].map((annee) => (
                  <button
                    key={annee}
                    type="button"
                    onClick={() => setExercice(String(annee))}
                    className="py-2 px-4 rounded-lg font-medium transition-all"
                    style={{
                      backgroundColor: exercice === String(annee) ? '#0066B3' : '#F3F4F6',
                      color: exercice === String(annee) ? 'white' : '#374151',
                      border: exercice === String(annee) ? 'none' : '1px solid #E5E7EB',
                    }}
                  >
                    {annee}
                  </button>
                ))}
              </div>
            </div>

            {/* Niveau 3: Risque */}
            <div className="border-l-4 pl-4" style={{ borderColor: '#D32027' }}>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                <span className="text-lg">3️⃣</span> Type de Risque
              </label>
              <select
                value={risque}
                onChange={(e) => setRisque(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{ borderColor: '#D1D5DB' }}
              >
                {typesRisque.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Niveau 4: Type Courrier */}
            <div className="border-l-4 pl-4" style={{ borderColor: '#0066B3' }}>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                <span className="text-lg">4️⃣</span> Type de Courrier
              </label>
              <div className="grid md:grid-cols-2 gap-4">
                {typesCourrier.slice(1).map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setTypeCourrier(type.value)}
                    className="py-3 px-4 rounded-lg font-medium transition-all text-left"
                    style={{
                      backgroundColor: typeCourrier === type.value ? '#0066B3' : '#F3F4F6',
                      color: typeCourrier === type.value ? 'white' : '#374151',
                      border: typeCourrier === type.value ? 'none' : '1px solid #E5E7EB',
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mot-clé supplémentaire */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                🔎 Mot-clé supplémentaire (optionnel)
              </label>
              <ChampTexte
                value={motCle}
                onChange={(e) => setMotCle(e.target.value)}
                placeholder="Référence, titre du document..."
              />
            </div>

            {/* Boutons */}
            <div className="flex gap-4">
              <Bouton type="submit" variante="primaire" className="flex-1">
                Rechercher
              </Bouton>
              <Bouton type="button" variante="secondaire" onClick={reinitialiser}>
                Réinitialiser
              </Bouton>
            </div>
          </form>
        </div>

        {/* Résultats */}
        {afficherResultats && (
          <div className="bg-white rounded-xl shadow-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#1F2937' }}>
                📁 Résultats ({resultats.length} document{resultats.length > 1 ? 's' : ''})
              </h2>
              <Link href="/recherche/navigation">
                <Bouton variante="secondaire">
                  📂 Vue hiérarchique
                </Bouton>
              </Link>
            </div>

            <div className="space-y-4">
              {resultats.map((doc) => (
                <div
                  key={doc.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Chemin */}
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <span>📁</span>
                        <span>{doc.chemin}</span>
                      </div>

                      {/* Titre */}
                      <h3 className="font-bold text-lg mb-1" style={{ color: '#1F2937' }}>
                        {doc.titre}
                      </h3>

                      {/* Infos */}
                      <div className="flex items-center gap-4 text-sm">
                        <span 
                          className="px-3 py-1 rounded-full font-medium"
                          style={{ 
                            backgroundColor: `${risqueLabels[doc.risque].couleur}15`,
                            color: risqueLabels[doc.risque].couleur
                          }}
                        >
                          {risqueLabels[doc.risque].icon} {risqueLabels[doc.risque].label}
                        </span>
                        <span className="text-gray-600">Réf: {doc.reference}</span>
                        <span className="text-gray-600">📅 {doc.date}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Voir">
                        👁️
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Télécharger">
                        ⬇️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message vide */}
        {!afficherResultats && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-600 mb-2">Utilisez les critères ci-dessus pour rechercher</p>
            <p className="text-sm text-gray-500">Navigation: Client → Exercice → Risque → Documents</p>
          </div>
        )}
      </main>
    </div>
  )
}
