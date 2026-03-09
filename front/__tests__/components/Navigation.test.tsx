// __tests__/components/Navigation.test.tsx
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Navigation } from '../../components/Navigation'
import { RoleUtilisateur } from '../../types'

// Mock Next.js router
const mockPush = jest.fn()
const mockPathname = '/documents'

jest.doMock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}))

// Mock user hook
const mockUseUtilisateurCourant = jest.fn()

jest.doMock('../../hooks/useUtilisateurCourant', () => ({
  useUtilisateurCourant: mockUseUtilisateurCourant,
}))

// Mock permissions
jest.doMock('../../lib/permissions', () => ({
  hasPermission: jest.fn(),
  canAccessSection: jest.fn(() => true),
}))

// Mock session
jest.doMock('../../lib/session', () => ({
  supprimerSession: jest.fn(),
}))

// Mock theme
jest.doMock('../../lib/theme', () => ({
  applyTheme: jest.fn(),
  getStoredTheme: jest.fn(() => 'light'),
  ThemeMode: {
    LIGHT: 'light',
    DARK: 'dark',
  },
}))

// Mock Icon component
jest.doMock('../../components/Icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}))

describe('Navigation Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()
  })

  describe('ADMIN role navigation', () => {
    beforeEach(() => {
      mockUseUtilisateurCourant.mockReturnValue({
        id: 1,
        role: RoleUtilisateur.ADMIN,
        nom: 'Admin User',
      })
    })

    it('should render all menu items for ADMIN', () => {
      render(<Navigation />)

      // Should show all menu items for admin
      expect(screen.getByText('Tableau de bord')).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Recherche avancée')).toBeInTheDocument()
      expect(screen.getByText('Clients')).toBeInTheDocument()
      expect(screen.getByText('Utilisateurs')).toBeInTheDocument()
      expect(screen.getByText('Stats LLM')).toBeInTheDocument()
    })

    it('should highlight active route', () => {
      render(<Navigation />)

      // Documents should be highlighted (current pathname is /documents)
      const documentsLink = screen.getByText('Documents').closest('a')
      expect(documentsLink).toHaveClass('bg-blue-600') // Active class
    })

    it('should handle logout functionality', async () => {
      render(<Navigation />)

      const logoutButton = screen.getByText('Déconnexion')
      fireEvent.click(logoutButton)

      // Should call session cleanup and redirect
      await waitFor(() => {
        expect(require('../../lib/session').supprimerSession).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/connexion')
      })
    })

    it('should handle theme switching', () => {
      render(<Navigation />)

      const themeToggle = screen.getByRole('button', { name: /thème/i })
      fireEvent.click(themeToggle)

      // Should call applyTheme
      expect(require('../../lib/theme').applyTheme).toHaveBeenCalled()
    })
  })

  describe('ARCHIVISTE role navigation', () => {
    beforeEach(() => {
      mockUseUtilisateurCourant.mockReturnValue({
        id: 2,
        role: RoleUtilisateur.ARCHIVISTE,
        nom: 'Archivist User',
      })
    })

    it('should show limited menu for ARCHIVISTE', () => {
      render(<Navigation />)

      // Should show most items but not Stats LLM
      expect(screen.getByText('Tableau de bord')).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Recherche avancée')).toBeInTheDocument()
      expect(screen.getByText('Clients')).toBeInTheDocument()
      expect(screen.getByText('Utilisateurs')).toBeInTheDocument()
      expect(screen.queryByText('Stats LLM')).not.toBeInTheDocument()
    })

    it('should show user info correctly', () => {
      render(<Navigation />)

      expect(screen.getByText('Archivist User')).toBeInTheDocument()
      expect(screen.getByText('ARCHIVISTE')).toBeInTheDocument()
    })
  })

  describe('CONSULTANT role navigation', () => {
    beforeEach(() => {
      mockUseUtilisateurCourant.mockReturnValue({
        id: 3,
        role: RoleUtilisateur.CONSULTANT,
        nom: 'Consultant User',
      })
    })

    it('should show minimal menu for CONSULTANT', () => {
      render(<Navigation />)

      // Should only show basic document access
      expect(screen.getByText('Tableau de bord')).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Recherche avancée')).toBeInTheDocument()
      expect(screen.getByText('Clients')).toBeInTheDocument()

      // Should not show admin-only items
      expect(screen.queryByText('Utilisateurs')).not.toBeInTheDocument()
      expect(screen.queryByText('Stats LLM')).not.toBeInTheDocument()
    })
  })

  describe('Unauthenticated state', () => {
    beforeEach(() => {
      mockUseUtilisateurCourant.mockReturnValue(null)
    })

    it('should handle unauthenticated state gracefully', () => {
      render(<Navigation />)

      // Should not crash and show minimal UI
      expect(screen.getByText('Connexion')).toBeInTheDocument()
    })
  })

  describe('Loading state', () => {
    beforeEach(() => {
      mockUseUtilisateurCourant.mockReturnValue({
        id: 1,
        role: RoleUtilisateur.ADMIN,
        nom: 'Admin User',
        chargement: true,
      })
    })

    it('should handle loading state', () => {
      render(<Navigation />)

      // Should render without crashing during loading
      expect(screen.getByText('Chargement...')).toBeInTheDocument()
    })
  })

  describe('Navigation interactions', () => {
    beforeEach(() => {
      mockUseUtilisateurCourant.mockReturnValue({
        id: 1,
        role: RoleUtilisateur.ADMIN,
        nom: 'Admin User',
      })
    })

    it('should navigate to different sections', () => {
      render(<Navigation />)

      const documentsLink = screen.getByText('Documents').closest('a')
      expect(documentsLink).toHaveAttribute('href', '/documents')

      const usersLink = screen.getByText('Utilisateurs').closest('a')
      expect(usersLink).toHaveAttribute('href', '/utilisateurs')
    })

    it('should show icons for menu items', () => {
      render(<Navigation />)

      // Should render icons for each menu item
      expect(screen.getByTestId('icon-chart')).toBeInTheDocument()
      expect(screen.getByTestId('icon-folder')).toBeInTheDocument()
      expect(screen.getByTestId('icon-search')).toBeInTheDocument()
      expect(screen.getByTestId('icon-users')).toBeInTheDocument()
    })

    it('should handle keyboard navigation', () => {
      render(<Navigation />)

      const firstLink = screen.getByText('Tableau de bord').closest('a')

      // Focus first link
      firstLink?.focus()
      expect(document.activeElement).toBe(firstLink)

      // Tab to next link
      fireEvent.keyDown(firstLink!, { key: 'Tab' })
      // This would test keyboard navigation if implemented
    })
  })

  describe('Responsive behavior', () => {
    beforeEach(() => {
      mockUseUtilisateurCourant.mockReturnValue({
        id: 1,
        role: RoleUtilisateur.ADMIN,
        nom: 'Admin User',
      })
    })

    it('should have responsive classes', () => {
      render(<Navigation />)

      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('lg:flex-col') // Responsive classes
    })

    it('should handle mobile menu toggle', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 500 })

      render(<Navigation />)

      // Should have mobile menu button (if implemented)
      const mobileMenuButton = screen.queryByLabelText(/menu/i)
      // This test depends on mobile menu implementation
    })
  })

  describe('Error handling', () => {
    it('should handle permission check errors gracefully', () => {
      // Mock permission check to throw error
      const mockHasPermission = require('../../lib/permissions').hasPermission
      mockHasPermission.mockImplementation(() => {
        throw new Error('Permission check failed')
      })

      mockUseUtilisateurCourant.mockReturnValue({
        id: 1,
        role: RoleUtilisateur.ADMIN,
        nom: 'Admin User',
      })

      // Should render without crashing
      expect(() => render(<Navigation />)).not.toThrow()
    })

    it('should handle theme errors gracefully', () => {
      const mockApplyTheme = require('../../lib/theme').applyTheme
      mockApplyTheme.mockImplementation(() => {
        throw new Error('Theme application failed')
      })

      mockUseUtilisateurCourant.mockReturnValue({
        id: 1,
        role: RoleUtilisateur.ADMIN,
        nom: 'Admin User',
      })

      render(<Navigation />)

      const themeButton = screen.getByRole('button', { name: /thème/i })
      expect(() => fireEvent.click(themeButton)).not.toThrow()
    })
  })
})
