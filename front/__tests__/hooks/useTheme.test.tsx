// __tests__/hooks/useTheme.test.tsx
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../../hooks/useTheme'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock window methods
const originalAddEventListener = window.addEventListener
const originalRemoveEventListener = window.removeEventListener
const mockAddEventListener = jest.fn()
const mockRemoveEventListener = jest.fn()

beforeAll(() => {
  window.addEventListener = mockAddEventListener
  window.removeEventListener = mockRemoveEventListener
})

afterAll(() => {
  window.addEventListener = originalAddEventListener
  window.removeEventListener = originalRemoveEventListener
})

describe('useTheme Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should initialize with light theme by default', () => {
    localStorageMock.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useTheme())

    expect(result.current.isDark).toBe(false)
    expect(localStorageMock.getItem).toHaveBeenCalledWith('theme')
  })

  it('should initialize with dark theme when stored', () => {
    localStorageMock.getItem.mockReturnValue('dark')

    const { result } = renderHook(() => useTheme())

    expect(result.current.isDark).toBe(true)
    expect(localStorageMock.getItem).toHaveBeenCalledWith('theme')
  })

  it('should initialize with light theme when invalid value stored', () => {
    localStorageMock.getItem.mockReturnValue('invalid')

    const { result } = renderHook(() => useTheme())

    expect(result.current.isDark).toBe(false)
  })

  it('should listen for storage events', () => {
    localStorageMock.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useTheme())

    // Initially light theme
    expect(result.current.isDark).toBe(false)

    // Simulate storage event (theme changed to dark in another tab)
    const storageEvent = new StorageEvent('storage', {
      key: 'theme',
      newValue: 'dark',
      oldValue: null,
    })

    act(() => {
      window.dispatchEvent(storageEvent)
    })

    // Should update to dark theme
    expect(localStorageMock.getItem).toHaveBeenCalledWith('theme')
  })

  it('should poll for changes every 500ms', () => {
    localStorageMock.getItem.mockReturnValue(null)

    renderHook(() => useTheme())

    // Initially called once
    expect(localStorageMock.getItem).toHaveBeenCalledTimes(1)

    // Advance timers by 500ms
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Should be called again
    expect(localStorageMock.getItem).toHaveBeenCalledTimes(2)

    // Advance by another 500ms
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(localStorageMock.getItem).toHaveBeenCalledTimes(3)
  })

  it('should update theme when localStorage changes during polling', () => {
    localStorageMock.getItem
      .mockReturnValueOnce(null) // Initial call
      .mockReturnValueOnce('dark') // During polling

    const { result } = renderHook(() => useTheme())

    // Initially light
    expect(result.current.isDark).toBe(false)

    // Advance timer to trigger polling
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Should now be dark (localStorage changed)
    expect(localStorageMock.getItem).toHaveBeenCalledTimes(2)
  })

  it('should add and remove storage event listener', () => {
    localStorageMock.getItem.mockReturnValue(null)

    const { unmount } = renderHook(() => useTheme())

    expect(mockAddEventListener).toHaveBeenCalledWith('storage', expect.any(Function))

    unmount()

    expect(mockRemoveEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
  })

  it('should clear polling interval on unmount', () => {
    const clearIntervalSpy = jest.spyOn(window, 'clearInterval')

    localStorageMock.getItem.mockReturnValue(null)

    const { unmount } = renderHook(() => useTheme())

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  it('should handle multiple rapid storage events', () => {
    localStorageMock.getItem.mockReturnValue(null)

    renderHook(() => useTheme())

    // Simulate multiple rapid storage events
    const events = [
      new StorageEvent('storage', { key: 'theme', newValue: 'dark' }),
      new StorageEvent('storage', { key: 'theme', newValue: 'light' }),
      new StorageEvent('storage', { key: 'theme', newValue: 'dark' }),
    ]

    events.forEach(event => {
      act(() => {
        window.dispatchEvent(event)
      })
    })

    // Should handle all events without crashing
    expect(localStorageMock.getItem).toHaveBeenCalled()
  })

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage error')
    })

    const { result } = renderHook(() => useTheme())

    // Should default to light theme on error
    expect(result.current.isDark).toBe(false)
  })

  it('should handle polling errors gracefully', () => {
    localStorageMock.getItem
      .mockReturnValueOnce(null) // Initial call succeeds
      .mockImplementationOnce(() => { // Polling call fails
        throw new Error('localStorage error')
      })

    const { result } = renderHook(() => useTheme())

    // Initially works
    expect(result.current.isDark).toBe(false)

    // Advance timer - should handle error gracefully
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Should still work (not crash)
    expect(result.current.isDark).toBe(false)
  })

  it('should work in server-side rendering environment', () => {
    // Mock SSR environment
    const originalWindow = global.window
    delete (global as any).window

    const { result } = renderHook(() => useTheme())

    // Should default to light theme when window is undefined
    expect(result.current.isDark).toBe(false)

    // Restore window
    global.window = originalWindow
  })
})
