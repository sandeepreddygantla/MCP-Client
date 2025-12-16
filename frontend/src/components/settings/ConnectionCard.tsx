'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Icon from '@/components/ui/icon'
import type { AgentOSConnection } from '@/types/os'
import { formatConnectionDisplay } from '@/lib/connectionManager'

interface ConnectionCardProps {
  connection: AgentOSConnection
  isSelected: boolean
  onSelect: (id: string) => void
  onEdit: (connection: AgentOSConnection) => void
  onDelete: (id: string) => void
}

export function ConnectionCard({
  connection,
  isSelected,
  onSelect,
  onEdit,
  onDelete
}: ConnectionCardProps) {
  const { title, subtitle, statusColor, environmentBadge } =
    formatConnectionDisplay(connection)

  return (
    <div
      className={`group relative rounded-xl border p-4 transition-all ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border/20 bg-accent hover:border-border/40'
      }`}
    >
      {/* Status Indicator */}
      <div className="absolute right-4 top-4">
        <div
          className={`size-2 rounded-full ${statusColor}`}
          title={connection.isActive ? 'Connected' : 'Disconnected'}
        />
      </div>

      {/* Header */}
      <div className="mb-3 pr-6">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <Badge
            variant={connection.environment === 'local' ? 'default' : 'outline'}
            className="text-[10px]"
          >
            {environmentBadge}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-foreground-secondary">{subtitle}</p>
      </div>

      {/* Tags */}
      {connection.tags && connection.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {connection.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-accent-foreground/10 px-2 py-0.5 text-[10px] font-medium text-accent-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {!isSelected && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-[10px]"
            onClick={() => onSelect(connection.id)}
          >
            <Icon type="check" size="xs" className="mr-1" />
            Set as Active
          </Button>
        )}
        {isSelected && (
          <div className="flex-1 rounded-md bg-positive/10 px-3 py-1.5 text-center text-[10px] font-medium uppercase text-positive">
            Active Connection
          </div>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEdit(connection)}
          className="size-8 p-0"
        >
          <Icon type="edit" size="xs" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(connection.id)}
          className="size-8 p-0 hover:bg-destructive/10 hover:text-destructive"
        >
          <Icon type="trash" size="xs" />
        </Button>
      </div>

      {/* Last Connected */}
      {connection.lastConnected && (
        <p className="mt-2 text-[10px] text-foreground-secondary">
          Last connected:{' '}
          {new Date(connection.lastConnected).toLocaleString()}
        </p>
      )}
    </div>
  )
}
