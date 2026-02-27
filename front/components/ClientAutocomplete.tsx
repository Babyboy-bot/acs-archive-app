'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetchJson } from '@/lib/api'
import { Icon } from './Icon'

type ClientSuggestion = {
  id: string
  nom: string
  numero_client?: string
  type?: string
}

interface ClientAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (client: ClientSuggestion) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Autocomplétion clients en temps réel
 * Permet de taper le début d'un nom de client et voir des suggestions
 */
export function ClientAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Tapez un nom de client...",
  className = "",
  disabled = false,
}: ClientAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchClients = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    setLoading(true)
    try {
      const { data } = await apiFetchJson<ClientSuggestion[]>(
        `/clients/?search=${encodeURIComponent(query)}&simple=1`
      )
      
      const clients = Array.isArray(data) ? data : []
      setSuggestions(clients.slice(0, 8))
      setIsOpen(clients.length > 0)
      setSelectedIndex(-1)
    } catch (error) {
      console.error('Erreur autocomplétion clients:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      searchClients(value)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [value, searchClients])

  const handleSelect = (client: ClientSuggestion) => {
    onChange(client.nom)
    setIsOpen(false)
    setSuggestions([])
    onSelect?.(client)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : 0)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="search" size="sm" className="text-gray-400" />
          )}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 
                        dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-auto">
          {suggestions.map((client, index) => (
            <button
              key={client.id}
              type="button"
              onClick={() => handleSelect(client)}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors
                ${index === selectedIndex 
                  ? 'bg-cyan-50 dark:bg-cyan-900/30' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }
                ${index !== suggestions.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}
              `}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 
                              flex items-center justify-center text-white text-sm font-medium">
                {client.nom.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white truncate">
                  {client.nom}
                </div>
                {client.numero_client && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Code: {client.numero_client}
                  </div>
                )}
              </div>
              {client.type && (
                <span className={`text-xs px-2 py-0.5 rounded-full
                  ${client.type === 'ENTREPRISE' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}
                >
                  {client.type === 'ENTREPRISE' ? 'Entreprise' : 'Particulier'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
