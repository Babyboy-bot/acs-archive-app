'use client'

import { Navigation } from '@/components/Navigation'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function PageParametres() {
  const [ongletActif, setOngletActif] = useState('profil')
  
  // Profil
  const [nom, setNom] = useState('Kassi')
  const [prenom, setPrenom] = useState('Elie Emmanuel')
  const [email, setEmail] = useState('elie.kassi@acs.ci')
  const [telephone, setTelephone] = useState('+225 07 00 00 00 00')

  // Mot de passe
  const [ancienMdp, setAncienMdp] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmMdp, setConfirmMdp] = useState('')

  // Notifications
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [nouveauxDocs, setNouveauxDocs] = useState(true)
  const [modifications, setModifications] = useState(true)
  const [rapports, setRapports] = useState(false)

  // Apparence
  const [theme, setTheme] = useState('clair')
  const [langue, setLangue] = useState('fr')

  const onglets = [
    { id: 'profil', label: 'Profil', icon: '👤' },
    { id: 'securite', label: 'Sécurité', icon: '🔒' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'apparence', label: 'Apparence', icon: '🎨' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent mb-2">
            ⚙️ Paramètres
          </h1>
          <p className="text-gray-600">Gérez votre profil et vos préférences</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Menu onglets - Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="bg-white rounded-2xl shadow-lg p-4 sticky top-8">
              <div className="space-y-2">
                {onglets.map((onglet) => (
                  <motion.button
                    key={onglet.id}
                    whileHover={{ x: 5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setOngletActif(onglet.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                      ongletActif === onglet.id
                        ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-xl">{onglet.icon}</span>
                    {onglet.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Contenu */}
          <div className="lg:col-span-3">
            {/* Profil */}
            {ongletActif === 'profil' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg p-8"
              >
                <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-200">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl"
                    style={{ background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' }}
                  >
                    {prenom[0]}{nom[0]}
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{prenom} {nom}</h2>
                    <p className="text-gray-600">{email}</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full">
                      👑 Administrateur
                    </span>
                  </div>
                </div>

                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Nom</label>
                      <input
                        type="text"
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Prénom</label>
                      <input
                        type="text"
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all outline-none"
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    ✅ Enregistrer les modifications
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* Sécurité */}
            {ongletActif === 'securite' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <span>🔒</span> Changer le mot de passe
                  </h3>

                  <form className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Mot de passe actuel</label>
                      <input
                        type="password"
                        value={ancienMdp}
                        onChange={(e) => setAncienMdp(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                        placeholder="••••••••"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nouveau mot de passe</label>
                        <input
                          type="password"
                          value={nouveauMdp}
                          onChange={(e) => setNouveauMdp(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Confirmer</label>
                        <input
                          type="password"
                          value={confirmMdp}
                          onChange={(e) => setConfirmMdp(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-xl p-4">
                      <p className="text-sm text-blue-900">
                        💡 <strong>Conseil :</strong> Utilisez au moins 8 caractères avec majuscules, minuscules et chiffres.
                      </p>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg"
                    >
                      🔐 Changer le mot de passe
                    </motion.button>
                  </form>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span>📱</span> Sessions actives
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border-2 border-green-200">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white text-xl">
                          💻
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Windows PC - Chrome</p>
                          <p className="text-sm text-gray-600">Abidjan, Côte d'Ivoire • Maintenant</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        Actuelle
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Notifications */}
            {ongletActif === 'notifications' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg p-8"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span>🔔</span> Préférences de notifications
                </h3>

                <div className="space-y-4">
                  {[
                    { id: 'email', label: 'Notifications par email', desc: 'Recevoir des alertes par email', state: emailNotifs, setState: setEmailNotifs },
                    { id: 'docs', label: 'Nouveaux documents', desc: 'Être notifié lors de l\'ajout de documents', state: nouveauxDocs, setState: setNouveauxDocs },
                    { id: 'modifs', label: 'Modifications', desc: 'Suivre les modifications de documents', state: modifications, setState: setModifications },
                    { id: 'rapports', label: 'Rapports hebdomadaires', desc: 'Recevoir un résumé chaque semaine', state: rapports, setState: setRapports },
                  ].map((notif, index) => (
                    <motion.label
                      key={notif.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 cursor-pointer transition-all border-2 border-transparent hover:border-gray-200"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{notif.label}</p>
                        <p className="text-sm text-gray-600">{notif.desc}</p>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={notif.state}
                          onChange={(e) => notif.setState(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`w-14 h-8 rounded-full transition-all ${
                          notif.state ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gray-300'
                        }`}>
                          <div className={`w-6 h-6 bg-white rounded-full shadow-lg transition-all ${
                            notif.state ? 'translate-x-7 mt-1 ml-1' : 'translate-x-1 mt-1'
                          }`} />
                        </div>
                      </div>
                    </motion.label>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg"
                >
                  ✅ Enregistrer les préférences
                </motion.button>
              </motion.div>
            )}

            {/* Apparence */}
            {ongletActif === 'apparence' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg p-8"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span>🎨</span> Personnalisation
                </h3>

                <div className="space-y-8">
                  {/* Thème */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4">Thème</label>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { value: 'clair', label: 'Clair', icon: '☀️', gradient: 'from-white to-gray-100' },
                        { value: 'sombre', label: 'Sombre', icon: '🌙', gradient: 'from-gray-800 to-gray-900' },
                      ].map((t) => (
                        <motion.button
                          key={t.value}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setTheme(t.value)}
                          className={`p-6 rounded-2xl border-2 transition-all ${
                            theme === t.value
                              ? 'border-red-500 shadow-lg'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`h-24 rounded-xl bg-gradient-to-br ${t.gradient} mb-4`} />
                          <p className="font-semibold text-gray-900">
                            {t.icon} {t.label}
                          </p>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Langue */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4">Langue</label>
                    <select
                      value={langue}
                      onChange={(e) => setLangue(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                    >
                      <option value="fr">🇫🇷 Français</option>
                      <option value="en">🇬🇧 English</option>
                    </select>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg"
                >
                  ✅ Appliquer les changements
                </motion.button>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
