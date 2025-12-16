'use client'

import * as React from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import { useStore } from '@/store'
import { useQueryState } from 'nuqs'
import Icon from '@/components/ui/icon'
import { useEffect } from 'react'
import useChatActions from '@/hooks/useChatActions'
import useSessionLoader from '@/hooks/useSessionLoader'

export function EntitySelector() {
  const {
    mode,
    agents,
    teams,
    setMessages,
    setSelectedModel,
    getActiveConnection,
    setLastSessionForAgent,
    getLastSessionForAgent
  } = useStore()

  const { focusChatInput } = useChatActions()
  const { getSession } = useSessionLoader()
  const [agentId, setAgentId] = useQueryState('agent', {
    parse: (value) => value || undefined,
    history: 'push'
  })
  const [teamId, setTeamId] = useQueryState('team', {
    parse: (value) => value || undefined,
    history: 'push'
  })
  const [sessionId, setSessionId] = useQueryState('session')
  const [dbId] = useQueryState('db_id')

  const currentEntities = mode === 'team' ? teams : agents
  const currentValue = mode === 'team' ? teamId : agentId
  const placeholder = mode === 'team' ? 'Select Team' : 'Select Agent'

  // Save session ID whenever it changes (e.g., when new session is created)
  useEffect(() => {
    const activeConnection = getActiveConnection()
    const connectionId = activeConnection?.id || ''

    if (currentValue && connectionId && sessionId) {
      setLastSessionForAgent(currentValue, connectionId, sessionId)
    }
  }, [sessionId, currentValue, getActiveConnection, setLastSessionForAgent])

  useEffect(() => {
    if (currentValue && currentEntities.length > 0) {
      const entity = currentEntities.find((item) => item.id === currentValue)
      if (entity) {
        setSelectedModel(entity.model?.model || '')
        if (mode === 'team') {
          setTeamId(entity.id)
        }
        if (entity.model?.model) {
          focusChatInput()
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue, currentEntities, setSelectedModel, mode])

  const handleOnValueChange = async (value: string) => {
    const newValue = value === currentValue ? null : value
    const selectedEntity = currentEntities.find((item) => item.id === newValue)
    const activeConnection = getActiveConnection()
    const connectionId = activeConnection?.id || ''

    // Save current session for current agent before switching
    if (currentValue && connectionId && sessionId) {
      setLastSessionForAgent(currentValue, connectionId, sessionId)
    }

    setSelectedModel(selectedEntity?.model?.provider || '')

    if (mode === 'team') {
      setTeamId(newValue)
      setAgentId(null)
    } else {
      setAgentId(newValue)
      setTeamId(null)
    }

    // Check if there's a saved session for the new agent+connection
    if (newValue && connectionId) {
      const savedSessionId = getLastSessionForAgent(newValue, connectionId)

      if (savedSessionId && dbId) {
        // Load the saved session
        setSessionId(savedSessionId)
        await getSession(
          {
            entityType: mode,
            agentId: mode === 'agent' ? newValue : null,
            teamId: mode === 'team' ? newValue : null,
            dbId
          },
          savedSessionId
        )
      } else {
        // No saved session, clear messages and session
        setMessages([])
        setSessionId(null)
      }
    } else {
      // No agent selected or no connection, clear everything
      setMessages([])
      setSessionId(null)
    }

    if (selectedEntity?.model?.provider) {
      focusChatInput()
    }
  }

  if (currentEntities.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="h-9 w-full rounded-xl border border-border/20 bg-accent text-xs font-medium uppercase text-accent-foreground opacity-50">
          <SelectValue placeholder={`No ${mode}s Available`} />
        </SelectTrigger>
      </Select>
    )
  }

  const selectedEntity = currentEntities.find((e) => e.id === currentValue)

  return (
    <Select
      value={currentValue || ''}
      onValueChange={(value) => handleOnValueChange(value)}
    >
      <SelectTrigger className="h-9 w-full overflow-hidden rounded-xl border border-border/20 bg-accent text-xs font-medium uppercase text-accent-foreground">
        {selectedEntity ? (
          <div className="flex w-full items-center gap-2 overflow-hidden">
            <Icon type={'user'} size="xs" className="shrink-0" />
            <span className="truncate">{selectedEntity.name || selectedEntity.id}</span>
          </div>
        ) : (
          <span className="text-accent-foreground/50">{placeholder}</span>
        )}
      </SelectTrigger>
      <SelectContent className="font-dmmono shadow-lg">
        {currentEntities.map((entity, index) => (
          <SelectItem
            className="cursor-pointer"
            key={`${entity.id}-${index}`}
            value={entity.id}
          >
            <div className="flex items-center gap-3 text-xs font-medium uppercase">
              <Icon type={'user'} size="xs" />
              {entity.name || entity.id}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
