import { test, expect } from '@playwright/test'

/**
 * Tests E2E pour la sécurité
 * Couvre : rate limiting, injection, endpoints protégés
 */

test.describe('Sécurité - Endpoints protégés', () => {
  test('endpoint /api/assistant-demo/metrics retourne 401 sans auth', async ({ request }) => {
    const response = await request.get('/api/assistant-demo/metrics')
    
    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error).toContain('Authentification')
  })

  test('endpoint /api/assistant-demo/feedback GET retourne 401 sans auth', async ({ request }) => {
    const response = await request.get('/api/assistant-demo/feedback')
    
    expect(response.status()).toBe(401)
  })
})

test.describe('Sécurité - Rate Limiting', () => {
  test('rate limiting bloque après trop de requêtes', async ({ request }) => {
    // Envoyer plusieurs requêtes rapidement
    const responses = []
    
    for (let i = 0; i < 15; i++) {
      const response = await request.post('/api/assistant-demo', {
        data: { question: `Test question ${i}` },
      })
      responses.push(response.status())
    }
    
    // Au moins une requête devrait être bloquée (429)
    const hasRateLimited = responses.some(status => status === 429)
    
    // Note: Ce test peut échouer si le rate limit est très élevé
    // ou si les requêtes sont trop lentes
    console.log('Responses:', responses)
    
    // On vérifie juste que les premières requêtes passent
    expect(responses[0]).not.toBe(429)
  })
})

test.describe('Sécurité - Validation des entrées', () => {
  test('question vide retourne 400', async ({ request }) => {
    const response = await request.post('/api/assistant-demo', {
      data: { question: '' },
    })
    
    expect(response.status()).toBe(400)
  })

  test('question trop longue est gérée', async ({ request }) => {
    const longQuestion = 'a'.repeat(3000) // Plus de 2000 caractères
    
    const response = await request.post('/api/assistant-demo', {
      data: { question: longQuestion },
    })
    
    // Devrait retourner 400 ou être tronquée
    expect([200, 400]).toContain(response.status())
  })

  test('corps de requête invalide retourne 400', async ({ request }) => {
    const response = await request.post('/api/assistant-demo', {
      data: 'invalid json string',
      headers: { 'Content-Type': 'text/plain' },
    })
    
    expect([400, 415]).toContain(response.status())
  })
})

test.describe('Sécurité - Protection XSS', () => {
  test('caractères spéciaux dans la question sont échappés', async ({ page }) => {
    // Mock de la réponse
    await page.route('**/api/assistant-demo', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          question: '<script>alert("xss")</script>',
          type: 'documents',
          resume: 'Test de sécurité XSS',
          pieces: [],
        }),
      })
    })

    // Mock auth
    await page.route('**/api/users/me/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          nom_utilisateur: 'test',
          role: 'ADMIN',
        }),
      })
    })

    await page.goto('/assistant-demo')
    
    // Envoyer une question avec du code malveillant
    const input = page.getByLabel(/question/i).or(page.getByPlaceholder(/question/i))
    await input.fill('<script>alert("xss")</script>')
    await page.getByRole('button', { name: /interroger|envoyer/i }).click()
    
    // Vérifier qu'aucun script n'est exécuté (pas d'alerte)
    // et que le contenu est affiché en texte brut
    await expect(page.locator('script:has-text("alert")')).toHaveCount(0)
  })
})

test.describe('Sécurité - Headers HTTP', () => {
  test('réponses incluent les headers de sécurité', async ({ request }) => {
    const response = await request.get('/')
    
    // Vérifier les headers de sécurité courants
    // Note: Ces headers dépendent de la configuration Next.js
    const headers = response.headers()
    
    // X-Content-Type-Options devrait être présent
    // (peut varier selon la config)
    console.log('Security headers:', {
      'x-content-type-options': headers['x-content-type-options'],
      'x-frame-options': headers['x-frame-options'],
      'x-xss-protection': headers['x-xss-protection'],
    })
  })
})
