import type { AgentOSConnection } from '@/types/os'

/**
 * Get authorization headers for a specific connection
 * @param connection - The AgentOS connection object
 * @returns Authorization headers with Bearer token, or empty object if no valid connection
 */
export function getAuthHeadersForConnection(
  connection: AgentOSConnection | null
): Record<string, string> {
  if (!connection || !connection.apiKey) {
    console.warn('No connection or API key found. Please configure a connection in Settings.')
    return {}
  }

  return {
    Authorization: `Bearer ${connection.apiKey}`
  }
}

/**
 * Get authorization headers by connection ID
 * @param connectionId - The connection ID to get auth headers for
 * @param connections - List of connections from store
 * @returns Authorization headers with Bearer token, or empty object if not found
 */
export function getAuthHeadersById(
  connectionId: string | null,
  connections: AgentOSConnection[]
): Record<string, string> {
  if (!connectionId) {
    console.warn('No connection ID provided')
    return {}
  }

  const connection = connections.find((conn) => conn.id === connectionId)
  return getAuthHeadersForConnection(connection || null)
}
