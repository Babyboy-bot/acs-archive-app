import { test, expect, Page } from '@playwright/test'

/**
 * Tests E2E pour l'authentification
 * Couvre : connexion, déconnexion, protection des routes, rôles
 */

// Helpers pour l'authentification
async function login(page: Page, username: string, password: string) {
  await page.goto('/connexion')
  await page.getByLabel('Nom d\'utilisateur').fill(username)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

async function mockLoginSuccess(page: Page, role: 'ADMIN' | 'ARCHIVISTE' | 'CONSULTANT' = 'ADMIN') {
  await page.route('**/api/auth/login/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'mock-jwt-token-12345',
        utilisateur: {
          id: 1,
          nomUtilisateur: 'test.user',
          nom: 'User',
          prenom: 'Test',
          role: role,
          email: 'test@acs.fr',
        },
      }),
    })
  })

  // Mock de /users/me/ pour la session
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
}

async function mockLoginFailure(page: Page) {
  await page.route('**/api/auth/login/', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        erreur: 'Identifiants invalides',
      }),
    })
  })
}

test.describe('Authentification', () => {
  test('affiche la page de connexion', async ({ page }) => {
    await page.goto('/connexion')
    
    await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible()
    await expect(page.getByLabel('Nom d\'utilisateur')).toBeVisible()
    await expect(page.getByLabel('Mot de passe')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  })

  test('connexion réussie redirige vers le tableau de bord', async ({ page }) => {
    await mockLoginSuccess(page, 'ADMIN')
    
    await login(page, 'test.user', 'password123')
    
    // Attendre la redirection
    await expect(page).toHaveURL(/tableau-de-bord/)
  })

  test('connexion échouée affiche un message d\'erreur', async ({ page }) => {
    await mockLoginFailure(page)
    
    await login(page, 'wrong.user', 'wrongpassword')
    
    // Vérifier le message d'erreur
    await expect(page.getByText(/identifiants invalides|erreur/i)).toBeVisible()
  })

  test('champs requis affichent une erreur si vides', async ({ page }) => {
    await page.goto('/connexion')
    
    // Cliquer sur le bouton sans remplir les champs
    await page.getByRole('button', { name: 'Se connecter' }).click()
    
    // Les champs HTML5 required devraient bloquer la soumission
    // ou un message d'erreur devrait s'afficher
    await expect(page.getByLabel('Nom d\'utilisateur')).toBeFocused()
  })
})

test.describe('Protection des routes', () => {
  test('route protégée redirige vers connexion si non authentifié', async ({ page }) => {
    // Mock de /users/me/ qui retourne 401
    await page.route('**/api/users/me/', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Non authentifié' }),
      })
    })

    await page.goto('/tableau-de-bord')
    
    // Devrait rediriger vers la page de connexion
    await expect(page).toHaveURL(/connexion/)
  })

  test('consultant ne peut pas accéder aux pages d\'administration', async ({ page }) => {
    await mockLoginSuccess(page, 'CONSULTANT')
    
    await page.goto('/utilisateurs')
    
    // Devrait afficher un message d'accès refusé ou rediriger
    await expect(page.getByText(/accès.*refusé|non autorisé|permission/i)).toBeVisible()
      .catch(() => expect(page).toHaveURL(/tableau-de-bord|connexion/))
  })
})

test.describe('Déconnexion', () => {
  test('déconnexion redirige vers la page de connexion', async ({ page }) => {
    await mockLoginSuccess(page, 'ADMIN')
    
    // Se connecter d'abord
    await login(page, 'test.user', 'password123')
    await expect(page).toHaveURL(/tableau-de-bord/)
    
    // Mock de la déconnexion
    await page.route('**/api/auth/logout/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })

    // Cliquer sur le bouton de déconnexion (dans le menu utilisateur)
    const userMenu = page.getByTestId('user-menu').or(page.getByRole('button', { name: /déconnexion|logout/i }))
    if (await userMenu.isVisible()) {
      await userMenu.click()
      const logoutButton = page.getByRole('button', { name: /déconnexion|logout/i })
        .or(page.getByRole('menuitem', { name: /déconnexion|logout/i }))
      await logoutButton.click()
    }
    
    // Devrait rediriger vers la connexion
    await expect(page).toHaveURL(/connexion/)
  })
})
