import { toast } from 'sonner'

import { APIRoutes } from './routes'

import { AgentDetails, Sessions, TeamDetails } from '@/types/os'
import { getAuthHeadersForConnection } from '@/lib/auth'
import { useStore } from '@/store'

/**
 * Get auth headers for active connection
 * Returns empty object if no connection is configured
 */
function getConnectionAuthHeaders(): Record<string, string> {
  const activeConnection = useStore.getState().getActiveConnection()
  return getAuthHeadersForConnection(activeConnection)
}

export const getAgentsAPI = async (
  endpoint: string
): Promise<AgentDetails[]> => {
  const url = APIRoutes.GetAgents(endpoint)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getConnectionAuthHeaders()
    })
    if (!response.ok) {
      toast.error(`Failed to fetch  agents: ${response.statusText}`)
      return []
    }
    const data = await response.json()
    return data
  } catch {
    toast.error('Error fetching  agents')
    return []
  }
}

export const getStatusAPI = async (base: string): Promise<number> => {
  const response = await fetch(APIRoutes.Status(base), {
    method: 'GET',
    headers: getConnectionAuthHeaders()
  })
  return response.status
}

export const getAllSessionsAPI = async (
  base: string,
  type: 'agent' | 'team',
  componentId: string,
  dbId: string
): Promise<Sessions | { data: [] }> => {
  try {
    const url = new URL(APIRoutes.GetSessions(base))
    url.searchParams.set('type', type)
    url.searchParams.set('component_id', componentId)
    url.searchParams.set('db_id', dbId)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: getConnectionAuthHeaders()
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { data: [] }
      }
      throw new Error(`Failed to fetch sessions: ${response.statusText}`)
    }
    return response.json()
  } catch {
    return { data: [] }
  }
}

export const getSessionAPI = async (
  base: string,
  type: 'agent' | 'team',
  sessionId: string,
  dbId?: string
) => {
  // build query string
  const queryParams = new URLSearchParams({ type })
  if (dbId) queryParams.append('db_id', dbId)

  const response = await fetch(
    `${APIRoutes.GetSession(base, sessionId)}?${queryParams.toString()}`,
    {
      method: 'GET',
      headers: getConnectionAuthHeaders()
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch session: ${response.statusText}`)
  }

  return response.json()
}

export const deleteSessionAPI = async (
  base: string,
  dbId: string,
  sessionId: string
) => {
  const queryParams = new URLSearchParams()
  if (dbId) queryParams.append('db_id', dbId)
  const response = await fetch(
    `${APIRoutes.DeleteSession(base, sessionId)}?${queryParams.toString()}`,
    {
      method: 'DELETE',
      headers: getConnectionAuthHeaders()
    }
  )
  return response
}

export const getTeamsAPI = async (endpoint: string): Promise<TeamDetails[]> => {
  const url = APIRoutes.GetTeams(endpoint)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getConnectionAuthHeaders()
    })
    if (!response.ok) {
      toast.error(`Failed to fetch  teams: ${response.statusText}`)
      return []
    }
    const data = await response.json()

    return data
  } catch {
    toast.error('Error fetching  teams')
    return []
  }
}

export const deleteTeamSessionAPI = async (
  base: string,
  teamId: string,
  sessionId: string
) => {
  const response = await fetch(
    APIRoutes.DeleteTeamSession(base, teamId, sessionId),
    {
      method: 'DELETE',
      headers: getConnectionAuthHeaders()
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to delete team session: ${response.statusText}`)
  }
  return response
}

// ============================================================================
// AGUI Protocol API Functions
// ============================================================================

/**
 * Check AGUI protocol support
 */
export const checkAGUISupportAPI = async (base: string): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.AGUIStatus(base), {
      method: 'GET',
      headers: getConnectionAuthHeaders()
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get AGUI status
 */
export const getAGUIStatusAPI = async (
  base: string
): Promise<Record<string, unknown>> => {
  try {
    const response = await fetch(APIRoutes.AGUIStatus(base), {
      method: 'GET',
      headers: getConnectionAuthHeaders()
    })

    if (!response.ok) {
      throw new Error(`AGUI status check failed: ${response.statusText}`)
    }

    return response.json()
  } catch {
    return { status: 'error' }
  }
}

/**
 * Discover AGUI-compatible agents
 */
export const discoverAGUIAgentsAPI = async (
  base: string
): Promise<AgentDetails[]> => {
  try {
    const response = await fetch(APIRoutes.GetAgents(base), {
      method: 'GET',
      headers: getConnectionAuthHeaders()
    })

    if (!response.ok) {
      toast.error(`Failed to discover agents: ${response.statusText}`)
      return []
    }

    const data = await response.json()

    // Handle different response formats
    if (Array.isArray(data)) {
      return data
    }

    if (data.agents && Array.isArray(data.agents)) {
      return data.agents
    }

    return []
  } catch {
    toast.error('Error discovering AGUI agents')
    return []
  }
}
