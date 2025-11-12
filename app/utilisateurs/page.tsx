'use client'

import { useState } from 'react'
import { Navigation } from '@/components/Navigation'
import { Bouton } from '@/components/ui/Bouton'
import { ChampTexte } from '@/components/ui/ChampTexte'
import { RoleUtilisateur } from '@/types'

export default function PageUtilisateurs() {
  const [afficherFormulaire, setAfficherFormulaire] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [filtreRole, setFiltreRole] = useState<string>('tous')

  // Formulaire
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<RoleUtilisateur>(RoleUtilisateur.EMPLOYE)

  // Données simulées
  const utilisateurs = [
    { 
      id: 1, 
      nom: 'Koné', 
      prenom: 'Jean', 
      email: 'jean.kone@acs.ci', 
      role: RoleUtilisateur.ADMIN, 
      estActif: true,
      derniereConnexion: '2025-11-12 10:30',
      documentsTelechargés: 45
    },
    { 
      id: 2, 
      nom: 'Kouassi', 
      prenom: 'Marie', 
      email: 'marie.kouassi@acs.ci', 
      role: RoleUtilisateur.GESTIONNAIRE, 
      estActif: true,
      derniereConnexion: '2025-11-12 09:15',
      documentsTelechargés: 123
    },
    { 
      id: 3, 
      nom: 'Traoré', 
      prenom: 'Ibrahim', 
      email: 'ibrahim.traore@acs.ci', 
      role: RoleUtilisateur.EMPLOYE, 
      estActif: true,
      derniereConnexion: '2025-11-11 16:45',
      documentsTelechargés: 67
    },
    { 
      id: 4, 
      nom: 'Yao', 
      prenom: 'Christelle', 
      email: 'christelle.yao@acs.ci', 
      role: RoleUtilisateur.EMPLOYE, 
      estActif: true,
      derniereConnexion: '2025-11-12 08:00',
      documentsTelechargés: 34
    },
    { 
      id: 5, 
      nom: 'Diallo', 
      prenom: 'Amadou', 
      email: 'amadou.diallo@consultant.ci', 
      role: RoleUtilisateur.CONSULTANT, 
      estActif: false,
      derniereConnexion: '2025-10-15 14:20',
      documentsTelechargés: 12
    },
  ]

  const roleLabels = {
    [RoleUtilisateur.ADMIN]: { label: 'Administrateur', couleur: '#D32027' },
    [RoleUtilisateur.GESTIONNAIRE]: { label: 'Gestionnaire', couleur: '#0066B3' },
    [RoleUtilisateur.EMPLOYE]: { label: 'Employé', couleur: '#10B981' },
    [RoleUtilisateur.CONSULTANT]: { label: 'Consultant', couleur: '#F59E0B' },
  }

  const utilisateursFiltres = utilisateurs.filter(user => {
    const matchRecherche = 
      user.nom.toLowerCase().includes(recherche.toLowerCase()) ||
      user.prenom.toLowerCase().includes(recherche.toLowerCase()) ||
      user.email.toLowerCase().includes(recherche.toLowerCase())
    const matchRole = filtreRole === 'tous' || user.role === filtreRole
    return matchRecherche && matchRole
  })

  const gererSoumission = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implémenter l'ajout d'utilisateur
    console.log({ nom, prenom, email, role })
    setAfficherFormulaire(false)
    // Reset form
    setNom('')
    setPrenom('')
    setEmail('')
    setRole(RoleUtilisateur.EMPLOYE)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#1F2937' }}>Utilisateurs</h1>
            <p style={{ color: '#6B7280' }}>Gérez les accès et permissions</p>
          </div>
          <Bouton 
            variante="primaire"
            onClick={() => setAfficherFormulaire(!afficherFormulaire)}
          >
            {afficherFormulaire ? '✕ Annuler' : '👤 Nouvel utilisateur'}
          </Bouton>
        </div>

        {/* Formulaire d'ajout */}
        {afficherFormulaire && (
          <div className="bg-white rounded-xl shadow-md p-8 mb-6">
            <h2 className="text-xl font-bold mb-6" style={{ color: '#1F2937' }}>
              Nouvel utilisateur
            </h2>
            <form onSubmit={gererSoumission} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <ChampTexte
                  etiquette="Nom"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex: Koné"
                  obligatoire
                />
                <ChampTexte
                  etiquette="Prénom"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Ex: Jean"
                  obligatoire
                />
              </div>

              <ChampTexte
                etiquette="Adresse email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@acs.ci"
                obligatoire
              />

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Rôle <span style={{ color: '#D32027' }}>*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleUtilisateur)}
                  required
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{ borderColor: '#D1D5DB' }}
                >
                  {Object.entries(roleLabels).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  <strong>Admin:</strong> Accès complet • <strong>Gestionnaire:</strong> Gestion documents • 
                  <strong>Employé:</strong> Consultation • <strong>Consultant:</strong> Accès limité
                </p>
              </div>

              <div className="flex gap-4">
                <Bouton type="submit" variante="primaire" className="flex-1">
                  Créer l'utilisateur
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

        {/* Filtres */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <ChampTexte
              etiquette="Rechercher"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, prénom ou email..."
            />
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Filtrer par rôle
              </label>
              <select
                value={filtreRole}
                onChange={(e) => setFiltreRole(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{ borderColor: '#D1D5DB' }}
              >
                <option value="tous">Tous les rôles</option>
                {Object.entries(roleLabels).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4" style={{ borderColor: '#D32027' }}>
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold" style={{ color: '#D32027' }}>{utilisateurs.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4" style={{ borderColor: '#10B981' }}>
            <p className="text-sm text-gray-600">Actifs</p>
            <p className="text-2xl font-bold" style={{ color: '#10B981' }}>
              {utilisateurs.filter(u => u.estActif).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4" style={{ borderColor: '#0066B3' }}>
            <p className="text-sm text-gray-600">Gestionnaires</p>
            <p className="text-2xl font-bold" style={{ color: '#0066B3' }}>
              {utilisateurs.filter(u => u.role === RoleUtilisateur.GESTIONNAIRE).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4" style={{ borderColor: '#F59E0B' }}>
            <p className="text-sm text-gray-600">Consultants</p>
            <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
              {utilisateurs.filter(u => u.role === RoleUtilisateur.CONSULTANT).length}
            </p>
          </div>
        </div>

        {/* Liste des utilisateurs */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: '#F9FAFB' }}>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Utilisateur</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Rôle</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Statut</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Dernière connexion</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#E5E7EB' }}>
                {utilisateursFiltres.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: roleLabels[user.role].couleur }}
                        >
                          {user.prenom[0]}{user.nom[0]}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: '#1F2937' }}>
                            {user.prenom} {user.nom}
                          </p>
                          <p className="text-xs text-gray-500">{user.documentsTelechargés} documents</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <span 
                        className="px-3 py-1 rounded-full text-sm font-medium"
                        style={{ 
                          backgroundColor: `${roleLabels[user.role].couleur}15`,
                          color: roleLabels[user.role].couleur 
                        }}
                      >
                        {roleLabels[user.role].label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span 
                        className="px-3 py-1 rounded-full text-sm font-medium"
                        style={{ 
                          backgroundColor: user.estActif ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: user.estActif ? '#10B981' : '#EF4444'
                        }}
                      >
                        {user.estActif ? '✓ Actif' : '✕ Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.derniereConnexion}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Modifier">
                          ✏️
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title={user.estActif ? 'Désactiver' : 'Activer'}>
                          {user.estActif ? '🔒' : '🔓'}
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

          {utilisateursFiltres.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Aucun utilisateur trouvé</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
