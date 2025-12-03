'use client'

import { Navigation } from '@/components/Navigation'
import { Icon, IconName } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetchJson } from '@/lib/api'
import { getUtilisateurActif, enregistrerSession, supprimerSession } from '@/lib/session'
import { RoleUtilisateur } from '@/types'

export default function PageParametres() {
  const router = useRouter()
  const [ongletActif, setOngletActif] = useState('profil')
  const [utilisateurId, setUtilisateurId] = useState<string | null>(null)
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<RoleUtilisateur | null>(null)
  const [ancienMdp, setAncienMdp] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmMdp, setConfirmMdp] = useState('')
  const [chargement, setChargement] = useState(false)
  const [messageProfil, setMessageProfil] = useState('')
  const [erreurProfil, setErreurProfil] = useState('')
  const [messageSecurite, setMessageSecurite] = useState('')
  const [erreurSecurite, setErreurSecurite] = useState('')

  useEffect(() => {
    const actif = getUtilisateurActif()
    if (!actif) {
      supprimerSession()
      router.push('/connexion')
      return
    }

    setUtilisateurId(actif.id)
    setNom(actif.nom ?? '')
    setPrenom(actif.prenom ?? '')
    setEmail(actif.email ?? '')
    setRole(actif.role as RoleUtilisateur)
  }, [router])


  const estAdmin = role === 'ADMIN'

  const changerOnglet = (id: 'profil' | 'securite') => {
    setOngletActif(id)
    if (id === 'profil') {
      setMessageSecurite('')
      setErreurSecurite('')
    } else {
      setMessageProfil('')
      setErreurProfil('')
    }
  }

  useEffect(() => {
    if (!messageProfil && !erreurProfil) return
    const timer = setTimeout(() => {
      setMessageProfil('')
      setErreurProfil('')
    }, 4000)
    return () => clearTimeout(timer)
  }, [messageProfil, erreurProfil])

  useEffect(() => {
    if (!messageSecurite && !erreurSecurite) return
    const timer = setTimeout(() => {
      setMessageSecurite('')
      setErreurSecurite('')
    }, 4000)
    return () => clearTimeout(timer)
  }, [messageSecurite, erreurSecurite])

  const sauvegarderProfil = async (e: React.FormEvent) => {
    e.preventDefault()
    setChargement(true)
    setErreurProfil('')
    setMessageProfil('')

    if (!utilisateurId) {
      setErreurProfil('Utilisateur non identifié. Merci de vous reconnecter.')
      setChargement(false)
      return
    }

    try {
      const payload = {
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim() || null
      }

      const { response, data } = await apiFetchJson(`/utilisateurs/${utilisateurId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok || !data || typeof data !== 'object' || !('success' in data) || !(data as any).success) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || 'Erreur lors de la sauvegarde')
      }

      const utilisateurMisAJour = (data as any).utilisateur
      if (utilisateurMisAJour) {
        enregistrerSession({
          token: getUtilisateurActif()?.id ? (localStorage.getItem('authToken') ?? '') : '',
          refresh: getUtilisateurActif()?.id ? localStorage.getItem('refreshToken') : '',
          utilisateur: {
            id: utilisateurMisAJour.id,
            nomUtilisateur: utilisateurMisAJour.nom_utilisateur ?? utilisateurMisAJour.nomUtilisateur,
            nom: utilisateurMisAJour.nom,
            prenom: utilisateurMisAJour.prenom,
            email: utilisateurMisAJour.email,
            role: utilisateurMisAJour.role,
          }
        })
        setRole(utilisateurMisAJour.role as RoleUtilisateur)
      }

      setMessageProfil('Profil mis à jour avec succès !')
    } catch (error) {
      console.error('Erreur mise à jour profil:', error)
      setErreurProfil(error instanceof Error ? error.message : 'Erreur de connexion')
    } finally {
      setChargement(false)
    }
  }

  const changerMotDePasse = async (e: React.FormEvent) => {
    e.preventDefault()
    setChargement(true)
    setErreurSecurite('')
    setMessageSecurite('')

    if (!utilisateurId) {
      setErreurSecurite('Utilisateur non identifié. Merci de vous reconnecter.')
      setChargement(false)
      return
    }

    // Validation
    if (nouveauMdp !== confirmMdp) {
      setErreurSecurite('Les mots de passe ne correspondent pas')
      setChargement(false)
      return
    }

    if (nouveauMdp.length < 8) {
      setErreurSecurite('Le mot de passe doit contenir au moins 8 caractères')
      setChargement(false)
      return
    }

    try {
      const { response, data } = await apiFetchJson(`/utilisateurs/${utilisateurId}/change-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ancien_mot_de_passe: ancienMdp,
          nouveau_mot_de_passe: nouveauMdp
        })
      })

      if (!response.ok || !data || typeof data !== 'object' || !('success' in data) || !(data as any).success) {
        throw new Error((data as any)?.erreur || (data as any)?.detail || 'Erreur lors du changement de mot de passe')
      }

      setMessageSecurite('Mot de passe modifié avec succès !')
      setAncienMdp('')
      setNouveauMdp('')
      setConfirmMdp('')
    } catch (error) {
      console.error('Erreur changement mot de passe:', error)
      setErreurSecurite(error instanceof Error ? error.message : 'Erreur de connexion')
    } finally {
      setChargement(false)
    }
  }

  const roleLabel = role
    ? {
        ADMIN: 'Administrateur',
        ARCHIVISTE: 'Archiviste',
        CONSULTANT: 'Consultant',
      }[role]
    : 'Profil'

  const onglets: { id: 'profil' | 'securite'; label: string; icon: IconName }[] = [
    { id: 'profil', label: 'Profil', icon: 'user' },
    { id: 'securite', label: 'Sécurité', icon: 'lock' },
  ]

  return (
    <div className="min-h-screen bg-theme-base text-theme-primary transition-colors">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent mb-2 flex items-center gap-3">
            <Icon name="settings" size="xl" className="text-red-500" />
            Paramètres
          </h1>
          <p className="text-theme-secondary">Gérez votre profil et vos préférences</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1">
            <div className="bg-theme-card border border-theme rounded-2xl shadow-lg p-4 sticky top-8 transition-colors">
              <div className="space-y-2">
                {onglets.map((onglet) => (
                  <motion.button
                    key={onglet.id}
                    whileHover={{ x: 5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => changerOnglet(onglet.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                      ongletActif === onglet.id
                        ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                        : 'text-theme-secondary hover:bg-theme-muted'
                    }`}
                  >
                    <Icon name={onglet.icon} size="sm" />
                    {onglet.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="lg:col-span-3">
            {ongletActif === 'profil' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-theme-card border border-theme rounded-2xl shadow-lg p-8 transition-colors">
                <div className="flex items-center gap-6 mb-8 pb-8 border-b border-theme">
                  <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl"
                    style={{ background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' }}>
                    {prenom[0]}{nom[0]}
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-bold text-theme-primary">{prenom} {nom}</h2>
                    <p className="text-theme-secondary flex items-center gap-2 mt-1">
                      <Icon name="at" size="sm" />
                      {email}
                    </p>
                    <span className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full flex items-center gap-1 w-fit">
                      <Icon name="star" size="xs" />
                      {roleLabel}
                    </span>
                  </div>
                </div>

                {messageProfil && (
                  <div className="mb-6 p-4 bg-green-100/20 border border-green-300/40 rounded-xl flex items-start gap-3 text-green-200">
                    <Icon name="check" size="sm" className="text-green-400 mt-0.5" />
                    <p className="font-medium text-theme-primary flex-1">{messageProfil}</p>
                    <button
                      type="button"
                      onClick={() => setMessageProfil('')}
                      className="text-green-400 hover:text-green-300 transition-colors"
                      aria-label="Fermer la notification de profil"
                    >
                      ×
                    </button>
                  </div>
                )}

                {erreurProfil && (
                  <div className="mb-6 p-4 bg-red-100/20 border border-red-300/40 rounded-xl flex items-start gap-3 text-red-200">
                    <Icon name="warning" size="sm" className="text-red-400 mt-0.5" />
                    <p className="font-medium text-theme-primary flex-1">{erreurProfil}</p>
                    <button
                      type="button"
                      onClick={() => setErreurProfil('')}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      aria-label="Fermer l'erreur de profil"
                    >
                      ×
                    </button>
                  </div>
                )}

                <form onSubmit={sauvegarderProfil} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-2">Nom</label>
                      <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} className="w-full px-4 py-3 border border-theme bg-theme-card text-theme-primary rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-2">Prénom</label>
                      <input type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)} className="w-full px-4 py-3 border border-theme bg-theme-card text-theme-primary rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-2">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-theme bg-theme-card text-theme-primary rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" />
                  </div>

                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={chargement} className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    <Icon name="check" size="sm" />
                    {chargement ? 'Enregistrement...' : 'Enregistrer'}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {ongletActif === 'securite' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-theme-card border border-theme rounded-2xl shadow-lg p-8 transition-colors">
                  <h3 className="text-xl font-bold text-theme-primary mb-6 flex items-center gap-2">
                    <Icon name="lock" size="md" />
                    Changer le mot de passe
                  </h3>
                  {estAdmin ? (
                    <>
                      {messageSecurite && (
                        <div className="mb-6 p-4 bg-green-100/20 border border-green-300/40 rounded-xl flex items-start gap-3 text-green-200">
                          <Icon name="check" size="sm" className="text-green-400 mt-0.5" />
                          <p className="font-medium text-theme-primary flex-1">{messageSecurite}</p>
                          <button
                            type="button"
                            onClick={() => setMessageSecurite('')}
                            className="text-green-400 hover:text-green-300 transition-colors"
                            aria-label="Fermer la notification de sécurité"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      {erreurSecurite && (
                        <div className="mb-6 p-4 bg-red-100/20 border border-red-300/40 rounded-xl flex items-start gap-3 text-red-200">
                          <Icon name="warning" size="sm" className="text-red-400 mt-0.5" />
                          <p className="font-medium text-theme-primary flex-1">{erreurSecurite}</p>
                          <button
                            type="button"
                            onClick={() => setErreurSecurite('')}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            aria-label="Fermer l'erreur de sécurité"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      <form onSubmit={changerMotDePasse} className="space-y-6">
                        <div>
                          <label className="block text-sm font-semibold text-theme-secondary mb-2">Mot de passe actuel</label>
                          <input type="password" value={ancienMdp} onChange={(e) => setAncienMdp(e.target.value)} required className="w-full px-4 py-3 border border-theme bg-theme-card text-theme-primary rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none" placeholder="••••••••" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-semibold text-theme-secondary mb-2">Nouveau mot de passe</label>
                            <input type="password" value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)} required minLength={8} className="w-full px-4 py-3 border border-theme bg-theme-card text-theme-primary rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" placeholder="••••••••" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-theme-secondary mb-2">Confirmer</label>
                            <input type="password" value={confirmMdp} onChange={(e) => setConfirmMdp(e.target.value)} required minLength={8} className="w-full px-4 py-3 border border-theme bg-theme-card text-theme-primary rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" placeholder="••••••••" />
                          </div>
                        </div>

                        <div className="bg-blue-100/20 rounded-xl p-4 flex items-start gap-3 text-blue-200">
                          <Icon name="info" size="sm" className="text-blue-400 mt-0.5" />
                          <p className="text-sm text-theme-primary">
                            <strong>Conseil :</strong> Utilisez au moins 8 caractères avec majuscules, minuscules et chiffres.
                          </p>
                        </div>

                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={chargement} className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                          <Icon name="key" size="sm" />
                          {chargement ? 'Changement...' : 'Changer le mot de passe'}
                        </motion.button>
                      </form>
                    </>
                  ) : (
                    <div className="bg-yellow-100/20 border border-yellow-300/40 rounded-xl p-6 flex items-start gap-3 text-yellow-200">
                      <Icon name="info" size="sm" className="text-yellow-400 mt-1" />
                      <div>
                        <h4 className="text-sm font-semibold text-theme-primary mb-1">Modification réservée à l'administration</h4>
                        <p className="text-sm text-theme-primary/80">
                          Merci de contacter un administrateur pour réinitialiser ou modifier votre mot de passe.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
