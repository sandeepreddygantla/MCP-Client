'use client'

import { MCPServerCard } from './MCPServerCard'
import type { MCPServer } from '@/types/os'
import Icon from '@/components/ui/icon'

interface MCPServerListProps {
  servers: MCPServer[]
  onEdit: (server: MCPServer) => void
  onDelete: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
}

export function MCPServerList({
  servers,
  onEdit,
  onDelete,
  onToggle
}: MCPServerListProps) {
  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 py-12 px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent mb-4">
          <Icon type="server" size="sm" className="text-foreground-secondary" />
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1">
          No MCP Servers Configured
        </h3>
        <p className="text-xs text-foreground-secondary text-center max-w-sm">
          Add your first MCP server to enable tool integrations. You can connect to
          filesystem, GitHub, databases, and more.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {servers.map((server) => (
        <MCPServerCard
          key={server.id}
          server={server}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}
