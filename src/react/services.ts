import { useEffect, useSyncExternalStore } from 'react'
import type { Service } from '../core/services.js'

/** The value, live, WITHOUT holding the service: for a reader that must not be what keeps it running. */
export function useServiceValue<T>(service: Service<T>): T {
  return useSyncExternalStore(service.subscribe, service.now, service.now)
}

/** The value, live, and the service held for as long as this is mounted. */
export function useService<T>(service: Service<T>): T {
  useEffect(() => service.hold(), [service])
  return useServiceValue(service)
}
