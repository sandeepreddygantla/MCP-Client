/**
 * Connection Manager Utility
 *
 * Provides helper functions for managing AgentOS connections,
 * including validation, migration, and helper utilities.
 */

import type {
  AgentOSConnection,
  CreateConnectionInput,
  ConnectionEnvironment
} from '@/types/os'
import { isValidUrl } from '@/lib/utils'

/**
 * Validate connection input
 */
export function validateConnectionInput(
  input: CreateConnectionInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate name
  if (!input.name || input.name.trim().length === 0) {
    errors.push('Connection name is required')
  }
  if (input.name && input.name.length > 100) {
    errors.push('Connection name must be less than 100 characters')
  }

  // Validate endpoint
  if (!input.endpoint || input.endpoint.trim().length === 0) {
    errors.push('Endpoint URL is required')
  } else if (!isValidUrl(input.endpoint)) {
    errors.push('Endpoint must be a valid URL')
  } else {
    // Check for trailing slashes
    if (input.endpoint.endsWith('/')) {
      errors.push('Endpoint URL should not end with a trailing slash')
    }
  }

  // Validate API key
  if (!input.apiKey || input.apiKey.trim().length === 0) {
    errors.push('API key is required')
  }
  if (input.apiKey && input.apiKey.length < 10) {
    errors.push('API key seems invalid (too short)')
  }

  // Validate environment
  if (!input.environment) {
    errors.push('Environment type is required')
  }
  if (
    input.environment &&
    !['local', 'live'].includes(input.environment)
  ) {
    errors.push('Environment must be either "local" or "live"')
  }

  // Validate tags (optional)
  if (input.tags) {
    if (input.tags.some((tag) => tag.length > 50)) {
      errors.push('Tags must be less than 50 characters each')
    }
    if (input.tags.length > 10) {
      errors.push('Maximum 10 tags allowed')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Normalize endpoint URL
 * - Remove trailing slashes
 * - Ensure valid protocol
 */
export function normalizeEndpoint(endpoint: string): string {
  let normalized = endpoint.trim()

  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  // Ensure protocol exists
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `http://${normalized}`
  }

  return normalized
}

/**
 * Detect environment type from endpoint
 */
export function detectEnvironment(endpoint: string): ConnectionEnvironment {
  const normalized = normalizeEndpoint(endpoint)

  if (
    normalized.includes('localhost') ||
    normalized.includes('127.0.0.1') ||
    normalized.includes('0.0.0.0') ||
    normalized.match(/192\.168\.\d+\.\d+/) || // Local network
    normalized.match(/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/) || // WSL network
    normalized.match(/10\.\d+\.\d+\.\d+/) // Private network
  ) {
    return 'local'
  }

  return 'live'
}

/**
 * Migrate from legacy selectedEndpoint to connections
 */
export function migrateFromLegacyEndpoint(
  selectedEndpoint: string,
  legacyApiKey?: string
): AgentOSConnection | null {
  if (!selectedEndpoint || selectedEndpoint === '') {
    return null
  }

  const normalizedEndpoint = normalizeEndpoint(selectedEndpoint)
  const environment = detectEnvironment(normalizedEndpoint)

  // Generate a default name based on endpoint
  let name = 'Default AgentOS'
  if (normalizedEndpoint.includes('localhost')) {
    name = 'Local AgentOS'
  } else if (normalizedEndpoint.includes('127.0.0.1')) {
    name = 'Local AgentOS (127.0.0.1)'
  } else {
    try {
      const url = new URL(normalizedEndpoint)
      name = `AgentOS (${url.hostname})`
    } catch {
      name = 'Migrated AgentOS'
    }
  }

  const now = Date.now()

  return {
    id: crypto.randomUUID(),
    name,
    endpoint: normalizedEndpoint,
    apiKey: legacyApiKey || '',
    environment,
    tags: ['migrated'],
    isActive: false,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Check if connections list needs migration
 */
export function needsMigration(
  connections: AgentOSConnection[],
  selectedEndpoint: string
): boolean {
  // No migration needed if connections already exist
  if (connections.length > 0) {
    return false
  }

  // Migration needed if selectedEndpoint exists but no connections
  if (selectedEndpoint && selectedEndpoint !== '') {
    return true
  }

  return false
}

/**
 * Generate a default local connection
 */
export function generateDefaultConnection(): CreateConnectionInput {
  return {
    name: 'Local AgentOS',
    endpoint: 'http://localhost:7777',
    apiKey: '',
    environment: 'local',
    tags: ['default']
  }
}

/**
 * Format connection for display
 */
export function formatConnectionDisplay(connection: AgentOSConnection): {
  title: string
  subtitle: string
  statusColor: string
  environmentBadge: string
} {
  return {
    title: connection.name,
    subtitle: connection.endpoint,
    statusColor: connection.isActive ? 'bg-positive' : 'bg-destructive',
    environmentBadge: connection.environment === 'local' ? 'Local' : 'Live'
  }
}

/**
 * Get connection by ID
 */
export function getConnectionById(
  connections: AgentOSConnection[],
  id: string
): AgentOSConnection | null {
  return connections.find((conn) => conn.id === id) || null
}

/**
 * Check if endpoint is already in connections
 */
export function isDuplicateEndpoint(
  connections: AgentOSConnection[],
  endpoint: string,
  excludeId?: string
): boolean {
  const normalized = normalizeEndpoint(endpoint)

  return connections.some(
    (conn) =>
      normalizeEndpoint(conn.endpoint) === normalized && conn.id !== excludeId
  )
}

/**
 * Parse tags from comma-separated string
 */
export function parseTagsString(tagsString: string): string[] {
  if (!tagsString || tagsString.trim() === '') {
    return []
  }

  return tagsString
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .filter((tag) => tag.length <= 50)
    .slice(0, 10) // Max 10 tags
}

/**
 * Format tags to comma-separated string
 */
export function formatTagsToString(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) {
    return ''
  }

  return tags.join(', ')
}
