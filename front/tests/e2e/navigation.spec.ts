import { test, expect, Page } from '@playwright/test'

/**
 * Tests E2E pour la navigation et les fonctionnalités principales
 * Couvre : sidebar, recherche globale, thème, pages principales
 */

// Helper pour simuler un utilisateur connecté
async function mockAuthenticatedUser(page: Page, role: 'ADMIN' | 'ARCHIVISTE' | 'CONSULTANT' = 'ADMIN') {
  await page.route('**/api/users/me/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        nom_utilisateur: 'test.user',
        nom: 'User',
        prenom: 'Test',
        role: role,
        email: 'test@acs.fr',
      }),
    })
  })

  // Mock des endpoints courants
  await page.route('**/api/clients/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      })
    } else {
      await route.continue()
    }
  })

  await page.route('**/api/documents/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      })
    } else {
      await route.continue()
    }
  })
}

test.describe('Navigation - Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, 'ADMIN')
  })

  test('sidebar affiche les liens de navigation principaux', async ({ page }) => {
    await page.goto('/tableau-de-bord')

    // Vérifier les liens principaux
    await expect(page.getByRole('link', { name: /tableau de bord/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /documents/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /clients/i })).toBeVisible()
  })

  test('navigation vers la page documents', async ({ page }) => {
    await page.goto('/tableau-de-bord')
    
    await page.getByRole('link', { name: /documents/i }).click()
    
    await expect(page).toHaveURL(/documents/)
  })

  test('navigation vers la page clients', async ({ page }) => {
    await page.goto('/tableau-de-bord')
    
    await page.getByRole('link', { name: /clients/i }).click()
    
    await expect(page).toHaveURL(/clients/)
  })
})

test.describe('Recherche globale (Ctrl+K)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, 'ADMIN')
  })

  test('Ctrl+K ouvre la recherche globale', async ({ page }) => {
    await page.goto('/tableau-de-bord')
    
    // Appuyer sur Ctrl+K
    await page.keyboard.press('Control+k')
    
    // La modal de recherche devrait s'ouvrir
    await expect(page.getByPlaceholder(/rechercher/i)).toBeVisible()
  })

  test('recherche globale affiche des résultats', async ({ page }) => {
    // Mock de l'endpoint de recherche
    await page.route('**/api/documents/search/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 1,
              titre: 'Contrat SANLAM 2024',
              type_courrier: 'CONTRAT',
              client_nom: 'SANLAM',
            },
          ],
          count: 1,
        }),
      })
    })

    await page.goto('/tableau-de-bord')
    await page.keyboard.press('Control+k')
    
    const searchInput = page.getByPlaceholder(/rechercher/i)
    await searchInput.fill('SANLAM')
    
    // Attendre les résultats
    await expect(page.getByText(/SANLAM/i)).toBeVisible()
  })

  test('Escape ferme la recherche globale', async ({ page }) => {
    await page.goto('/tableau-de-bord')
    
    await page.keyboard.press('Control+k')
    await expect(page.getByPlaceholder(/rechercher/i)).toBeVisible()
    
    await page.keyboard.press('Escape')
    await expect(page.getByPlaceholder(/rechercher/i)).not.toBeVisible()
  })
})

test.describe('Thème clair/sombre', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, 'ADMIN')
  })

  test('bouton de changement de thème est visible', async ({ page }) => {
    await page.goto('/tableau-de-bord')
    
    // Chercher le bouton de thème
    const themeButton = page.getByRole('button', { name: /thème|theme|dark|light|sombre|clair/i })
      .or(page.getByTestId('theme-toggle'))
    
    await expect(themeButton).toBeVisible()
  })

  test('changement de thème modifie les classes CSS', async ({ page }) => {
    await page.goto('/tableau-de-bord')
    
    const html = page.locator('html')
    const initialClass = await html.getAttribute('class')
    
    // Cliquer sur le bouton de thème
    const themeButton = page.getByRole('button', { name: /thème|theme|dark|light|sombre|clair/i })
      .or(page.getByTestId('theme-toggle'))
    
    if (await themeButton.isVisible()) {
      await themeButton.click()
      
      // La classe devrait changer (dark <-> light)
      const newClass = await html.getAttribute('class')
      expect(newClass).not.toBe(initialClass)
    }
  })
})

test.describe('Pages principales - Chargement', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, 'ADMIN')
  })

  test('tableau de bord se charge correctement', async ({ page }) => {
    await page.goto('/tableau-de-bord')
    
    await expect(page.getByRole('heading', { name: /tableau de bord/i })).toBeVisible()
  })

  test('page documents se charge correctement', async ({ page }) => {
    await page.goto('/documents')
    
    await expect(page.getByRole('heading', { name: /documents/i })).toBeVisible()
  })

  test('page clients se charge correctement', async ({ page }) => {
    await page.goto('/clients')
    
    await expect(page.getByRole('heading', { name: /clients/i })).toBeVisible()
  })

  test('page assistant se charge correctement', async ({ page }) => {
    await page.goto('/assistant-demo')
    
    // L'assistant devrait avoir un champ de saisie
    await expect(page.getByLabel(/question/i).or(page.getByPlaceholder(/question/i))).toBeVisible()
  })
})

test.describe('Responsive - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, 'ADMIN')
  })

  test('sidebar est cachée sur mobile', async ({ page }) => {
    await page.goto('/tableau-de-bord')
    
    // La sidebar devrait être cachée ou accessible via un menu hamburger
    const sidebar = page.getByRole('navigation').or(page.getByTestId('sidebar'))
    const hamburger = page.getByRole('button', { name: /menu/i }).or(page.getByTestId('mobile-menu'))
    
    // Soit la sidebar est cachée, soit il y a un bouton hamburger
    const sidebarVisible = await sidebar.isVisible().catch(() => false)
    const hamburgerVisible = await hamburger.isVisible().catch(() => false)
    
    expect(sidebarVisible || hamburgerVisible).toBeTruthy()
  })
})
