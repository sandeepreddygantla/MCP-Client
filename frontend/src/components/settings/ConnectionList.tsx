'use client'

import { ConnectionCard } from './ConnectionCard'
import type { AgentOSConnection } from '@/types/os'

interface ConnectionListProps {
  connections: AgentOSConnection[]
  selectedConnectionId: string | null
  onSelectConnection: (id: string) => void
  onEditConnection: (connection: AgentOSConnection) => void
  onDeleteConnection: (id: string) => void
}

export function ConnectionList({
  connections,
  selectedConnectionId,
  onSelectConnection,
  onEditConnection,
  onDeleteConnection
}: ConnectionListProps) {
  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border/20 bg-accent p-12 text-center">
        <div className="mb-2 text-4xl">🔌</div>
        <h3 className="mb-1 text-sm font-medium text-foreground">
          No Connections Yet
        </h3>
        <p className="text-xs text-foreground-secondary">
          Click "Add Connection" to connect to your first AgentOS
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {connections.map((connection) => (
        <ConnectionCard
          key={connection.id}
          connection={connection}
          isSelected={connection.id === selectedConnectionId}
          onSelect={onSelectConnection}
          onEdit={onEditConnection}
          onDelete={onDeleteConnection}
        />
      ))}
    </div>
  )
}
