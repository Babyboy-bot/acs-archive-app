'use client'

import { useState, useEffect } from 'react'
import { Icon } from './Icon'

interface OnboardingGuideProps {
  onClose: () => void
  autoShow?: boolean
}

export function OnboardingGuide({ onClose, autoShow = false }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(autoShow)

  useEffect(() => {
    if (autoShow) {
      setIsVisible(true)
    }
  }, [autoShow])

  const steps = [
    {
      title: 'Bienvenue dans l\'Assistant ACS',
      icon: 'sparkles' as const,
      content: (
        <div className="space-y-4">
          <p className="text-theme-secondary">
            L'assistant IA vous aide à trouver rapidement vos documents et à obtenir des informations sur vos archives.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">💡 Ce que vous pouvez faire :</h4>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>✅ Rechercher des documents par client, année, type ou risque</li>
              <li>✅ Poser des questions sur vos archives</li>
              <li>✅ Obtenir des statistiques et des insights</li>
              <li>✅ Comparer des documents entre eux</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: 'Comment utiliser l\'assistant',
      icon: 'document' as const,
      content: (
        <div className="space-y-4">
          <p className="text-theme-secondary">
            Posez vos questions de manière naturelle, comme si vous parliez à un collègue.
          </p>
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-green-900 mb-1">✅ Exemples de bonnes questions :</p>
              <ul className="text-sm text-green-800 space-y-1 ml-4">
                <li>• "Avenant N° 0529 2024 de 3CB risque MRP"</li>
                <li>• "Avenant divers 2025 de 3CB risque santé"</li>
                <li>• "Combien de documents a le client 2FZ ?"</li>
                <li>• "Montre-moi les sinistres de l'année dernière"</li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-amber-900 mb-1">⚠️ Évitez les questions trop vagues :</p>
              <ul className="text-sm text-amber-800 space-y-1 ml-4">
                <li>• "Montre-moi des documents" (quel client ? quelle année ?)</li>
                <li>• "Qu'est-ce que tu peux faire ?" (utilisez plutôt des exemples concrets)</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Comprendre votre quota IA',
      icon: 'clock' as const,
      content: (
        <div className="space-y-4">
          <p className="text-theme-secondary">
            L'assistant utilise une IA avancée qui consomme des "tokens" (unités de calcul). Vous disposez d'un quota mensuel pour garantir un usage équitable.
          </p>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-900 mb-2">📊 Votre quota mensuel :</h4>
            <ul className="space-y-2 text-sm text-purple-800">
              <li>• <strong>30 000 tokens par mois</strong> (environ 150-200 questions)</li>
              <li>• Le cercle de progression dans la sidebar vous indique votre consommation</li>
              <li>• Le quota se réinitialise automatiquement chaque mois</li>
            </ul>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">💰 Comment économiser vos tokens :</h4>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Soyez précis dans vos questions (client, année, type de document)</li>
              <li>• Utilisez la recherche avancée pour les recherches simples</li>
              <li>• Évitez de reformuler la même question plusieurs fois</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: 'Que se passe-t-il si mon quota est atteint ?',
      icon: 'check' as const,
      content: (
        <div className="space-y-4">
          <p className="text-theme-secondary">
            Pas de panique ! Vous gardez toujours accès à vos archives.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">✅ Continuité de service garantie :</h4>
            <ul className="space-y-2 text-sm text-green-800">
              <li>• La <strong>recherche avancée</strong> reste toujours disponible</li>
              <li>• Vous pouvez consulter, télécharger et imprimer tous vos documents</li>
              <li>• L'assistant bascule automatiquement en mode recherche simple</li>
              <li>• Votre quota se réinitialise le 1er de chaque mois</li>
            </ul>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>💡 Astuce :</strong> Si vous atteignez votre quota, utilisez la recherche avancée avec des filtres précis (client, année, type) pour trouver rapidement vos documents.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Prêt à commencer !',
      icon: 'star' as const,
      content: (
        <div className="space-y-4">
          <p className="text-theme-secondary">
            Vous êtes maintenant prêt à utiliser l'assistant ACS de manière optimale.
          </p>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">🎯 Récapitulatif :</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✅ Posez des questions précises avec client, année et type de document</li>
              <li>✅ Surveillez votre quota dans la sidebar (cercle de progression)</li>
              <li>✅ Utilisez la recherche avancée pour économiser vos tokens</li>
              <li>✅ Pas de stress : la recherche reste toujours disponible</li>
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>📚 Besoin d'aide ?</strong> Retrouvez ce guide à tout moment dans le menu <strong>Aide</strong> (icône ⓘ en haut à droite).
            </p>
          </div>
        </div>
      ),
    },
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleClose = () => {
    setIsVisible(false)
    onClose()
  }

  if (!isVisible) return null

  const step = steps[currentStep]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-card rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Icon name={step.icon} size="lg" className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{step.title}</h2>
                <p className="text-sm text-blue-100">
                  Étape {currentStep + 1} sur {steps.length}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Fermer"
            >
              <Icon name="close" size="sm" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-white/20 rounded-full h-2 mt-4">
            <div
              className="bg-white rounded-full h-2 transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
          {step.content}
        </div>

        {/* Footer */}
        <div className="border-t border-theme p-4 flex items-center justify-between bg-theme-base">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentStep === 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-theme-primary hover:bg-theme-card'
            }`}
          >
            <Icon name="chevron-left" size="sm" />
            Précédent
          </button>

          <div className="flex gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-blue-600 w-8'
                    : index < currentStep
                      ? 'bg-blue-400'
                      : 'bg-gray-300'
                }`}
                aria-label={`Aller à l'étape ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {currentStep === steps.length - 1 ? 'Commencer' : 'Suivant'}
            <Icon name="chevron-right" size="sm" />
          </button>
        </div>
      </div>
    </div>
  )
}
