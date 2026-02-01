import { useEffect, type DependencyList } from 'react'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'

/**
 * React hook for Wails event listeners with automatic cleanup
 *
 * @param eventName - Name of the Wails event to listen for
 * @param handler - Callback function to handle the event data
 * @param deps - Optional dependency array (like useEffect)
 */
export function useWailsEvents<T>(
  eventName: string,
  handler: (data: T) => void,
  deps?: DependencyList
) {
  useEffect(() => {
    // Register the event listener
    EventsOn(eventName, handler)

    // Cleanup on unmount
    return () => {
      EventsOff(eventName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps ?? [eventName])
}
