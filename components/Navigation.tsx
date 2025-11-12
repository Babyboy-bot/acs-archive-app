// Composant de navigation principal
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

export function Navigation() {
  const cheminActuel = usePathname()

  const elementsMenu = [
    { href: '/tableau-de-bord', label: 'Tableau de bord', icone: '📊' },
    { href: '/recherche', label: 'Recherche', icone: '🔍' },
    { href: '/documents', label: 'Documents', icone: '📁' },
    { href: '/categories', label: 'Catégories', icone: '🏷️' },
    { href: '/utilisateurs', label: 'Utilisateurs', icone: '👥' },
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
                  <span className="mr-2">{element.icone}</span>
                  {element.label}
                </Link>
              )
            })}
          </div>

          {/* Menu utilisateur */}
          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>
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
