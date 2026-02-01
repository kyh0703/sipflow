import { EventsOn, EventsEmit, EventsOff } from '../../wailsjs/runtime/runtime'
import { EVENTS, type BackendReadyPayload } from '../types/events'

/**
 * Timeout for backend handshake (5 seconds)
 */
const HANDSHAKE_TIMEOUT = 5000

/**
 * Wait for Wails runtime to be available on window.runtime
 */
function waitForRuntime(timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.runtime) {
      resolve()
      return
    }

    const interval = 50
    let elapsed = 0
    const timer = setInterval(() => {
      elapsed += interval
      if (window.runtime) {
        clearInterval(timer)
        resolve()
      } else if (elapsed >= timeout) {
        clearInterval(timer)
        reject(new Error('Wails runtime not available'))
      }
    }, interval)
  })
}

/**
 * Initialize event handshake protocol with backend
 *
 * This prevents race conditions by:
 * 1. Wait for Wails runtime to be injected
 * 2. Frontend signals it's ready
 * 3. Backend responds when it's ready
 * 4. Promise resolves when handshake completes
 *
 * @returns Promise that resolves when backend acknowledges readiness
 * @throws Error if backend doesn't respond within timeout
 */
export async function initializeEventHandshake(): Promise<void> {
  await waitForRuntime(HANDSHAKE_TIMEOUT)

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      EventsOff(EVENTS.BACKEND_READY)
      reject(new Error('Backend handshake timeout: No response from backend'))
    }, HANDSHAKE_TIMEOUT)

    // Set up listener for backend ready
    EventsOn(EVENTS.BACKEND_READY, (data: BackendReadyPayload) => {
      clearTimeout(timeoutId)
      EventsOff(EVENTS.BACKEND_READY)
      console.log('Event handshake completed:', data)
      resolve()
    })

    // Signal frontend is ready
    EventsEmit(EVENTS.FRONTEND_READY, {
      timestamp: Date.now(),
    })

    console.log('Frontend ready signal sent, waiting for backend...')
  })
}
