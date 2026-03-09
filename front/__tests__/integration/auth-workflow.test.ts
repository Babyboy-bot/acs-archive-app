// __tests__/integration/auth-workflow.test.ts
import { apiFetchJson } from '../../lib/api'

// Mock fetch globally for integration tests
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock window.location globally
const mockLocation = { href: '' }
const locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue(mockLocation as any)

describe('Authentication Workflow Integration', () => {

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset location href
    mockLocation.href = ''
  })

  describe('Login Flow', () => {
    it('should handle successful login', async () => {
      // Mock successful login response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access: 'access-token-123',
          refresh: 'refresh-token-456',
          user: { id: 1, username: 'testuser', role: 'USER' }
        }),
      } as Response)

      // Mock successful user profile fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          role: 'USER',
          is_active: true
        }),
      } as Response)

      // This would typically be called from a login component
      const loginData = {
        username: 'testuser',
        password: 'password123'
      }

      // Simulate login API call
      const loginResponse = await apiFetchJson('/auth/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      })

      expect(loginResponse.response.ok).toBe(true)
      expect(loginResponse.data).toHaveProperty('access')
      expect(loginResponse.data).toHaveProperty('refresh')
      expect(loginResponse.data).toHaveProperty('user')

      // Verify the correct API call was made
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/auth/login/',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'content-type': 'application/json',
          }),
          body: JSON.stringify(loginData),
        })
      )
    })

    it('should handle login failure', async () => {
      // Mock failed login response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Invalid credentials',
          message: 'Username or password is incorrect'
        }),
      } as Response)

      const loginData = {
        username: 'wronguser',
        password: 'wrongpassword'
      }

      const loginResponse = await apiFetchJson('/auth/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      })

      expect(loginResponse.response.ok).toBe(false)
      expect(loginResponse.response.status).toBe(401)
      expect(loginResponse.data).toHaveProperty('error')
    })

    it('should handle network errors during login', async () => {
      // Mock network failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const loginData = {
        username: 'testuser',
        password: 'password123'
      }

      await expect(apiFetchJson('/auth/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      })).rejects.toThrow('Network error')
    })
  })

  describe('Token Refresh Flow', () => {
    it('should handle automatic token refresh on 401', async () => {
      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Token expired' }),
      } as Response)

      // Refresh call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access: 'new-access-token',
          refresh: 'new-refresh-token'
        }),
      } as Response)

      // Retry call succeeds with new token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: 'protected resource',
          success: true
        }),
      } as Response)

      // Attempt to access protected resource
      const result = await apiFetchJson('/api/protected/')

      expect(result.response.ok).toBe(true)
      expect(result.data).toEqual({
        data: 'protected resource',
        success: true
      })

      // Verify all calls were made
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://localhost:8000/api/api/protected/', expect.any(Object))
      expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://localhost:8000/api/auth/refresh/', expect.any(Object))
      expect(mockFetch).toHaveBeenNthCalledWith(3, 'http://localhost:8000/api/api/protected/', expect.any(Object))
    })

    it('should handle refresh failure and logout user', async () => {
      // Mock window.location for logout testing
      const mockLocation = { href: '' }
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
      })

      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Token expired' }),
      } as Response)

      // Refresh call fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Refresh token invalid' }),
      } as Response)

      // Attempt to access protected resource
      await expect(apiFetchJson('/api/protected/')).rejects.toThrow('Refresh token expiré')

      // Verify logout was triggered
      expect(mockLocation.href).toBe('/connexion')
    })
  })

  describe('Logout Flow', () => {
    it('should handle logout and cleanup', async () => {
      // Mock window methods for logout
      const mockLocation = { href: '' }
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
      })

      // Mock logout API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out successfully' }),
      } as Response)

      // Simulate logout call (this would typically be in a logout component)
      const logoutResponse = await apiFetchJson('/auth/logout/', {
        method: 'POST',
      })

      expect(logoutResponse.response.ok).toBe(true)
      expect(logoutResponse.data).toHaveProperty('message')

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/auth/logout/',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      )
    })
  })

  describe('Session Persistence', () => {
    it('should maintain session across requests', async () => {
      // Mock successful responses
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: 'session maintained' }),
      } as Response)

      // Make multiple requests
      const response1 = await apiFetchJson('/api/data1/')
      const response2 = await apiFetchJson('/api/data2/')

      expect(response1.response.ok).toBe(true)
      expect(response2.response.ok).toBe(true)

      // Verify cookies are included in all requests
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/api/data1/',
        expect.objectContaining({ credentials: 'include' })
      )
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/api/data2/',
        expect.objectContaining({ credentials: 'include' })
      )
    })
  })

  describe('Error Recovery', () => {
    it('should handle server errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      } as Response)

      const result = await apiFetchJson('/api/failing/')

      expect(result.response.ok).toBe(false)
      expect(result.response.status).toBe(500)
      expect(result.data).toHaveProperty('error')
    })
  })
})
