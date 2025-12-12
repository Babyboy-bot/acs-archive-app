'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Icon } from '@/components/Icon'

export default function PageMotDePasseOublie() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-theme-base text-theme-primary">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full bg-theme-card border border-theme rounded-2xl shadow-lg p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <Icon name="key" size="lg" className="text-red-500" />
          <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
        </div>

        <p className="text-theme-secondary mb-6">
          Pour des raisons de sécurité, la réinitialisation du mot de passe n'est pas automatisée.
          La mise à jour de vos accès est traitée manuellement par les équipes ACS.
        </p>

        <div className="space-y-4 bg-theme-muted border border-theme rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="info" size="sm" className="mt-1 text-red-500" />
            <div>
              <p className="font-semibold text-theme-primary">Procédure interne</p>
              <p className="text-theme-secondary">
                Vous serez averti via les canaux habituels lorsque vos nouveaux identifiants seront disponibles.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-sm text-theme-secondary">
          <p>
            Une fois le mot de passe réinitialisé, vous pourrez vous reconnecter avec les identifiants fournis.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link href="/connexion" className="inline-flex items-center gap-2 text-theme-primary font-medium hover:opacity-80">
            <Icon name="arrow-left" size="sm" />
            Retour à la connexion
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
