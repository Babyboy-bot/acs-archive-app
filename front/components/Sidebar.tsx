// Composant Sidebar de navigation
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon, IconName } from './Icon'
import { useUtilisateurCourant } from '../hooks/useUtilisateurCourant'
import { canAccessSection, hasPermission, PermissionRessource } from '../lib/permissions'
import { supprimerSession } from '../lib/session'
import { applyTheme, getStoredTheme, ThemeMode } from '../lib/theme'
import { RoleUtilisateur } from '../types'
import logo from '/acs-logo.svg'

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
  { href: '/recherche', label: 'Recherche', icone: 'search', ressource: 'documents', action: 'voir' },
  { href: '/clients', label: 'Clients', icone: 'building', ressource: 'documents', action: 'voir' },
  {
    href: '/utilisateurs',
    label: 'Utilisateurs',
    icone: 'users',
    ressource: 'utilisateurs',
    action: 'voir',
    roles: [RoleUtilisateur.ADMIN, RoleUtilisateur.ARCHIVISTE],
  },
  {
    href: '/admin-llm',
    label: 'Stats LLM',
    icone: 'bolt',
    roles: [RoleUtilisateur.ADMIN],
  },
]

type SidebarProps = {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const cheminActuel = usePathname()
  const utilisateur = useUtilisateurCourant()
  const role = utilisateur?.role ?? null
  const router = useRouter()

  // Gestion du thème utilisateur
  const [theme, setTheme] = React.useState<ThemeMode>(() => getStoredTheme() ?? 'light')

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Synchroniser avec le rôle au premier chargement
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

  const sidebarWidth = collapsed ? 'w-20' : 'w-64'

  return (
    <aside className={`${sidebarWidth} h-screen bg-theme-card border-r border-theme shadow-lg flex flex-col transition-all duration-300 fixed left-0 top-0 z-40`}>
      {/* Logo et titre */}
      <div className="p-4 border-b border-theme">
        <Link href="/tableau-de-bord" className="flex items-center gap-3">
          <div className="w-22 h-22 rounded-xl flex items-center justify-center text-white font-bold">
            <img src={logo.src} alt="logo" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <div className="text-lg font-bold text-theme-primary whitespace-nowrap">ACS Archive</div>
                <div className="text-xs text-theme-secondary whitespace-nowrap">Gestion d'archives</div>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Bouton toggle */}
      {onToggle && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 w-6 h-6 bg-theme-card border border-theme rounded-full flex items-center justify-center text-theme-secondary hover:text-theme-primary hover:bg-theme-muted transition-colors shadow-md"
        >
          <Icon name={collapsed ? 'arrow-right' : 'arrow-left'} size="xs" />
        </button>
      )}

      {/* Menu de navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-3 space-y-1">
          {role === RoleUtilisateur.CONSULTANT ? (
            <SidebarItem
              href="/assistant-demo"
              label="Assistant Documents"
              icone="sparkles"
              estActif={cheminActuel === '/assistant-demo'}
              collapsed={collapsed}
            />
          ) : (
            <>
              {elementsMenu.map((element) => (
                <SidebarItem
                  key={element.href}
                  href={element.href}
                  label={element.label}
                  icone={element.icone}
                  estActif={cheminActuel === element.href}
                  collapsed={collapsed}
                />
              ))}

              {role === RoleUtilisateur.ADMIN && (
                <SidebarItem
                  href="/assistant-demo"
                  label="Assistant IA"
                  icone="sparkles"
                  estActif={cheminActuel === '/assistant-demo'}
                  collapsed={collapsed}
                />
              )}
            </>
          )}
        </div>
      </nav>

      {/* Section bas de sidebar */}
      <div className="border-t border-theme p-3 space-y-2">
        {/* Bouton thème */}
        <button
          type="button"
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-theme-secondary rounded-lg hover:bg-theme-muted transition-colors ${collapsed ? 'justify-center' : ''}`}
          title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size="sm" />
          {!collapsed && <span>{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>}
        </button>

        {/* Paramètres */}
        <Link
          href="/parametres"
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-theme-secondary rounded-lg hover:bg-theme-muted transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <Icon name="settings" size="sm" />
          {!collapsed && <span>Paramètres</span>}
        </Link>

        {/* Profil utilisateur */}
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-theme-muted ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' }}>
            {(utilisateur?.prenom?.[0] ?? '?').toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-theme-primary truncate">
                {utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : 'Utilisateur'}
              </div>
              <div className="text-xs text-theme-secondary truncate">
                {utilisateur ? roleToLabel(utilisateur.role) : 'Profil'}
              </div>
            </div>
          )}
        </div>

        {/* Déconnexion */}
        <button
          type="button"
          onClick={gererDeconnexion}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <Icon name="logout" size="sm" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  )
}

type SidebarItemProps = {
  href: string
  label: string
  icone: IconName
  estActif: boolean
  collapsed: boolean
}

function SidebarItem({ href, label, icone, estActif, collapsed }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={`
        relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all
        ${collapsed ? 'justify-center' : ''}
        ${estActif
          ? 'text-white shadow-lg'
          : 'text-theme-secondary hover:bg-theme-muted hover:text-theme-primary'
        }
      `}
      style={estActif ? { background: 'linear-gradient(135deg, #D32027 0%, #0066B3 80%)' } : {}}
      title={collapsed ? label : undefined}
    >
      <Icon name={icone} size="sm" />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="whitespace-nowrap overflow-hidden"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {estActif && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"
          style={{ marginLeft: '-12px' }}
        />
      )}
    </Link>
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
