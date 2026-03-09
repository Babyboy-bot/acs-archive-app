// __tests__/hooks/useRequireAuth.test.ts
import { renderHook } from '@testing-library/react'
import { useRequireAuth } from '../../hooks/useRequireAuth'

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/test',
}))

// Mock session utilities
jest.mock('../../lib/session', () => ({
  getToken: jest.fn(),
  sauvegarderSession: jest.fn(),
  supprimerSession: jest.fn(),
}))

describe('useRequireAuth Hook', () => {
  beforeEach(() => {
    mockPush.mockClear()
    jest.clearAllMocks()
  })

  it('should return loading state initially', () => {
    // Mock token check to simulate loading
    const mockGetToken = require('../../lib/session').getToken
    mockGetToken.mockReturnValue(null)

    const { result } = renderHook(() => useRequireAuth())

    // Initially should be loading
    expect(result.current.chargement).toBe(true)
  })

  it('should redirect to login when no token', async () => {
    const mockGetToken = require('../../lib/session').getToken
    mockGetToken.mockReturnValue(null)

    const { result, rerender } = renderHook(() => useRequireAuth())

    // Wait for effect to run
    await new Promise(resolve => setTimeout(resolve, 0))
    rerender()

    expect(result.current.estAuthentifie).toBe(false)
    expect(result.current.chargement).toBe(false)
    expect(mockPush).toHaveBeenCalledWith('/connexion')
  })

  it('should authenticate when token exists', async () => {
    const mockGetToken = require('../../lib/session').getToken
    mockGetToken.mockReturnValue('fake-token')

    const { result, rerender } = renderHook(() => useRequireAuth())

    // Wait for effect to run
    await new Promise(resolve => setTimeout(resolve, 0))
    rerender()

    expect(result.current.estAuthentifie).toBe(true)
    expect(result.current.chargement).toBe(false)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should handle token validation errors', async () => {
    const mockGetToken = require('../../lib/session').getToken
    mockGetToken.mockReturnValue('invalid-token')

    // Mock fetch to simulate API error
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid token' })
      })
    ) as jest.Mock

    const { result, rerender } = renderHook(() => useRequireAuth())

    // Wait for effect to run
    await new Promise(resolve => setTimeout(resolve, 0))
    rerender()

    expect(result.current.estAuthentifie).toBe(false)
    expect(result.current.chargement).toBe(false)
    expect(mockPush).toHaveBeenCalledWith('/connexion')
  })
})
