// Composant de navigation principal
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useMemo } from 'react'
import { Icon, IconName } from './Icon'
import { RechercheGlobale } from './RechercheGlobale'
import { useUtilisateurCourant } from '@/hooks/useUtilisateurCourant'
import { canAccessSection, hasPermission, PermissionRessource } from '@/lib/permissions'
import { RoleUtilisateur } from '@/types'

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

  const elementsMenu = useMemo(() => {
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

  const peutRechercher = canAccessSection(role, 'documents')

  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo et titre ACS */}
          <Link href="/tableau-de-bord" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xl" style={{ background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' }}>
              A
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">ACS Archive</div>
              <div className="text-xs text-gray-500">Gestion d'archives</div>
            </div>
          </Link>

          {/* Menu de navigation */}
          <div className="hidden md:flex items-center gap-1">
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
                        : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                  style={estActif ? { background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' } : {}}
                >
                  <Icon name={element.icone} size="sm" className="mr-2" />
                  {element.label}
                </Link>
              )
            })}
          </div>

          {/* Menu utilisateur */}
          <div className="flex items-center gap-3">
            {peutRechercher ? <RechercheGlobale /> : null}
            <Link
              href="/parametres"
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' }}>
                {(utilisateur?.prenom?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-gray-900">
                  {utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : 'Utilisateur'}
                </div>
                <div className="text-xs text-gray-500">
                  {utilisateur ? roleToLabel(utilisateur.role) : 'Profil'}
                </div>
              </div>
            </Link>
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
