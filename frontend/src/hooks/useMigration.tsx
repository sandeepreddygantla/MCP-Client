/**
 * Migration Hook
 *
 * Handles migration from legacy selectedEndpoint to new connection system
 * Runs ONCE per browser using localStorage flag
 */

import { useEffect } from 'react'
import { useStore } from '@/store'
import {
  migrateFromLegacyEndpoint,
  needsMigration
} from '@/lib/connectionManager'
import { toast } from 'sonner'

const MIGRATION_FLAG_KEY = 'agui_migration_completed'

export function useMigration() {
  const {
    connections,
    selectedEndpoint,
    addConnection,
    setSelectedConnectionId,
    hydrated
  } = useStore()

  useEffect(() => {
    // Wait for store to hydrate from localStorage
    if (!hydrated) return

    // Check if migration already completed
    const migrationCompleted = localStorage.getItem(MIGRATION_FLAG_KEY)
    if (migrationCompleted === 'true') {
      return
    }

    // If connections already exist, mark as migrated and skip
    if (connections.length > 0) {
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
      return
    }

    // Check if migration is needed
    if (!needsMigration(connections, selectedEndpoint)) {
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
      return
    }

    // Perform migration
    try {
      const legacyApiKey = process.env.NEXT_PUBLIC_AGNO_API_KEY

      const migratedConnection = migrateFromLegacyEndpoint(
        selectedEndpoint,
        legacyApiKey
      )

      if (migratedConnection) {
        const newConnection = addConnection({
          name: migratedConnection.name,
          endpoint: migratedConnection.endpoint,
          apiKey: migratedConnection.apiKey,
          environment: migratedConnection.environment,
          tags: migratedConnection.tags
        })

        setSelectedConnectionId(newConnection.id)

        toast.success('Endpoint migrated to Connections', {
          description: 'Manage connections in Settings'
        })

        console.log('[Migration] Completed successfully')
      }

      // Mark migration as complete
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
    } catch (error) {
      console.error('[Migration] Failed:', error)
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
    }
  }, [connections, selectedEndpoint, addConnection, setSelectedConnectionId, hydrated])
}
