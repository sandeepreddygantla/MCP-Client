'use client'

import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import type { MCPServer } from '@/types/os'

interface MCPServerCardProps {
  server: MCPServer
  onEdit: (server: MCPServer) => void
  onDelete: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
}

export function MCPServerCard({
  server,
  onEdit,
  onDelete,
  onToggle
}: MCPServerCardProps) {
  const getTransportIcon = (transport: string) => {
    switch (transport) {
      case 'stdio':
        return 'terminal'
      case 'sse':
      case 'streamable-http':
        return 'globe'
      default:
        return 'server'
    }
  }

  const getTransportLabel = (transport: string) => {
    switch (transport) {
      case 'stdio':
        return 'Standard I/O'
      case 'sse':
        return 'Server-Sent Events'
      case 'streamable-http':
        return 'Streamable HTTP'
      default:
        return transport
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        server.enabled
          ? 'border-primary/30 bg-primary/5'
          : 'border-border/20 bg-accent/50 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon
              type={getTransportIcon(server.transport) as any}
              size="xs"
              className={server.enabled ? 'text-primary' : 'text-foreground-secondary'}
            />
            <h3 className="text-sm font-medium text-foreground truncate">
              {server.name}
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                server.enabled
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-gray-500/10 text-gray-500'
              }`}
            >
              {server.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {server.description && (
            <p className="text-xs text-foreground-secondary mb-2 line-clamp-2">
              {server.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 text-[10px] text-foreground-secondary">
            <span className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5">
              <Icon type="settings" size="xs" className="w-3 h-3" />
              {getTransportLabel(server.transport)}
            </span>

            {server.transport === 'stdio' && server.command && (
              <span className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 font-mono max-w-[200px] truncate">
                {server.command} {server.args.join(' ')}
              </span>
            )}

            {(server.transport === 'sse' || server.transport === 'streamable-http') &&
              server.url && (
                <span className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 font-mono max-w-[200px] truncate">
                  {server.url}
                </span>
              )}

            {Object.keys(server.env).length > 0 && (
              <span className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5">
                {Object.keys(server.env).length} env var(s)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggle(server.id, !server.enabled)}
            title={server.enabled ? 'Disable server' : 'Enable server'}
            className="h-8 w-8"
          >
            <Icon
              type={server.enabled ? 'eye' : 'eye-off'}
              size="xs"
              className={server.enabled ? 'text-primary' : 'text-foreground-secondary'}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(server)}
            title="Edit server"
            className="h-8 w-8"
          >
            <Icon type="edit" size="xs" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(server.id)}
            title="Delete server"
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <Icon type="trash" size="xs" />
          </Button>
        </div>
      </div>
    </div>
  )
}
