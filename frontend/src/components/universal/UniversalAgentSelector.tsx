'use client'

import { useEffect, useState } from 'react'
import { useQueryState } from 'nuqs'
import { Bot, Loader2, Search, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useStore } from '@/store'
import { discoverAGUIAgentsAPI } from '@/api/os'
import type { AgentDetails } from '@/types/os'
import { constructEndpointUrl } from '@/lib/constructEndpointUrl'

/**
 * Universal Agent Selector
 *
 * Dynamically discovers and displays all available agents from AgentOS.
 * Works with any agent, not just hardcoded ones.
 */
export function UniversalAgentSelector() {
  const selectedEndpoint = useStore((state) => state.selectedEndpoint)
  const [agentId, setAgentId] = useQueryState('agent')
  const [agents, setAgents] = useState<AgentDetails[]>([])
  const [filteredAgents, setFilteredAgents] = useState<AgentDetails[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  /**
   * Discover agents from the endpoint
   */
  const discoverAgents = async (showToast = true) => {
    if (!selectedEndpoint) return

    const loading = showToast ? setIsRefreshing : setIsLoading
    loading(true)

    try {
      const endpointUrl = constructEndpointUrl(selectedEndpoint)
      const discoveredAgents = await discoverAGUIAgentsAPI(endpointUrl)

      if (discoveredAgents.length === 0) {
        if (showToast) {
          toast.info('No agents discovered at this endpoint')
        }
      } else {
        setAgents(discoveredAgents)
        setFilteredAgents(discoveredAgents)

        if (showToast) {
          toast.success(
            `Discovered ${discoveredAgents.length} agent${discoveredAgents.length > 1 ? 's' : ''}`
          )
        }

        // Auto-select first agent if none selected
        if (!agentId && discoveredAgents.length > 0) {
          setAgentId(discoveredAgents[0].id)
        }
      }
    } catch (error) {
      if (showToast) {
        toast.error('Failed to discover agents')
      }
      console.error('Agent discovery error:', error)
    } finally {
      loading(false)
    }
  }

  /**
   * Filter agents based on search query
   */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredAgents(agents)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.id.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query)
    )

    setFilteredAgents(filtered)
  }, [searchQuery, agents])

  /**
   * Discover agents on mount and when endpoint changes
   */
  useEffect(() => {
    discoverAgents(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEndpoint])

  /**
   * Get agent capabilities badges
   */
  const getAgentBadges = (agent: AgentDetails) => {
    const badges: string[] = []

    // Check for tools
    if (agent.tools && agent.tools.length > 0) {
      badges.push(`${agent.tools.length} tool${agent.tools.length > 1 ? 's' : ''}`)
    }

    // Check for knowledge (if available in agent details)
    if (agent.knowledge_base) {
      badges.push('Knowledge')
    }

    // Check for memory
    if (agent.create_user_memories) {
      badges.push('Memory')
    }

    return badges
  }

  /**
   * Get agent model name
   */
  const getModelName = (agent: AgentDetails) => {
    if (agent.model && typeof agent.model === 'object' && 'id' in agent.model) {
      return agent.model.id
    }
    return 'Unknown model'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Discovering agents...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Select Agent
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => discoverAgents(true)}
          disabled={isRefreshing}
          className="h-8 w-8 p-0"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </Button>
      </div>

      {/* Search */}
      {agents.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      {/* Agent selector */}
      {filteredAgents.length > 0 ? (
        <Select value={agentId ?? undefined} onValueChange={setAgentId}>
          <SelectTrigger>
            <SelectValue placeholder="Select an agent" />
          </SelectTrigger>
          <SelectContent>
            {filteredAgents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                <div className="flex flex-col gap-1 py-1">
                  <div className="font-medium">{agent.name}</div>
                  {agent.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {agent.description}
                    </div>
                  )}
                  <div className="flex gap-1 flex-wrap mt-1">
                    {getAgentBadges(agent).map((badge) => (
                      <Badge
                        key={badge}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-8">
          {agents.length === 0
            ? 'No agents available'
            : 'No agents match your search'}
        </div>
      )}

      {/* Selected agent details */}
      {agentId && agents.length > 0 && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Selected Agent
          </div>
          {(() => {
            const selectedAgent = agents.find((a) => a.id === agentId)
            if (!selectedAgent) return null

            return (
              <div className="space-y-2">
                <div>
                  <div className="text-sm font-medium">{selectedAgent.name}</div>
                  {selectedAgent.description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {selectedAgent.description}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {getAgentBadges(selectedAgent).map((badge) => (
                    <Badge key={badge} variant="outline" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  Model: {getModelName(selectedAgent)}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Agent count */}
      {agents.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          {filteredAgents.length} of {agents.length} agent
          {agents.length > 1 ? 's' : ''} available
        </div>
      )}
    </div>
  )
}
