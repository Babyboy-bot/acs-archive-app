/**
 * API Endpoint pour le feedback utilisateur sur les réponses de l'assistant
 * 
 * POST /api/assistant-demo/feedback
 * Body: { interactionId: string, feedback: 'like' | 'dislike', comment?: string }
 */

import { NextResponse } from 'next/server'
import { processFeedbackRequest, getLearningStats } from '../learning'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const { interactionId, feedback, comment } = body
    
    if (!interactionId || !feedback) {
      return NextResponse.json(
        { error: 'interactionId et feedback sont requis' },
        { status: 400 }
      )
    }
    
    if (!['like', 'dislike'].includes(feedback)) {
      return NextResponse.json(
        { error: 'feedback doit être "like" ou "dislike"' },
        { status: 400 }
      )
    }
    
    const result = processFeedbackRequest({
      interactionId,
      feedback,
      comment,
    })
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: result.message,
      })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Erreur feedback:', error)
    return NextResponse.json(
      { error: 'Erreur lors du traitement du feedback' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/assistant-demo/feedback
 * Retourne les statistiques d'apprentissage (pour admin)
 */
export async function GET(request: Request) {
  // Vérifier l'autorisation (simplifiée ici)
  const authorization = request.headers.get('authorization')
  if (!authorization) {
    return NextResponse.json(
      { error: 'Autorisation requise' },
      { status: 401 }
    )
  }
  
  try {
    const stats = getLearningStats()
    
    return NextResponse.json({
      success: true,
      stats: {
        totalInteractions: stats.totalInteractions,
        feedbackRates: {
          positive: `${(stats.positiveRate * 100).toFixed(1)}%`,
          negative: `${(stats.negativeRate * 100).toFixed(1)}%`,
          neutral: `${(stats.neutralRate * 100).toFixed(1)}%`,
        },
        topPatterns: stats.mostAskedPatterns.slice(0, 5).map(p => ({
          pattern: p.pattern,
          frequency: p.frequency,
          score: p.avgFeedbackScore.toFixed(2),
        })),
        improvementSuggestions: stats.improvementSuggestions,
      },
    })
  } catch (error) {
    console.error('Erreur stats learning:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
