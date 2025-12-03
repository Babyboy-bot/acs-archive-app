import { test, expect, Page, Route } from '@playwright/test'

type AssistantDocumentPiece = {
  id: string
  source: string
  content: string
  metadata: Record<string, unknown>
  score: number
}

type AssistantStatisticsPayload = {
  documents_par_mois: Record<string, number>
  top_categories: { categorie: string; compte: number }[]
  top_clients?: { client: string; compte: number }[]
  kpi?: {
    taux_conformite: number
    documents_en_retard: number
    alertes_peremption: number
  }
}

type AssistantResponsePayload = {
  question: string
  type: 'documents' | 'statistiques'
  resume: string
  pieces?: AssistantDocumentPiece[]
  statistiques?: AssistantStatisticsPayload
  insights?: string[]
  actions?: string[]
}

const reponseDocuments: AssistantResponsePayload = {
  question: 'Montre-moi la facture Sanlam du 14 mai 2025',
  type: 'documents',
  resume: 'Document identifié (type facture, client SANLAM). Contrat responsabilité civile 2024',
  pieces: [
    {
      id: 'doc-1',
      source: 'Contrat responsabilité civile 2024',
      content: 'Contrat responsabilité civile 2024\nClient : SANLAM\nRéférence : DOC-001',
      metadata: {
        client: 'SANLAM',
        categorie: 'Facturation',
        type: 'Facture',
        reference: 'DOC-001',
        highlights: ['Client : SANLAM', 'Catégorie : Facturation', 'Type : Facture'],
      },
      score: 0.97,
    },
  ],
  insights: ['Client le plus représenté : SANLAM (1 document).', 'Nombre de pièces pertinentes identifiées : 1.'],
  actions: ['Aucune action urgente détectée sur les pièces proposées. Vérifier que leur indexation reste à jour.'],
}

const reponseStatistiques: AssistantResponsePayload = {
  question: 'Combien de documents ce mois-ci ?',
  type: 'statistiques',
  resume: 'Taux de conformité : 95.0 %. Documents en retard : 2. Alertes de péremption : 1.',
  statistiques: {
    documents_par_mois: { '2025-04': 12, '2025-05': 18 },
    top_categories: [
      { categorie: 'Facturation', compte: 10 },
      { categorie: 'Responsabilité civile', compte: 6 },
    ],
    top_clients: [
      { client: 'SANLAM', compte: 8 },
      { client: 'Mutuelle Santé+', compte: 6 },
    ],
    kpi: {
      taux_conformite: 0.95,
      documents_en_retard: 2,
      alertes_peremption: 1,
    },
  },
  insights: ['Top clients : SANLAM (8), Mutuelle Santé+ (6).'],
  actions: ['Prioriser la réduction des documents en retard pour améliorer le taux de conformité.'],
}

async function mockAssistantResponse(page: Page, payload: AssistantResponsePayload) {
  await page.route('**/api/assistant-demo', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })
}

test.describe('Assistant IA – démo', () => {
  test('affiche une réponse documentaire avec pièces et insights', async ({ page }) => {
    await mockAssistantResponse(page, reponseDocuments)

    await page.goto('/assistant-demo')

    await page.getByLabel('Votre question').fill('Montre-moi la facture Sanlam du 14 mai 2025')
    await page.getByRole('button', { name: 'Interroger' }).click()

    await expect(page.getByRole('heading', { name: 'Synthèse documentaire' })).toBeVisible()
    const premierePiece = page.getByTestId('assistant-piece').first()
    await expect(premierePiece.getByText('Contrat responsabilité civile 2024', { exact: true })).toBeVisible()
    await expect(premierePiece.getByTestId('assistant-piece-metadata').filter({ hasText: 'Client : SANLAM' }).first()).toBeVisible()
    await expect(page.getByText('Document récent (fallback)')).toHaveCount(0)
    await expect(page.getByTestId('assistant-insights')).toContainText('Nombre de pièces pertinentes identifiées : 1.')
    await expect(page.getByTestId('assistant-actions')).toContainText('Aucune action urgente détectée')
  })

  test('affiche une réponse statistiques avec actions proposées', async ({ page }) => {
    await mockAssistantResponse(page, reponseStatistiques)

    await page.goto('/assistant-demo')

    await page.getByLabel('Votre question').fill('Combien de documents ce mois-ci ?')
    await page.getByRole('button', { name: 'Interroger' }).click()

    await expect(page.getByRole('heading', { name: 'Synthèse des indicateurs' })).toBeVisible()
    await expect(page.getByTestId('assistant-insights')).toContainText('Top clients : SANLAM (8), Mutuelle Santé+ (6).')
    await expect(page.getByTestId('assistant-actions')).toContainText('Prioriser la réduction des documents en retard')
  })
})
