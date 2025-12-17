'use client'

import { useEffect, useState } from 'react'
import { apiFetchJson } from '@/lib/api'

interface QuotaStatus {
  limit: number
  tokens_used: number
  remaining: number
  percentage: number
  year_month: string
}

interface LlmQuotaIndicatorProps {
  isDark?: boolean
  showDetails?: boolean
}

export function LlmQuotaIndicator({ isDark = false, showDetails = true }: LlmQuotaIndicatorProps) {
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const response = await apiFetchJson<QuotaStatus>('assistant/llm/quota/')
        if (response.data) {
          setQuota(response.data)
          setError(false)
        }
      } catch (err) {
        console.warn('Impossible de charger le quota LLM:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchQuota()
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchQuota, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading || error || !quota) {
    return null
  }

  const rawPercentage =
    typeof quota.percentage === 'number' && Number.isFinite(quota.percentage)
      ? quota.percentage
      : 0
  const percentage = rawPercentage * 100
  const isWarning = percentage >= 80
  const isDanger = percentage >= 95

  // Sécuriser l'accès aux valeurs numériques pour éviter les erreurs runtime
  const remainingValue = typeof quota.remaining === 'number' && Number.isFinite(quota.remaining) ? quota.remaining : 0
  const limitValue = typeof quota.limit === 'number' && Number.isFinite(quota.limit) ? quota.limit : 0
  const remainingText = remainingValue.toLocaleString()
  const limitText = limitValue.toLocaleString()

  // Calcul de l'angle pour le cercle de progression (SVG)
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  // Couleurs selon le niveau
  const getColor = () => {
    if (isDanger) return isDark ? '#ef4444' : '#dc2626' // red-500/600
    if (isWarning) return isDark ? '#f59e0b' : '#d97706' // amber-500/600
    return isDark ? '#10b981' : '#059669' // emerald-500/600
  }

  const color = getColor()

  return (
    <div className="flex items-center gap-3">
      {/* Cercle de progression SVG */}
      <div className="relative w-10 h-10 flex-shrink-0">
        <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 40 40">
          {/* Cercle de fond */}
          <circle
            cx="20"
            cy="20"
            r={radius}
            stroke={isDark ? '#374151' : '#e5e7eb'}
            strokeWidth="3"
            fill="none"
          />
          {/* Cercle de progression */}
          <circle
            cx="20"
            cy="20"
            r={radius}
            stroke={color}
            strokeWidth="3"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease',
            }}
          />
        </svg>
        {/* Pourcentage au centre */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[10px] font-semibold"
            style={{ color }}
          >
            {Math.round(percentage)}%
          </span>
        </div>
      </div>

      {/* Détails textuels */}
      {showDetails && (
        <div className="flex flex-col min-w-0">
          <div className={`text-xs font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            Quota IA
          </div>
          <div className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {remainingText} / {limitText} tokens
          </div>
          {isDanger && (
            <div className="text-[10px] text-red-500 font-medium mt-0.5">
              Quota presque atteint
            </div>
          )}
        </div>
      )}
    </div>
  )
}
