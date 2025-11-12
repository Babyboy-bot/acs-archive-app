'use client'

import { useState } from 'react'
import { Navigation } from '@/components/Navigation'
import { Bouton } from '@/components/ui/Bouton'
import Link from 'next/link'

export default function PageDocuments() {
  const [recherche, setRecherche] = useState('')
  const [categorieFiltre, setCategorieFiltre] = useState('tous')

  // Données simulées
  const documents = [
    { id: 1, titre: 'Contrat Assurance Auto - CLIENT001', categorie: 'Contrats', date: '2025-11-12', taille: '2.4 MB', auteur: 'Marie Kouassi' },
    { id: 2, titre: 'Police Santé Entreprise XYZ', categorie: 'Polices', date: '2025-11-11', taille: '1.8 MB', auteur: 'Jean Koné' },
    { id: 3, titre: 'Déclaration Sinistre 2024-1156', categorie: 'Sinistres', date: '2025-11-10', taille: '850 KB', auteur: 'Admin' },
    { id: 4, titre: 'Facture Mensuelle Octobre 2025', categorie: 'Factures', date: '2025-11-09', taille: '450 KB', auteur: 'Comptabilité' },
    { id: 5, titre: 'Rapport Annuel 2024', categorie: 'Rapports', date: '2025-11-08', taille: '5.2 MB', auteur: 'Direction' },
    { id: 6, titre: 'Convention Client ABC', categorie: 'Contrats', date: '2025-11-07', taille: '1.2 MB', auteur: 'Marie Kouassi' },
  ]

  const categories = ['tous', 'Contrats', 'Polices', 'Sinistres', 'Factures', 'Rapports']

  const documentsFiltres = documents.filter(doc => {
    const matchRecherche = doc.titre.toLowerCase().includes(recherche.toLowerCase())
    const matchCategorie = categorieFiltre === 'tous' || doc.categorie === categorieFiltre
    return matchRecherche && matchCategorie
  })

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#1F2937' }}>Documents</h1>
            <p style={{ color: '#6B7280' }}>Gérez tous vos documents d'assurance</p>
          </div>
          <Link href="/documents/nouveau">
            <Bouton variante="primaire">
              📤 Téléverser
            </Bouton>
          </Link>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Recherche */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Rechercher
              </label>
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Nom du document, client..."
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{ borderColor: '#D1D5DB' }}
              />
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Catégorie
              </label>
              <select
                value={categorieFiltre}
                onChange={(e) => setCategorieFiltre(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{ borderColor: '#D1D5DB' }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'tous' ? 'Toutes les catégories' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4" style={{ borderColor: '#D32027' }}>
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold" style={{ color: '#D32027' }}>{documents.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4" style={{ borderColor: '#0066B3' }}>
            <p className="text-sm text-gray-600">Ce mois</p>
            <p className="text-2xl font-bold" style={{ color: '#0066B3' }}>6</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4" style={{ borderColor: '#D32027' }}>
            <p className="text-sm text-gray-600">Espace</p>
            <p className="text-2xl font-bold" style={{ color: '#D32027' }}>12 MB</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4" style={{ borderColor: '#0066B3' }}>
            <p className="text-sm text-gray-600">Catégories</p>
            <p className="text-2xl font-bold" style={{ color: '#0066B3' }}>{categories.length - 1}</p>
          </div>
        </div>

        {/* Liste des documents */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: '#F9FAFB' }}>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Document</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Catégorie</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Taille</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Auteur</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#E5E7EB' }}>
                {documentsFiltres.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">📄</div>
                        <div>
                          <p className="font-medium" style={{ color: '#1F2937' }}>{doc.titre}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ 
                        backgroundColor: doc.categorie === 'Contrats' ? 'rgba(211, 32, 39, 0.1)' : 'rgba(0, 102, 179, 0.1)',
                        color: doc.categorie === 'Contrats' ? '#D32027' : '#0066B3'
                      }}>
                        {doc.categorie}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{doc.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{doc.taille}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{doc.auteur}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Voir">
                          👁️
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Télécharger">
                          ⬇️
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Supprimer">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Message si aucun résultat */}
          {documentsFiltres.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Aucun document trouvé</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
