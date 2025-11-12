'use client'

import { useState } from 'react'
import { Navigation } from '@/components/Navigation'
import { Bouton } from '@/components/ui/Bouton'
import { ChampTexte } from '@/components/ui/ChampTexte'
import { ZoneTexte } from '@/components/ui/ZoneTexte'

export default function PageCategories() {
  const [afficherFormulaire, setAfficherFormulaire] = useState(false)
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [couleur, setCouleur] = useState('#D32027')

  // Données simulées
  const categories = [
    { id: 1, nom: 'Contrats', description: 'Contrats d\'assurance clients', couleur: '#D32027', documents: 156, derniereModif: '2025-11-12' },
    { id: 2, nom: 'Polices', description: 'Polices d\'assurance', couleur: '#0066B3', documents: 89, derniereModif: '2025-11-11' },
    { id: 3, nom: 'Sinistres', description: 'Déclarations de sinistres', couleur: '#D32027', documents: 234, derniereModif: '2025-11-10' },
    { id: 4, nom: 'Factures', description: 'Factures et paiements', couleur: '#0066B3', documents: 445, derniereModif: '2025-11-09' },
    { id: 5, nom: 'Rapports', description: 'Rapports mensuels et annuels', couleur: '#D32027', documents: 67, derniereModif: '2025-11-08' },
    { id: 6, nom: 'Juridique', description: 'Documents légaux', couleur: '#0066B3', documents: 23, derniereModif: '2025-11-07' },
  ]

  const gererSoumission = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implémenter l'ajout de catégorie
    console.log({ nom, description, couleur })
    setAfficherFormulaire(false)
    setNom('')
    setDescription('')
    setCouleur('#D32027')
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#1F2937' }}>Catégories</h1>
            <p style={{ color: '#6B7280' }}>Organisez vos documents par catégories</p>
          </div>
          <Bouton 
            variante="primaire"
            onClick={() => setAfficherFormulaire(!afficherFormulaire)}
          >
            {afficherFormulaire ? '✕ Annuler' : '➕ Nouvelle catégorie'}
          </Bouton>
        </div>

        {/* Formulaire d'ajout */}
        {afficherFormulaire && (
          <div className="bg-white rounded-xl shadow-md p-8 mb-6">
            <h2 className="text-xl font-bold mb-6" style={{ color: '#1F2937' }}>
              Nouvelle catégorie
            </h2>
            <form onSubmit={gererSoumission} className="space-y-6">
              <ChampTexte
                etiquette="Nom de la catégorie"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: Documents RH"
                obligatoire
              />

              <ZoneTexte
                etiquette="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez l'usage de cette catégorie..."
                rows={3}
              />

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Couleur <span style={{ color: '#D32027' }}>*</span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={couleur}
                    onChange={(e) => setCouleur(e.target.value)}
                    className="w-16 h-12 rounded-lg cursor-pointer border-2"
                    style={{ borderColor: '#D1D5DB' }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCouleur('#D32027')}
                      className="w-12 h-12 rounded-lg border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: '#D32027', borderColor: couleur === '#D32027' ? '#1F2937' : '#E5E7EB' }}
                      title="Rouge ACS"
                    />
                    <button
                      type="button"
                      onClick={() => setCouleur('#0066B3')}
                      className="w-12 h-12 rounded-lg border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: '#0066B3', borderColor: couleur === '#0066B3' ? '#1F2937' : '#E5E7EB' }}
                      title="Bleu ACS"
                    />
                    <button
                      type="button"
                      onClick={() => setCouleur('#10B981')}
                      className="w-12 h-12 rounded-lg border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: '#10B981', borderColor: couleur === '#10B981' ? '#1F2937' : '#E5E7EB' }}
                      title="Vert"
                    />
                    <button
                      type="button"
                      onClick={() => setCouleur('#F59E0B')}
                      className="w-12 h-12 rounded-lg border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: '#F59E0B', borderColor: couleur === '#F59E0B' ? '#1F2937' : '#E5E7EB' }}
                      title="Orange"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Bouton type="submit" variante="primaire" className="flex-1">
                  Créer la catégorie
                </Bouton>
                <Bouton 
                  type="button" 
                  variante="secondaire"
                  onClick={() => setAfficherFormulaire(false)}
                >
                  Annuler
                </Bouton>
              </div>
            </form>
          </div>
        )}

        {/* Grille des catégories */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((categorie) => (
            <div 
              key={categorie.id}
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all border-t-4"
              style={{ borderColor: categorie.couleur }}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1" style={{ color: '#1F2937' }}>
                      {categorie.nom}
                    </h3>
                    <p className="text-sm text-gray-600">{categorie.description}</p>
                  </div>
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-bold"
                    style={{ backgroundColor: categorie.couleur }}
                  >
                    {categorie.nom[0]}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-2xl font-bold" style={{ color: categorie.couleur }}>
                      {categorie.documents}
                    </p>
                    <p className="text-xs text-gray-600">Documents</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-800">
                      {categorie.derniereModif}
                    </p>
                    <p className="text-xs text-gray-600">Dernière activité</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    className="flex-1 py-2 px-4 rounded-lg font-medium transition-all hover:opacity-80"
                    style={{ 
                      backgroundColor: `${categorie.couleur}15`,
                      color: categorie.couleur 
                    }}
                  >
                    📄 Voir documents
                  </button>
                  <button 
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Modifier"
                  >
                    ✏️
                  </button>
                  <button 
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats en bas */}
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold mb-4" style={{ color: '#1F2937' }}>
            Statistiques
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ color: '#D32027' }}>{categories.length}</p>
              <p className="text-sm text-gray-600">Catégories</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ color: '#0066B3' }}>
                {categories.reduce((sum, cat) => sum + cat.documents, 0)}
              </p>
              <p className="text-sm text-gray-600">Total documents</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ color: '#D32027' }}>
                {Math.round(categories.reduce((sum, cat) => sum + cat.documents, 0) / categories.length)}
              </p>
              <p className="text-sm text-gray-600">Moyenne/catégorie</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ color: '#0066B3' }}>
                {Math.max(...categories.map(c => c.documents))}
              </p>
              <p className="text-sm text-gray-600">Plus grande catégorie</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
