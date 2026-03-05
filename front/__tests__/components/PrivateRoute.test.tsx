// __tests__/components/PrivateRoute.test.tsx
import { render, screen } from '@testing-library/react'
import { PrivateRoute } from '../../components/PrivateRoute'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock session hooks
jest.mock('../../hooks/useUtilisateurCourant', () => ({
  useUtilisateurCourant: () => ({
    utilisateur: null,
    chargement: false,
  }),
}))

jest.mock('../../hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    estAuthentifie: false,
    chargement: false,
  }),
}))

describe('PrivateRoute', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('redirects to login when user is not authenticated', () => {
    render(
      <PrivateRoute>
        <div>Protected Content</div>
      </PrivateRoute>
    )

    expect(mockPush).toHaveBeenCalledWith('/connexion')
  })

  it('does not render children when not authenticated', () => {
    render(
      <PrivateRoute>
        <div>Protected Content</div>
      </PrivateRoute>
    )

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    // Mock authenticated state
    jest.mock('../../hooks/useUtilisateurCourant', () => ({
      useUtilisateurCourant: () => ({
        utilisateur: { id: 1, role: 'USER' },
        chargement: false,
      }),
    }))

    jest.mock('../../hooks/useRequireAuth', () => ({
      useRequireAuth: () => ({
        estAuthentifie: true,
        chargement: false,
      }),
    }))

    render(
      <PrivateRoute>
        <div>Protected Content</div>
      </PrivateRoute>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows loading state during authentication check', () => {
    jest.mock('../../hooks/useRequireAuth', () => ({
      useRequireAuth: () => ({
        estAuthentifie: false,
        chargement: true,
      }),
    }))

    render(
      <PrivateRoute>
        <div>Protected Content</div>
      </PrivateRoute>
    )

    // Should show loading or not render content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
