// Composant de navigation principal
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useMemo } from 'react'
import { Icon, IconName } from './Icon'
import { useUtilisateurCourant } from '../hooks/useUtilisateurCourant'
import { canAccessSection, hasPermission, PermissionRessource } from '../lib/permissions'
import { supprimerSession } from '../lib/session'
import { applyTheme, getStoredTheme, ThemeMode } from '../lib/theme'
import { RoleUtilisateur } from '../types'

type MenuItem = {
  href: string
  label: string
  icone: IconName
  ressource?: PermissionRessource
  action?: 'voir'
  roles?: RoleUtilisateur[]
}

const MENU_ITEMS: MenuItem[] = [
  { href: '/tableau-de-bord', label: 'Tableau de bord', icone: 'chart', ressource: 'stats', action: 'voir' },
  { href: '/documents', label: 'Documents', icone: 'folder', ressource: 'documents', action: 'voir' },
  { href: '/recherche', label: 'Recherche avancée', icone: 'search', ressource: 'documents', action: 'voir' },
  { href: '/clients', label: 'Clients', icone: 'building', ressource: 'documents', action: 'voir' },
  {
    href: '/utilisateurs',
    label: 'Utilisateurs',
    icone: 'users',
    ressource: 'utilisateurs',
    action: 'voir',
    roles: [RoleUtilisateur.ADMIN, RoleUtilisateur.ARCHIVISTE],
  },
]

export function Navigation() {
  const cheminActuel = usePathname()
  const utilisateur = useUtilisateurCourant()
  const role = utilisateur?.role ?? null
  const router = useRouter()

  // Gestion du thème utilisateur
  const [theme, setTheme] = React.useState<ThemeMode>(() => getStoredTheme() ?? 'light')

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Optionnel : synchroniser avec le rôle au premier chargement
  useEffect(() => {
    if (!getStoredTheme()) {
      if (role === RoleUtilisateur.ADMIN || role === RoleUtilisateur.ARCHIVISTE) {
        setTheme('dark')
      } else {
        setTheme('light')
      }
    }
    // eslint-disable-next-line
  }, [role])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const elementsMenu = useMemo(() => {
    if (role === RoleUtilisateur.CONSULTANT) {
      return []
    }

    return MENU_ITEMS.filter((item) => {
      if (item.roles && (!role || !item.roles.includes(role))) {
        return false
      }

      if (item.ressource) {
        const action = item.action ?? 'voir'
        return hasPermission(role, item.ressource, action)
      }

      return true
    })
  }, [role])

  const gererDeconnexion = () => {
    supprimerSession()
    router.push('/connexion')
  }

  return (
    <nav className="bg-theme-card border-b border-theme shadow-sm transition-colors">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 text-theme-primary">
          {/* Logo et titre ACS */}
          <Link href="/tableau-de-bord" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
              A
            </div>
            <div>
              <div className="text-lg font-bold text-theme-primary">ACS Archive</div>
              <div className="text-xs text-theme-secondary">Gestion d'archives</div>
            </div>
          </Link>

          {/* Menu de navigation */}
          <div className="hidden md:flex items-center gap-1">
            {role === RoleUtilisateur.CONSULTANT ? (
              <Link
                href="/assistant-demo"
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${cheminActuel === '/assistant-demo' ? 'text-white' : 'text-theme-secondary hover:bg-theme-muted'}
                `}
                style={cheminActuel === '/assistant-demo' ? { background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' } : {}}
              >
                <Icon name="sparkles" size="sm" className="mr-2" />
                Assistant Documents
              </Link>
            ) : (
              <>
                {elementsMenu.map((element) => {
                  const estActif = cheminActuel === element.href
                  return (
                    <Link
                      key={element.href}
                      href={element.href}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-colors
                        ${
                          estActif
                            ? 'text-white'
                            : 'text-theme-secondary hover:bg-theme-muted'
                        }
                      `}
                      style={estActif ? { background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' } : {}}
                    >
                      <Icon name={element.icone} size="sm" className="mr-2" />
                      {element.label}
                    </Link>
                  )
                })}

                {role === RoleUtilisateur.ADMIN && (
                  <Link
                    href="/assistant-demo"
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-colors
                      ${cheminActuel === '/assistant-demo' ? 'text-white' : 'text-theme-secondary hover:bg-theme-muted'}
                    `}
                    style={cheminActuel === '/assistant-demo' ? { background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' } : {}}
                  >
                    <Icon name="sparkles" size="sm" className="mr-2" />
                    Assistant Documents
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Bouton thème */}
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-theme-secondary rounded-lg hover:bg-theme-muted transition-colors"
            title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size="sm" />
            <span className="hidden md:inline">{theme === 'dark' ? 'Clair' : 'Sombre'}</span>
          </button>

          {/* Menu utilisateur */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Link
                href="/parametres"
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-theme-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' }}>
                  {(utilisateur?.prenom?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-theme-primary">
                    {utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : 'Utilisateur'}
                  </div>
                  <div className="text-xs text-theme-secondary">
                    {utilisateur ? roleToLabel(utilisateur.role) : 'Profil'}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={gererDeconnexion}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-theme-secondary rounded-lg hover:bg-theme-muted transition-colors"
              >
                <Icon name="logout" size="sm" />
                <span className="hidden md:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

function roleToLabel(role: RoleUtilisateur): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrateur'
    case 'ARCHIVISTE':
      return 'Archiviste'
    case 'CONSULTANT':
      return 'Consultant'
    default:
      return role
  }
}
