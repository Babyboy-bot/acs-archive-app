// Composant de navigation principal
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { Icon, IconName } from './Icon'
import { RechercheGlobale } from './RechercheGlobale'

export function Navigation() {
  const cheminActuel = usePathname()

  const elementsMenu: Array<{ href: string; label: string; icone: IconName }> = [
    { href: '/tableau-de-bord', label: 'Tableau de bord', icone: 'chart' },
    { href: '/documents', label: 'Documents', icone: 'folder' },
    { href: '/recherche', label: 'Recherche avancée', icone: 'search' },
    { href: '/clients', label: 'Clients', icone: 'building' },
    { href: '/categories', label: 'Catégories', icone: 'tag' },
    { href: '/utilisateurs', label: 'Utilisateurs', icone: 'users' },
  ]

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
            <RechercheGlobale />
            <Link
              href="/parametres"
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: 'linear-gradient(135deg, #D32027 0%, #0066B3 100%)' }}>
                U
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-gray-900">Utilisateur</div>
                <div className="text-xs text-gray-500">Admin</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
