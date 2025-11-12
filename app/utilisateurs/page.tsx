'use client'

import { Navigation } from '@/components/Navigation'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function PageUtilisateurs() {
  const [recherche, setRecherche] = useState('')
  const [filtreRole, setFiltreRole] = useState('')
  const [afficherFormulaire, setAfficherFormulaire] = useState(false)

  const utilisateurs = [
    { id: 1, nom: 'Kassi', prenom: 'Elie Emmanuel', email: 'elie.kassi@acs.ci', role: 'ADMIN', estActif: true, dernierAcces: 'Il y a 5 min', avatar: 'EK', couleur: '#D32027' },
    { id: 2, nom: 'Assinyo', prenom: 'Rodrigue', email: 'rodrigue.assinyo@acs.ci', role: 'ADMIN', estActif: true, dernierAcces: 'Il y a 15 min', avatar: 'RA', couleur: '#0066B3' },
    { id: 3, nom: 'Kouassi', prenom: 'Marie', email: 'marie.kouassi@acs.ci', role: 'GESTIONNAIRE', estActif: true, dernierAcces: 'Il y a 1h', avatar: 'MK', couleur: '#10B981' },
    { id: 4, nom: 'Koné', prenom: 'Jean', email: 'jean.kone@acs.ci', role: 'EMPLOYE', estActif: true, dernierAcces: 'Il y a 2h', avatar: 'JK', couleur: '#F59E0B' },
    { id: 5, nom: 'Diallo', prenom: 'Fatou', email: 'fatou.diallo@acs.ci', role: 'EMPLOYE', estActif: false, dernierAcces: 'Il y a 3 jours', avatar: 'FD', couleur: '#8B5CF6' },
  ]

  const roles = [
    { value: '', label: 'Tous les rôles', couleur: '#6B7280' },
    { value: 'ADMIN', label: 'Administrateur', couleur: '#D32027' },
    { value: 'GESTIONNAIRE', label: 'Gestionnaire', couleur: '#0066B3' },
    { value: 'EMPLOYE', label: 'Employé', couleur: '#10B981' },
    { value: 'CONSULTANT', label: 'Consultant', couleur: '#F59E0B' },
  ]

  const utilisateursFiltres = utilisateurs.filter(user => {
    const matchRecherche = 
      user.nom.toLowerCase().includes(recherche.toLowerCase()) ||
      user.prenom.toLowerCase().includes(recherche.toLowerCase()) ||
      user.email.toLowerCase().includes(recherche.toLowerCase())
    const matchRole = !filtreRole || user.role === filtreRole
    return matchRecherche && matchRole
  })

  const getRoleInfo = (role: string) => roles.find(r => r.value === role) || roles[0]
  const stats = {
    total: utilisateurs.length,
    actifs: utilisateurs.filter(u => u.estActif).length,
    admins: utilisateurs.filter(u => u.role === 'ADMIN').length,
    gestionnaires: utilisateurs.filter(u => u.role === 'GESTIONNAIRE').length,
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                <Icon name="users" size="xl" className="text-red-600" />
                Utilisateurs
              </h1>
              <p className="text-gray-600">{utilisateursFiltres.length} utilisateur{utilisateursFiltres.length > 1 ? 's' : ''} • {stats.actifs} actif{stats.actifs > 1 ? 's' : ''}</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAfficherFormulaire(!afficherFormulaire)}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Icon name={afficherFormulaire ? 'close' : 'plus'} size="sm" />
              {afficherFormulaire ? 'Annuler' : 'Nouvel utilisateur'}
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg">
            <Icon name="star" size="lg" className="mb-2" />
            <p className="text-3xl font-bold">{stats.admins}</p>
            <p className="text-sm opacity-90">Administrateurs</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
            <Icon name="chart" size="lg" className="mb-2" />
            <p className="text-3xl font-bold">{stats.gestionnaires}</p>
            <p className="text-sm opacity-90">Gestionnaires</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
            <Icon name="check-circle" size="lg" className="mb-2" />
            <p className="text-3xl font-bold">{stats.actifs}</p>
            <p className="text-sm opacity-90">Actifs</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            <Icon name="users" size="lg" className="mb-2" />
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-sm opacity-90">Total</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher par nom, prénom, email..."
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Icon name="search" className="text-gray-400" />
              </div>
            </div>

            <select
              value={filtreRole}
              onChange={(e) => setFiltreRole(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {afficherFormulaire && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-gradient-to-br from-red-50 to-blue-50 rounded-2xl shadow-lg p-8 mb-8 border-2 border-red-200"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Icon name="plus" size="md" />
              Nouvel Utilisateur
            </h3>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input type="text" placeholder="Nom" className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none" />
              <input type="text" placeholder="Prénom" className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none" />
              <input type="email" placeholder="Email" className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none" />
              <select className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none">
                <option>Sélectionner un rôle</option>
                {roles.slice(1).map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
              </select>
              <div className="md:col-span-2 flex gap-4">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg flex items-center gap-2">
                  <Icon name="check" size="sm" />
                  Créer
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button" onClick={() => setAfficherFormulaire(false)} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors">
                  Annuler
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {utilisateursFiltres.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden group"
            >
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0"
                    style={{ backgroundColor: user.couleur }}
                  >
                    {user.avatar}
                  </motion.div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg text-gray-900 group-hover:text-red-600 transition-colors">
                        {user.prenom} {user.nom}
                      </h3>
                      {user.estActif ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                          <Icon name="check" size="xs" />
                          Actif
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                          Inactif
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                      <Icon name="at" size="xs" />
                      {user.email}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: getRoleInfo(user.role).couleur }}
                      >
                        {getRoleInfo(user.role).label}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Icon name="clock" size="xs" />
                        {user.dernierAcces}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-100">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1">
                    <Icon name="eye" size="sm" />
                    Profil
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1">
                    <Icon name="edit" size="sm" />
                    Modifier
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1 ${
                    user.estActif ? 'bg-orange-100 hover:bg-orange-200 text-orange-700' : 'bg-green-100 hover:bg-green-200 text-green-700'
                  }`}>
                    <Icon name={user.estActif ? 'close' : 'check'} size="sm" />
                    {user.estActif ? 'Désactiver' : 'Activer'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {utilisateursFiltres.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-white rounded-2xl shadow-lg"
          >
            <Icon name="users" size="xl" className="mx-auto mb-4 text-gray-400" />
            <p className="text-xl font-semibold text-gray-700 mb-2">Aucun utilisateur trouvé</p>
            <p className="text-gray-500">Modifiez vos filtres ou ajoutez un nouvel utilisateur</p>
          </motion.div>
        )}
      </main>
    </div>
  )
}
