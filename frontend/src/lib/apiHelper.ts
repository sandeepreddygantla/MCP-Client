/**
 * API Helper Utilities
 *
 * Provides helper functions for making API calls with connection-based auth
 */

import type { AgentOSConnection } from '@/types/os'
import { getAuthHeadersForConnection } from '@/lib/auth'
import { useStore } from '@/store'

/**
 * Get active connection info (endpoint + auth headers)
 * This is a helper that can be used in API functions
 */
export function getActiveConnectionInfo(): {
  endpoint: string | null
  authHeaders: Record<string, string>
  connection: AgentOSConnection | null
} {
  const store = useStore.getState()
  const connection = store.getActiveConnection()

  if (!connection) {
    // Fallback to legacy selectedEndpoint if no connection exists
    const legacyEndpoint = store.selectedEndpoint
    return {
      endpoint: legacyEndpoint || null,
      authHeaders: getAuthHeadersForConnection(null),
      connection: null
    }
  }

  return {
    endpoint: connection.endpoint,
    authHeaders: getAuthHeadersForConnection(connection),
    connection
  }
}

/**
 * Make an authenticated fetch request using the active connection
 */
export async function fetchWithConnection(
  urlPath: string,
  options?: RequestInit
): Promise<Response> {
  const { endpoint, authHeaders } = getActiveConnectionInfo()

  if (!endpoint) {
    throw new Error('No active connection. Please configure a connection.')
  }

  const url = `${endpoint}${urlPath}`

  return fetch(url, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      ...authHeaders
    }
  })
}
