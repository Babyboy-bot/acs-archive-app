// __tests__/lib/api.test.ts
import { buildApiUrl, apiFetch, apiFetchJson, ApiFetchOptions } from '../../lib/api'

// Mock dependencies
jest.mock('../../lib/session', () => ({
  API_BASE_URL: 'http://localhost:8000/api',
  getToken: jest.fn(),
}))

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('API Utilities', () => {

  beforeEach(() => {
    mockFetch.mockClear()
    jest.clearAllTimers()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================================
  // BUILD API URL FUNCTION
  // ============================================================================

  describe('buildApiUrl', () => {
    const originalEnv = process.env

    beforeEach(() => {
      // Mock environment
      process.env = { ...originalEnv }
      // Mock the session module
      jest.doMock('../../lib/session', () => ({
        API_BASE_URL: 'http://localhost:8000/api',
        getToken: jest.fn(),
      }))
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should return full URLs unchanged', () => {
      const fullUrl = 'https://api.example.com/endpoint'
      expect(buildApiUrl(fullUrl)).toBe(fullUrl)

      const httpUrl = 'http://localhost:3000/api/data'
      expect(buildApiUrl(httpUrl)).toBe(httpUrl)
    })

    it('should prepend API_BASE_URL to paths starting with slash', () => {
      expect(buildApiUrl('/documents')).toBe('http://localhost:8000/api/documents')
      expect(buildApiUrl('/auth/login')).toBe('http://localhost:8000/api/auth/login')
    })

    it('should prepend API_BASE_URL with slash to paths not starting with slash', () => {
      expect(buildApiUrl('documents')).toBe('http://localhost:8000/api/documents')
      expect(buildApiUrl('auth/login')).toBe('http://localhost:8000/api/auth/login')
    })

    it('should handle empty paths', () => {
      expect(buildApiUrl('')).toBe('http://localhost:8000/api/')
    })

    it('should handle paths with query parameters', () => {
      expect(buildApiUrl('/documents?page=1')).toBe('http://localhost:8000/api/documents?page=1')
      expect(buildApiUrl('search?q=test')).toBe('http://localhost:8000/api/search?q=test')
    })
  })

  // ============================================================================
  // API FETCH FUNCTION
  // ============================================================================

  describe('apiFetch', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response)
    })

    it('should call fetch with correct URL', async () => {
      await apiFetch('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({
          credentials: 'include',
        })
      )
    })

    it('should include custom options', async () => {
      const customOptions: ApiFetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      }

      await apiFetch('/test', customOptions)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Headers),
          body: JSON.stringify({ test: 'data' }),
          credentials: 'include',
        })
      )
    })

    it('should set longer timeout for FormData uploads', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test']))

      jest.useFakeTimers()

      const fetchPromise = apiFetch('/upload', {
        method: 'POST',
        body: formData,
      })

      // Fast-forward time to just before timeout
      jest.advanceTimersByTime(119000) // 119 seconds

      await fetchPromise

      expect(mockFetch).toHaveBeenCalled()
      jest.useRealTimers()
    }, 120000)

    it('should timeout after 20 seconds for regular requests', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      jest.useFakeTimers()

      const fetchPromise = apiFetch('/test')

      // Fast-forward past timeout
      jest.advanceTimersByTime(21000)

      await expect(fetchPromise).rejects.toThrow('La requête a pris trop de temps')
      jest.useRealTimers()
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network error')
      mockFetch.mockRejectedValue(networkError)

      await expect(apiFetch('/test')).rejects.toThrow('Network error')
    })

    it('should handle abort signals', async () => {
      const abortController = new AbortController()
      abortController.abort()

      // Mock fetch to never resolve so we can test timeout/abort
      mockFetch.mockImplementation(() => new Promise(() => {}))

      await expect(apiFetch('/test', { signal: abortController.signal }))
        .rejects.toThrow('The operation was aborted')
    })

    it('should override default credentials when specified', async () => {
      await apiFetch('/test', { credentials: 'same-origin' })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({
          credentials: 'same-origin',
        })
      )
    })
  })

  // ============================================================================
  // API FETCH JSON FUNCTION
  // ============================================================================

  describe('apiFetchJson', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test', success: true }),
      } as Response)
    })

    it('should return response and parsed JSON data', async () => {
      const result = await apiFetchJson('/test')

      expect(result.response).toBeDefined()
      expect(result.data).toEqual({ data: 'test', success: true })
    })

    it('should handle responses without JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Invalid JSON') },
      } as unknown as Response)

      const result = await apiFetchJson('/test')

      expect(result.response).toBeDefined()
      expect(result.data).toBeUndefined()
    })

    it('should handle 401 errors and attempt token refresh', async () => {
      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response)

      // Refresh call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access: 'new-token', refresh: 'new-refresh' }),
      } as Response)

      // Retry call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'refreshed' }),
      } as Response)

      const result = await apiFetchJson('/protected')

      expect(mockFetch).toHaveBeenCalledTimes(3) // Original, refresh, retry
      expect(result.data).toEqual({ data: 'refreshed' })
    })

    it('should logout on refresh failure', async () => {
      // Mock window for logout function
      const mockLocation = { href: '' }
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
      })

      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response)

      // Refresh call fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Refresh failed' }),
      } as Response)

      await expect(apiFetchJson('/protected')).rejects.toThrow('Refresh token expiré')

      expect(mockLocation.href).toBe('/connexion')
    })

    it('should not attempt refresh for refresh endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as unknown as Response)

      const result = await apiFetchJson('/auth/refresh/')

      expect(result.response.status).toBe(401)
      expect(mockFetch).toHaveBeenCalledTimes(1) // No refresh attempt
    })

    it('should not attempt refresh when skipAuth is true', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as unknown as Response)

      const result = await apiFetchJson('/test', { skipAuth: true })

      expect(result.response.status).toBe(401)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not attempt refresh on retry attempts', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as unknown as Response)

      const result = await apiFetchJson('/test', { isRetry: true })

      expect(result.response.status).toBe(401)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should handle refresh network errors', async () => {
      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as unknown as Response)

      // Refresh call fails with network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(apiFetchJson('/protected')).rejects.toThrow('Network error')
    })

    it('should pass through successful non-401 responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as unknown as Response)

      const result = await apiFetchJson('/test')

      expect(result.response.status).toBe(200)
      expect(result.data).toEqual({ success: true })
    })

    it('should pass through error responses without attempting refresh', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      } as unknown as Response)

      const result = await apiFetchJson('/not-found')

      expect(result.response.status).toBe(404)
      expect(result.data).toEqual({ error: 'Not found' })
      expect(mockFetch).toHaveBeenCalledTimes(1) // No refresh attempt
    })
  })
})
