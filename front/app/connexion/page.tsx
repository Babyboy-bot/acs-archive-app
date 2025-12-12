'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Icon } from '@/components/Icon'
import { motion } from 'framer-motion'
import { apiFetchJson } from '@/lib/api'
import { enregistrerSession } from '@/lib/session'
import { RoleUtilisateur } from '@/types'

export default function PageConnexion() {
  const router = useRouter()
  const [nomUtilisateur, setNomUtilisateur] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')

  const gererSoumission = async (e: React.FormEvent) => {
    e.preventDefault()
    setChargement(true)
    setErreur('')

    try {
      const { response, data } = await apiFetchJson('/auth/login/', {
        method: 'POST',
        skipAuth: true,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nom_utilisateur: nomUtilisateur,
          mot_de_passe: motDePasse
        })
      })

      if (!response.ok || !data || typeof data !== 'object' || !('success' in data) || !data.success) {
        setErreur((data as any)?.erreur || (data as any)?.detail || 'Erreur lors de la connexion')
        setChargement(false)
        return
      }

      const role = (data as any).utilisateur.role as RoleUtilisateur

      enregistrerSession({
        utilisateur: {
          id: (data as any).utilisateur.id,
          nomUtilisateur: (data as any).utilisateur.nomUtilisateur,
          nom: (data as any).utilisateur.nom,
          prenom: (data as any).utilisateur.prenom,
          email: (data as any).utilisateur.email,
          role,
        }
      })

      const destination = role === RoleUtilisateur.CONSULTANT ? '/assistant-demo' : '/tableau-de-bord'
      router.push(destination)
    } catch (error) {
      console.error('Erreur de connexion:', error)
      setErreur('Erreur de connexion au serveur')
      setChargement(false)
    }
  }

  return (
    <div className="min-h-screen bg-theme-base text-theme-primary flex items-center justify-center px-4 relative overflow-hidden">
      {/* Effets d'arrière-plan */}
      <div className="absolute inset-0">
        <div className="absolute w-96 h-96 rounded-full blur-3xl -top-48 -left-48 animate-pulse" style={{ backgroundColor: 'rgba(211, 32, 39, 0.08)' }} />
        <div className="absolute w-96 h-96 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse" style={{ backgroundColor: 'rgba(0, 102, 179, 0.08)', animationDelay: '1s' }} />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10"
      >
        {/* En-tête avec logo */}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="inline-block bg-white rounded-3xl p-6 mb-6 shadow-lg border-2" 
            style={{ borderColor: '#e5e7eb' }}
          >
            <Image
              src="/acs-logo.svg"
              alt="ACS Logo"
              width={200}
              height={80}
              priority
            />
          </motion.div>
          <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-3" style={{ color: '#1F2937' }}>
            <Icon name="lock" size="lg" className="text-red-600" />
            Connexion
          </h1>
          <p style={{ color: '#6B7280' }}>Accédez à votre espace ACS Archive</p>
        </div>

        {/* Formulaire */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl p-8 border" 
          style={{ borderColor: '#e5e7eb' }}
        >
          {erreur && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3"
            >
              <Icon name="warning" size="sm" className="text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">{erreur}</p>
                <button 
                  onClick={() => setErreur('')}
                  className="text-sm text-red-600 hover:text-red-700 mt-1"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          )}

          <form onSubmit={gererSoumission} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nom d'utilisateur
              </label>
              <input
                type="text"
                value={nomUtilisateur}
                onChange={(e) => setNomUtilisateur(e.target.value)}
                placeholder="prenom.nom"
                required
                autoComplete="username"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Icon name="key" size="sm" />
                Mot de passe
              </label>
              <input
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded focus:ring-2 border-gray-300"
                  style={{ accentColor: '#D32027' }}
                />
                <span className="text-gray-700">Se souvenir de moi</span>
              </label>
              <Link
                href="/mot-de-passe-oublie"
                className="font-medium hover:opacity-80 transition-opacity flex items-center gap-1"
                style={{ color: '#0066B3' }}
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={chargement}
              className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {chargement ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <Icon name="check" size="sm" />
                  Se connecter
                </>
              )}
            </motion.button>
          </form>
        </motion.div>

        {/* Pied de page */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8 text-sm text-gray-500"
        >
          <p>© 2025 ACS - Assureurs Conseils Service</p>
          <p className="mt-1">Développé par KASSI ELIE EMMANUEL & ASSINYO RODRIGUE</p>
        </motion.div>
      </motion.div>
    </div>
  )
}
