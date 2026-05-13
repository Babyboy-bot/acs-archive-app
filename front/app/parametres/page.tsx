'use client'

import { Sidebar, AppLayout } from '@/components'
import { Icon, IconName } from '@/components/Icon'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetchJson } from '@/lib/api'
import { getUtilisateurActif, enregistrerSession, supprimerSession } from '@/lib/session'
import { RoleUtilisateur } from '@/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { AuthLoadingScreen } from '@/components/common'

export default function PageParametres() {
  const router = useRouter()
  const { estAuthentifie, chargement: authChargement } = useRequireAuth()
  const [ongletActif, setOngletActif] = useState('profil')
  const [utilisateurId, setUtilisateurId] = useState<string | null>(null)
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<RoleUtilisateur | null>(null)
  const [ancienMdp, setAncienMdp] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmMdp, setConfirmMdp] = useState('')
  const [voirAncienMdp, setVoirAncienMdp] = useState(false)
  const [voirNouveauMdp, setVoirNouveauMdp] = useState(false)
  const [voirConfirmMdp, setVoirConfirmMdp] = useState(false)
  const [chargement, setChargement] = useState(false)
  const [messageProfil, setMessageProfil] = useState('')
  const [erreurProfil, setErreurProfil] = useState('')
  const [messageSecurite, setMessageSecurite] = useState('')
  const [erreurSecurite, setErreurSecurite] = useState('')

  useEffect(() => {
    if (!estAuthentifie) return
    
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
  }, [router, estAuthentifie])


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

  if (authChargement || !estAuthentifie) {
    return <AuthLoadingScreen />
  }

  return (
    <AppLayout>
      <main className="flex-1 p-4 md:p-10 overflow-auto">
        {/* En-tête minimaliste */}
        <motion.header 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <p className="text-sm font-medium text-theme-secondary uppercase tracking-wider mb-1">Configuration</p>
          <h1 className="text-3xl font-semibold text-theme-primary">Paramètres</h1>
          <p className="text-sm text-theme-secondary mt-1">Gérez votre profil et vos préférences</p>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Onglets latéraux */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.05 }}
            className="lg:col-span-1"
          >
            <div className="bg-theme-card border border-theme rounded-xl p-3 sticky top-8">
              <div className="space-y-1">
                {onglets.map((onglet) => (
                  <button
                    key={onglet.id}
                    onClick={() => changerOnglet(onglet.id)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${
                      ongletActif === onglet.id
                        ? 'bg-red-600 text-white'
                        : 'text-theme-secondary hover:bg-theme-muted hover:text-theme-primary'
                    }`}
                  >
                    <Icon name={onglet.icon} size="sm" />
                    {onglet.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="lg:col-span-3">
            {ongletActif === 'profil' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.1 }}
                className="bg-theme-card border border-theme rounded-xl p-6"
              >
                {/* Header profil */}
                <div className="flex items-center gap-5 mb-6 pb-6 border-b border-theme">
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl font-semibold"
                    style={{ backgroundColor: '#D32027' }}
                  >
                    {prenom[0]}{nom[0]}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-theme-primary">{prenom} {nom}</h2>
                    <p className="text-sm text-theme-secondary flex items-center gap-2 mt-0.5">
                      <Icon name="at" size="xs" />
                      {email || '—'}
                    </p>
                  </div>
                  <span className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg">
                    {roleLabel}
                  </span>
                </div>

                {messageProfil && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 text-green-700 dark:text-green-400 text-sm"
                  >
                    {messageProfil}
                  </motion.div>
                )}

                {erreurProfil && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm"
                  >
                    {erreurProfil}
                  </motion.div>
                )}

                <form onSubmit={sauvegarderProfil} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-theme-secondary mb-1.5">Nom</label>
                      <input 
                        type="text" 
                        value={nom} 
                        onChange={(e) => setNom(e.target.value)} 
                        className="w-full px-3 py-2.5 text-sm border border-theme bg-theme-card text-theme-primary rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-all outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-theme-secondary mb-1.5">Prénom</label>
                      <input 
                        type="text" 
                        value={prenom} 
                        onChange={(e) => setPrenom(e.target.value)} 
                        className="w-full px-3 py-2.5 text-sm border border-theme bg-theme-card text-theme-primary rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-all outline-none" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-theme-secondary mb-1.5">Email</label>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      className="w-full px-3 py-2.5 text-sm border border-theme bg-theme-card text-theme-primary rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-all outline-none" 
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={chargement} 
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Icon name="check" size="sm" />
                    {chargement ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </button>
                </form>
              </motion.div>
            )}

            {ongletActif === 'securite' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.1 }}
                className="bg-theme-card border border-theme rounded-xl p-6"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-theme">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <Icon name="lock" size="sm" className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-theme-primary">Sécurité du compte</h3>
                    <p className="text-xs text-theme-secondary">Gérez votre mot de passe</p>
                  </div>
                </div>

                {estAdmin ? (
                  <>
                    {messageSecurite && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 text-green-700 dark:text-green-400 text-sm"
                      >
                        {messageSecurite}
                      </motion.div>
                    )}

                    {erreurSecurite && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm"
                      >
                        {erreurSecurite}
                      </motion.div>
                    )}

                    <form onSubmit={changerMotDePasse} className="space-y-5">
                      <div>
                        <label className="block text-xs font-medium text-theme-secondary mb-1.5">Mot de passe actuel</label>
                        <div className="relative">
                          <input 
                            type={voirAncienMdp ? 'text' : 'password'} 
                            value={ancienMdp} 
                            onChange={(e) => setAncienMdp(e.target.value)} 
                            required 
                            className="w-full px-3 py-2.5 pr-10 text-sm border border-theme bg-theme-card text-theme-primary rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-all outline-none" 
                            placeholder="••••••••" 
                          />
                          <button type="button" onClick={() => setVoirAncienMdp((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-secondary hover:text-theme-primary transition-colors" tabIndex={-1}>
                            <Icon name={voirAncienMdp ? 'eye-slash' : 'eye'} size="xs" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-theme-secondary mb-1.5">Nouveau mot de passe</label>
                          <div className="relative">
                            <input 
                              type={voirNouveauMdp ? 'text' : 'password'} 
                              value={nouveauMdp} 
                              onChange={(e) => setNouveauMdp(e.target.value)} 
                              required 
                              minLength={8} 
                              className="w-full px-3 py-2.5 pr-10 text-sm border border-theme bg-theme-card text-theme-primary rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-all outline-none" 
                              placeholder="••••••••" 
                            />
                            <button type="button" onClick={() => setVoirNouveauMdp((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-secondary hover:text-theme-primary transition-colors" tabIndex={-1}>
                              <Icon name={voirNouveauMdp ? 'eye-slash' : 'eye'} size="xs" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-theme-secondary mb-1.5">Confirmer</label>
                          <div className="relative">
                            <input 
                              type={voirConfirmMdp ? 'text' : 'password'} 
                              value={confirmMdp} 
                              onChange={(e) => setConfirmMdp(e.target.value)} 
                              required 
                              minLength={8} 
                              className="w-full px-3 py-2.5 pr-10 text-sm border border-theme bg-theme-card text-theme-primary rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-all outline-none" 
                              placeholder="••••••••" 
                            />
                            <button type="button" onClick={() => setVoirConfirmMdp((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-secondary hover:text-theme-primary transition-colors" tabIndex={-1}>
                              <Icon name={voirConfirmMdp ? 'eye-slash' : 'eye'} size="xs" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 flex items-start gap-3">
                        <Icon name="info" size="xs" className="text-blue-500 mt-0.5" />
                        <p className="text-xs text-theme-secondary">
                          Utilisez au moins 8 caractères avec majuscules, minuscules et chiffres.
                        </p>
                      </div>

                      <button 
                        type="submit" 
                        disabled={chargement} 
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Icon name="key" size="sm" />
                        {chargement ? 'Changement...' : 'Changer le mot de passe'}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
                    <Icon name="info" size="sm" className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-theme-primary mb-1">Modification réservée à l'administration</h4>
                      <p className="text-xs text-theme-secondary">
                        Merci de contacter un administrateur pour réinitialiser ou modifier votre mot de passe.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </AppLayout>
  )
}
