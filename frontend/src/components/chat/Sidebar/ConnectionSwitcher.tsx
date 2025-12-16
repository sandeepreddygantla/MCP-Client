'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import { useStore } from '@/store'
import { motion } from 'framer-motion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export function ConnectionSwitcher() {
  const {
    connections,
    selectedConnectionId,
    setSelectedConnectionId,
    getActiveConnection
  } = useStore()

  const [isMounted, setIsMounted] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const activeConnection = getActiveConnection()

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Trigger re-initialization of agents/teams
    // This will be handled by the parent component that listens to connection changes
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const getStatusColor = (isActive: boolean) =>
    isActive ? 'bg-positive' : 'bg-destructive'

  if (!isMounted) {
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="text-xs font-medium uppercase text-foreground">
          Connection
        </div>
        <div className="flex h-9 w-full items-center rounded-xl border border-border/20 bg-accent px-3">
          <span className="text-xs font-medium text-accent-foreground">
            Loading...
          </span>
        </div>
      </div>
    )
  }

  // No connections - show setup message
  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="text-xs font-medium uppercase text-foreground">
          Connection
        </div>
        <div className="flex w-full flex-col gap-2 rounded-xl border border-border/20 bg-accent p-3">
          <p className="text-[10px] text-foreground-secondary">
            No connections configured. Use Settings to add one.
          </p>
        </div>
      </div>
    )
  }

  // Single connection - simple display
  if (connections.length === 1) {
    const connection = connections[0]
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="text-xs font-medium uppercase text-foreground">
          Connection
        </div>
        <div className="flex w-full items-center gap-2">
          <div className="relative flex h-9 min-w-0 flex-1 items-center justify-between rounded-xl border border-border/20 bg-accent px-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Badge
                variant={connection.environment === 'local' ? 'default' : 'outline'}
                className="shrink-0 text-[9px]"
              >
                {connection.environment === 'local' ? 'Local' : 'Live'}
              </Badge>
              <span className="min-w-0 truncate text-xs font-medium text-accent-foreground">
                {connection.name}
              </span>
            </div>
            <div
              className={`ml-2 size-2 shrink-0 rounded-full ${getStatusColor(connection.isActive)}`}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="size-8 shrink-0 hover:cursor-pointer hover:bg-transparent"
            title="Refresh connection"
          >
            <motion.div
              key={isRefreshing ? 'rotating' : 'idle'}
              animate={{ rotate: isRefreshing ? 360 : 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              <Icon type="refresh" size="xs" />
            </motion.div>
          </Button>
        </div>
      </div>
    )
  }

  // Multiple connections - show dropdown
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="text-xs font-medium uppercase text-foreground">
        Connection
      </div>
      <div className="flex w-full items-center gap-2">
        <Select
          value={selectedConnectionId || undefined}
          onValueChange={setSelectedConnectionId}
        >
          <SelectTrigger className="min-w-0 flex-1">
            <SelectValue placeholder="Select connection">
              {activeConnection && (
                <div className="flex min-w-0 items-center gap-2">
                  <Badge
                    variant={
                      activeConnection.environment === 'local'
                        ? 'default'
                        : 'outline'
                    }
                    className="shrink-0 text-[9px]"
                  >
                    {activeConnection.environment === 'local' ? 'Local' : 'Live'}
                  </Badge>
                  <span className="min-w-0 truncate text-xs">
                    {activeConnection.name}
                  </span>
                  <div
                    className={`ml-auto size-2 shrink-0 rounded-full ${getStatusColor(activeConnection.isActive)}`}
                  />
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {connections.map((connection) => (
              <SelectItem key={connection.id} value={connection.id}>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      connection.environment === 'local' ? 'default' : 'outline'
                    }
                    className="text-[9px]"
                  >
                    {connection.environment === 'local' ? 'Local' : 'Live'}
                  </Badge>
                  <span className="text-xs">{connection.name}</span>
                  <div
                    className={`size-2 rounded-full ${getStatusColor(connection.isActive)}`}
                  />
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          className="size-8 shrink-0 hover:cursor-pointer hover:bg-transparent"
          title="Refresh connection"
        >
          <motion.div
            key={isRefreshing ? 'rotating' : 'idle'}
            animate={{ rotate: isRefreshing ? 360 : 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <Icon type="refresh" size="xs" />
          </motion.div>
        </Button>
      </div>
    </div>
  )
}
