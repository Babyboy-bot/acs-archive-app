// Page du tableau de bord
'use client'

import { Navigation } from '@/components/Navigation'
import { Carte } from '@/components/ui/Carte'
import { Bouton } from '@/components/ui/Bouton'

export default function PageTableauDeBord() {
  // Données simulées - à remplacer par de vraies données de l'API
  const statistiques = {
    nombreDocuments: 1247,
    nouveauxCeMois: 89,
    espaceTotalUtilise: '2.4 GB',
    nombreUtilisateurs: 24,
  }

  const documentsRecents = [
    { id: 1, titre: 'Contrat Assurance Auto - CLIENT001', date: '2025-11-12', categorie: 'Contrats' },
    { id: 2, titre: 'Police Santé Entreprise', date: '2025-11-11', categorie: 'Polices' },
    { id: 3, titre: 'Déclaration Sinistre 2024-1156', date: '2025-11-10', categorie: 'Sinistres' },
    { id: 4, titre: 'Facture Mensuelle Octobre', date: '2025-11-09', categorie: 'Factures' },
  ]

  const activitesRecentes = [
    { utilisateur: 'Marie Kouassi', action: 'a téléversé', document: 'Contrat Auto CLIENT001', temps: 'Il y a 5 min' },
    { utilisateur: 'Jean Koné', action: 'a consulté', document: 'Police Santé Entreprise', temps: 'Il y a 15 min' },
    { utilisateur: 'Admin', action: 'a modifié', document: 'Catégorie Sinistres', temps: 'Il y a 1 heure' },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* En-tête ACS */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1F2937' }}>Tableau de bord</h1>
          <p style={{ color: '#6B7280' }}>Vue d'ensemble de votre système d'archivage</p>
        </div>

        {/* Statistiques ACS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderColor: '#D32027' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Documents</p>
                <p className="text-3xl font-bold" style={{ color: '#D32027' }}>{statistiques.nombreDocuments}</p>
                <p className="text-sm text-green-600 mt-1">+{statistiques.nouveauxCeMois} ce mois</p>
              </div>
              <div className="text-4xl">📁</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderColor: '#0066B3' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Espace utilisé</p>
                <p className="text-3xl font-bold" style={{ color: '#0066B3' }}>{statistiques.espaceTotalUtilise}</p>
                <p className="text-sm text-gray-500 mt-1">Sur 10 GB</p>
              </div>
              <div className="text-4xl">💾</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderColor: '#D32027' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Utilisateurs</p>
                <p className="text-3xl font-bold" style={{ color: '#D32027' }}>{statistiques.nombreUtilisateurs}</p>
                <p className="text-sm text-gray-500 mt-1">Actifs</p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderColor: '#0066B3' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Aujourd'hui</p>
                <p className="text-3xl font-bold" style={{ color: '#0066B3' }}>12</p>
                <p className="text-sm text-gray-500 mt-1">Téléversements</p>
              </div>
              <div className="text-4xl">📤</div>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions rapides</h2>
          <div className="flex flex-wrap gap-4">
            <Bouton variante="primaire">
              📤 Téléverser un document
            </Bouton>
            <Bouton variante="secondaire">
              🔍 Rechercher
            </Bouton>
            <Bouton variante="secondaire">
              📊 Voir les rapports
            </Bouton>
            <Bouton variante="secondaire">
              ⚙️ Paramètres
            </Bouton>
          </div>
        </div>

        {/* Documents récents et activités */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Documents récents */}
          <Carte titre="Documents récents">
            <div className="space-y-3">
              {documentsRecents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">📄</div>
                    <div>
                      <p className="font-medium text-gray-900">{doc.titre}</p>
                      <p className="text-sm text-gray-500">{doc.categorie} · {doc.date}</p>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <button className="font-medium text-sm hover:opacity-80 transition-opacity" style={{ color: '#D32027' }}>
                Voir tous les documents →
              </button>
            </div>
          </Carte>

          {/* Activités récentes */}
          <Carte titre="Activités récentes">
            <div className="space-y-4">
              {activitesRecentes.map((activite, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0" style={{ background: index % 2 === 0 ? '#D32027' : '#0066B3' }}>
                    {activite.utilisateur.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activite.utilisateur}</span>{' '}
                      <span className="text-gray-600">{activite.action}</span>{' '}
                      <span className="font-medium">{activite.document}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{activite.temps}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <button className="font-medium text-sm hover:opacity-80 transition-opacity" style={{ color: '#0066B3' }}>
                Voir le journal complet →
              </button>
            </div>
          </Carte>
        </div>
      </main>
    </div>
  )
}
