'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'

import { motion, useMotionValue, useSpring, useTransform, useAnimation } from 'framer-motion'
import { apiFetchJson } from '@/lib/api'
import { enregistrerSession } from '@/lib/session'
import { RoleUtilisateur } from '@/types'
import { PublicRoute } from '@/components/PublicRoute'

export default function PageConnexion() {
  const router = useRouter()
  const [nomUtilisateur, setNomUtilisateur] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')

  const leftPanelRef = useRef<HTMLDivElement | null>(null)

  const blob1Controls = useAnimation()
  const blob2Controls = useAnimation()

  useEffect(() => {
    if (!leftPanelRef.current) return

    const bounds = leftPanelRef.current.getBoundingClientRect()

    const randomRange = (min: number, max: number) => min + Math.random() * (max - min)

    const shapes = [
      "60% 40% 70% 30% / 60% 30% 70% 40%",
      "50% 60% 40% 70% / 60% 70% 40% 50%",
      "70% 30% 50% 50% / 50% 40% 60% 40%",
    ]

    const animateBlob = (controls: any, intensity: number) => {
      const xTarget = randomRange(-bounds.width * intensity, bounds.width * intensity)
      const yTarget = randomRange(-bounds.height * intensity, bounds.height * intensity)
      const borderRadius = shapes[Math.floor(Math.random() * shapes.length)]
      const duration = randomRange(24, 40)

      controls
        .start({
          x: xTarget,
          y: yTarget,
          borderRadius,
          transition: {
            duration,
            ease: 'easeInOut',
          },
        })
        .then(() => animateBlob(controls, intensity))
    }

    animateBlob(blob1Controls, 0.35)
    animateBlob(blob2Controls, 0.35)
  }, [blob1Controls, blob2Controls])

  // Animation 3D de la souris
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const mouseX = useSpring(x, { stiffness: 500, damping: 100 })
  const mouseY = useSpring(y, { stiffness: 500, damping: 100 })

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["15deg", "-15deg"])
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-15deg", "15deg"])

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseXFromCenter = e.clientX - rect.left - width / 2
    const mouseYFromCenter = e.clientY - rect.top - height / 2
    x.set(mouseXFromCenter / width)
    y.set(mouseYFromCenter / height)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

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
          username: nomUtilisateur,
          password: motDePasse
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
    <PublicRoute>
      <div className="min-h-screen w-full flex bg-white overflow-hidden font-sans">
        {/* SECTION GAUCHE - 3D EXPERIENCE */}
        <div
          ref={leftPanelRef}
          className="hidden lg:flex lg:w-[55%] relative bg-[#0A0F1C] items-center justify-center perspective-1000 overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >

          {/* Grid Pattern + texture */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#ffffff12_1px,transparent_0)] bg-[length:24px_24px] opacity-40 mix-blend-soft-light" />
          </div>

          {/* 3D Content Container */}
          <motion.div
            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            className="relative z-10 w-full max-w-lg"
          >
            {/* Fluid floating elements - liquid jelly blobs */}
            <motion.div
              className="absolute -top-28 -right-16 w-64 h-64 z-20 cursor-grab active:cursor-grabbing"
              style={{ transform: "translateZ(140px)" }}
              animate={blob1Controls}
              drag
              dragConstraints={leftPanelRef}
              dragElastic={0.35}
              whileDrag={{ scale: 1.08 }}
              whileHover={{ scale: 1.05 }}
            >
              <div
                className="w-full h-full rounded-[inherit] backdrop-blur-3xl shadow-[0_0_60px_rgba(0,0,0,0.35)] relative overflow-hidden"
              >
                {/* Dégradé glossy interne */}
                <div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(255,0,120,0.38),transparent_60%),radial-gradient(circle_at_0%_100%,rgba(0,150,255,0.4),transparent_70%)] mix-blend-screen"
                />

                {/* Reflets internes */}
                <div
                  className="absolute inset-0 shadow-[inset_20px_20px_40px_rgba(255,255,255,0.2),inset_-20px_-20px_40px_rgba(0,0,0,0.25)] opacity-55"
                />

                {/* Glow externe */}
                <div
                  className="absolute -inset-10 bg-[radial-gradient(circle,rgba(255,255,255,0.3),transparent_70%)] blur-[50px] opacity-45"
                />
              </div>
            </motion.div>

            <motion.div
              className="absolute -bottom-32 -left-20 w-72 h-72 z-20 cursor-grab active:cursor-grabbing"
              style={{ transform: "translateZ(130px)" }}
              animate={blob2Controls}
              drag
              dragConstraints={leftPanelRef}
              dragElastic={0.35}
              whileDrag={{ scale: 1.08 }}
              whileHover={{ scale: 1.05 }}
            >
              <div
                className="w-full h-full rounded-[inherit] backdrop-blur-3xl shadow-[0_0_60px_rgba(0,0,0,0.32)] relative overflow-hidden"
              >
                <div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_10%_30%,rgba(255,255,255,0.24),transparent_60%),radial-gradient(circle_at_85%_80%,rgba(0,200,255,0.35),transparent_60%),radial-gradient(circle_at_0%_100%,rgba(236,72,153,0.35),transparent_70%)] mix-blend-screen"
                />
                <div
                  className="absolute inset-0 shadow-[inset_18px_18px_36px_rgba(255,255,255,0.18),inset_-18px_-18px_36px_rgba(0,0,0,0.25)] opacity-55"
                />
                <div
                  className="absolute -inset-10 bg-[radial-gradient(circle,rgba(255,255,255,0.28),transparent_70%)] blur-[48px] opacity-40"
                />
              </div>
            </motion.div>

            <motion.div
              style={{ transform: "translateZ(70px)" }}
              className="absolute top-10 left-8 w-10 h-10 rounded-full bg-white/15 backdrop-blur-2xl border border-white/40 shadow-lg z-30"
              animate={{
                y: [0, -12, 6, 0],
                x: [0, 8, -4, 0],
                scale: [1, 1.1, 0.95, 1],
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
            />

            <motion.div
              style={{ transform: "translateZ(50px)" }}
              className="absolute bottom-10 right-12 w-8 h-8 rounded-full bg-white/10 backdrop-blur-2xl border border-white/40 shadow-md z-30"
              animate={{
                y: [0, 10, -8, 0],
                x: [0, -6, 4, 0],
                scale: [1, 0.9, 1.05, 1],
              }}
              transition={{
                duration: 14,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
            />

            {/* Main Glass Card */}
            <motion.div
              style={{ transform: "translateZ(10px)", transformStyle: "preserve-3d" }}
              className="bg-white/10 backdrop-blur-2xl rounded-[999px] p-12 border border-white/20 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden z-0"
              animate={{
                y: [0, -6, 3, 0],
                scale: [1, 1.02, 0.99, 1],
                borderRadius: [
                  "60% 40% 70% 30% / 60% 35% 65% 40%",
                  "55% 45% 60% 40% / 55% 65% 35% 45%",
                  "65% 35% 55% 45% / 50% 40% 60% 40%",
                ],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(255,255,255,0.1),transparent_55%)] opacity-30 mix-blend-soft-light" />
              <motion.div
                style={{ transform: "translateZ(20px)" }}
                className="relative z-10 p-10"
                animate={{
                  y: [0, -4, 2, 0],
                  opacity: [1, 0.97, 1],
                }}
                transition={{
                  duration: 18,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }}
              >
                <div className="pointer-events-none absolute -inset-10 rounded-[999px] bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.78),transparent_78%)] opacity-85" />
                <div className="relative">
                  <img src="/acs-logo.svg" alt="ACS Logo" width={200} height={80} className="mb-8" />
                  <h2 className="text-5xl font-bold text-white mb-6 leading-tight tracking-tight">
                    Future of <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
                      Archiving
                    </span>
                  </h2>
                  <p className="text-blue-100/80 text-lg leading-relaxed font-light">
                    Expérimentez la puissance d'une gestion documentaire sécurisée, rapide et intuitive.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

        {/* SECTION DROITE - FORMULAIRE MINIMALISTE */}
        <div className="w-full lg:w-[45%] flex items-center justify-center p-8 bg-white relative">
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-md w-full"
          >
            <div className="mb-12">
              <h1 className="text-4xl font-semibold text-gray-900 mb-3 tracking-tight">Bienvenue</h1>
              <p className="text-gray-500 text-lg">Veuillez entrer vos identifiants.</p>
            </div>

            {erreur && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2"
              >
                <Icon name="warning" size="sm" />
                {erreur}
              </motion.div>
            )}

            <form onSubmit={gererSoumission} className="space-y-8">
              <div className="space-y-6">
                <div className="group">
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 ml-1">Nom d'utilisateur</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={nomUtilisateur}
                      onChange={(e) => setNomUtilisateur(e.target.value)}
                      className="block w-full bg-gray-50 border border-gray-400 focus:ring-0 focus:outline-none rounded-md py-4 px-4 text-gray-900 transition-all duration-300 ease-in-out placeholder-gray-500"
                      placeholder="Entrez votre identifiant"
                    />
                    <div className="absolute inset-0 rounded-xl border border-gray-100 pointer-events-none transition-all duration-300" />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 ml-1">Mot de passe</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={motDePasse}
                      onChange={(e) => setMotDePasse(e.target.value)}
                      className="block w-full bg-gray-50 border border-gray-400 focus:ring-0 focus:outline-none rounded-md py-4 px-4 text-gray-900 transition-all duration-300 ease-in-out placeholder-gray-500"
                      placeholder="••••••••"
                    />
                    <div className="absolute inset-0 rounded-xl border border-gray-100 pointer-events-none transition-all duration-300" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <Link href="/mot-de-passe-oublie" className="text-sm font-light text-blue-600 hover:text-blue-800 transition-colors">
                  Mot de passe oublié ?
                </Link>
              </div>

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 20px 30px -10px rgba(94, 93, 93, 0.3)" }}
                whileTap={{ scale: 0.98 }}
                disabled={chargement}
                className="w-full py-3 bg-zinc-800 text-white rounded-md text-md shadow-lg cursor-pointer shadow-zinc-800/20 transition-all relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {chargement ? 'Connexion...' : 'Accéder à mon espace'}
                  {!chargement && <Icon name="arrow-right" size="sm" />}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
              </motion.button>
            </form>

            <div className="mt-20 text-center">
              <p className="text-gray-400 text-sm mb-3"> 2025 ACS Archive . Tous droits réservés.</p>
              <p className="text-gray-400 text-xs">Made by KASSI & RODRIGUE</p>
            </div>
          </motion.div>
        </div>
      </div>
    </PublicRoute>
  )
}