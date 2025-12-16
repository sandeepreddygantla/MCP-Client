'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import type { MCPServer, MCPServerStatus } from '@/types/os'

interface MCPServerCardProps {
  server: MCPServer
  status?: MCPServerStatus
  onEdit: (server: MCPServer) => void
  onDelete: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
}

export function MCPServerCard({
  server,
  status,
  onEdit,
  onDelete,
  onToggle
}: MCPServerCardProps) {
  const [showTools, setShowTools] = useState(false)
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
            {/* Connection Status Badge */}
            {status ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  status.status === 'connected'
                    ? 'bg-green-500/10 text-green-500'
                    : status.status === 'failed'
                    ? 'bg-red-500/10 text-red-500'
                    : 'bg-gray-500/10 text-gray-500'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${
                  status.status === 'connected'
                    ? 'bg-green-500'
                    : status.status === 'failed'
                    ? 'bg-red-500'
                    : 'bg-gray-500'
                }`} />
                {status.status === 'connected' ? 'Connected' :
                 status.status === 'failed' ? 'Failed' : 'Disabled'}
              </span>
            ) : (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  server.enabled
                    ? 'bg-yellow-500/10 text-yellow-500'
                    : 'bg-gray-500/10 text-gray-500'
                }`}
              >
                {server.enabled ? 'Pending' : 'Disabled'}
              </span>
            )}
            {/* Tools Count Badge */}
            {status && status.tools_count > 0 && (
              <button
                onClick={() => setShowTools(!showTools)}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <Icon type="terminal" size="xs" className="w-3 h-3" />
                {status.tools_count} {status.tools_count === 1 ? 'tool' : 'tools'}
                <Icon
                  type={showTools ? 'chevron-up' : 'chevron-down'}
                  size="xs"
                  className="w-3 h-3"
                />
              </button>
            )}
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

      {/* Expandable Tools List */}
      {showTools && status && status.tools.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <div className="text-[10px] font-medium text-foreground-secondary mb-2 uppercase">
            Available Tools
          </div>
          <div className="flex flex-wrap gap-1.5">
            {status.tools.map((tool) => (
              <span
                key={tool.name}
                className="inline-flex items-center rounded bg-accent px-2 py-1 text-[10px] font-mono text-foreground-secondary"
                title={tool.description || tool.name}
              >
                {tool.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {status?.error && (
        <div className="mt-3 pt-3 border-t border-red-500/20">
          <div className="flex items-start gap-2 text-[10px] text-red-500">
            <Icon type="alert-triangle" size="xs" className="mt-0.5 shrink-0" />
            <span>{status.error}</span>
          </div>
        </div>
      )}
    </div>
  )
}
