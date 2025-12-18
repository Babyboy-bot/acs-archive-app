"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { PublicRoute } from "@/components/PublicRoute";

export default function PageMotDePasseOublie() {
  return (
    <PublicRoute>
      <div className="h-screen w-full flex items-center justify-center bg-white overflow-hidden font-sans">
        {/* SECTION UNIQUE - CONTENU CENTRÉ */}
        <div className="w-full max-w-lg flex items-center justify-center p-6 bg-white relative">
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-md w-full"
          >
            <div className="flex mb-6 gap-6 items-center">
              <div className="flex items-center gap-3">
                <div className="rounded-xl flex items-center justify-center">
                  <Icon name="key" size="lg" className="text-red-500"/>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-gray-900 mb-2 tracking-tight">
                  Mot de passe oublié
                </h1>
                <p className="text-gray-500 text-base">
                  Procédure de récupération de vos accès.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Icon name="shield" size="xs" className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-0.5">
                      Sécurité renforcée
                    </p>
                    <p className="text-gray-500 text-xs leading-relaxed">
                      La réinitialisation du mot de passe est traitée
                      manuellement par les équipes ACS.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Icon name="info" size="xs" className="text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-0.5">
                      Procédure interne
                    </p>
                    <p className="text-gray-500 text-xs leading-relaxed">
                      Vous serez averti via les canaux habituels lorsque vos
                      nouveaux identifiants seront disponibles.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                    <Icon name="check" size="xs" className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-0.5">
                      Reconnexion
                    </p>
                    <p className="text-gray-500 text-xs leading-relaxed">
                      Une fois réinitialisé, vous pourrez vous reconnecter avec
                      les identifiants fournis.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <motion.div className="mt-6">
              <Link href="/connexion">
                <motion.button
                  whileHover={{
                    scale: 1.02,
                    boxShadow: "0 20px 30px -10px rgba(94, 93, 93, 0.3)",
                  }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 bg-zinc-800 text-white rounded-md text-md shadow-lg cursor-pointer shadow-zinc-800/20 transition-all relative overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Icon name="arrow-left" size="sm" />
                    Retour à la connexion
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
                </motion.button>
              </Link>
            </motion.div>

            <div className="mt-8 text-center">
              <p className="text-gray-400 text-xs">
                © 2025 ACS Archive . Tous droits réservés.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </PublicRoute>
  );
}
