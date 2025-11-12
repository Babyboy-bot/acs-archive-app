// Page de connexion
'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Bouton } from '@/components/ui/Bouton'
import { ChampTexte } from '@/components/ui/ChampTexte'
import { Alerte } from '@/components/ui/Alerte'

export default function PageConnexion() {
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')

  const gererSoumission = async (e: React.FormEvent) => {
    e.preventDefault()
    setChargement(true)
    setErreur('')

    // TODO: Implémenter la logique de connexion avec NextAuth
    setTimeout(() => {
      setChargement(false)
      setErreur('Fonctionnalité en cours de développement')
    }, 1000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
      {/* Effets d'arrière-plan ACS */}
      <div className="absolute inset-0">
        <div className="absolute w-96 h-96 rounded-full blur-3xl -top-48 -left-48 animate-pulse" style={{ backgroundColor: 'rgba(211, 32, 39, 0.08)' }} />
        <div className="absolute w-96 h-96 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse" style={{ backgroundColor: 'rgba(0, 102, 179, 0.08)', animationDelay: '1s' }} />
      </div>
      <div className="max-w-md w-full relative z-10">
        {/* En-tête avec logo */}
        <div className="text-center mb-8">
          <div className="inline-block bg-white rounded-3xl p-6 mb-6 shadow-lg border-2" style={{ borderColor: '#e5e7eb' }}>
            <Image
              src="/acs-logo.svg"
              alt="ACS Logo"
              width={200}
              height={80}
              priority
            />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1F2937' }}>Connexion</h1>
          <p style={{ color: '#6B7280' }}>Accédez à votre espace ACS Archive</p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border" style={{ borderColor: '#e5e7eb' }}>
          {erreur && (
            <div className="mb-6">
              <Alerte type="erreur" message={erreur} surFermeture={() => setErreur('')} />
            </div>
          )}

          <form onSubmit={gererSoumission} className="space-y-6">
            <ChampTexte
              etiquette="Adresse email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@acs.ci"
              obligatoire
              autoComplete="email"
            />

            <ChampTexte
              etiquette="Mot de passe"
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="••••••••"
              obligatoire
              autoComplete="current-password"
            />

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
                className="font-medium hover:opacity-80 transition-opacity"
                style={{ color: '#0066B3' }}
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <Bouton
              type="submit"
              variante="primaire"
              taille="grand"
              chargement={chargement}
              className="w-full"
            >
              Se connecter
            </Bouton>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Vous n'avez pas de compte ?{' '}
            <Link href="/inscription" className="font-medium hover:opacity-80 transition-opacity" style={{ color: '#0066B3' }}>
              Contactez l'administrateur
            </Link>
          </div>
        </div>

        {/* Pied de page */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© 2025 ACS - Assureurs Conseils Service</p>
          <p className="mt-1">Développé par KASSI ELIE EMMANUEL & ASSINYO RODRIGUE</p>
        </div>
      </div>
    </div>
  )
}
