import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import {
  AgentDetails,
  SessionEntry,
  TeamDetails,
  type ChatMessage,
  type AgentOSConnection,
  type CreateConnectionInput,
  type UpdateConnectionInput
} from '@/types/os'
import type { AGUIAgentMetadata } from '@/types/agui'

interface Store {
  hydrated: boolean
  setHydrated: () => void
  streamingErrorMessage: string
  setStreamingErrorMessage: (streamingErrorMessage: string) => void
  endpoints: {
    endpoint: string
    id__endpoint: string
  }[]
  setEndpoints: (
    endpoints: {
      endpoint: string
      id__endpoint: string
    }[]
  ) => void
  isStreaming: boolean
  setIsStreaming: (isStreaming: boolean) => void
  isEndpointActive: boolean
  setIsEndpointActive: (isActive: boolean) => void
  isEndpointLoading: boolean
  setIsEndpointLoading: (isLoading: boolean) => void
  messages: ChatMessage[]
  setMessages: (
    messages: ChatMessage[] | ((prevMessages: ChatMessage[]) => ChatMessage[])
  ) => void
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>
  selectedEndpoint: string
  setSelectedEndpoint: (selectedEndpoint: string) => void
  agents: AgentDetails[]
  setAgents: (agents: AgentDetails[]) => void
  teams: TeamDetails[]
  setTeams: (teams: TeamDetails[]) => void
  selectedModel: string
  setSelectedModel: (model: string) => void
  mode: 'agent' | 'team'
  setMode: (mode: 'agent' | 'team') => void
  sessionsData: SessionEntry[] | null
  setSessionsData: (
    sessionsData:
      | SessionEntry[]
      | ((prevSessions: SessionEntry[] | null) => SessionEntry[] | null)
  ) => void
  isSessionsLoading: boolean
  setIsSessionsLoading: (isSessionsLoading: boolean) => void
  // Connection Management State
  connections: AgentOSConnection[]
  setConnections: (connections: AgentOSConnection[]) => void
  selectedConnectionId: string | null
  setSelectedConnectionId: (connectionId: string | null) => void
  addConnection: (input: CreateConnectionInput) => AgentOSConnection
  updateConnection: (input: UpdateConnectionInput) => void
  deleteConnection: (connectionId: string) => void
  getActiveConnection: () => AgentOSConnection | null
  hasValidConnection: () => boolean
  updateConnectionHealth: (connectionId: string, isActive: boolean) => void
  // AGUI Protocol State
  aguiCapable: boolean
  setAguiCapable: (aguiCapable: boolean) => void
  availableAgents: AGUIAgentMetadata[]
  setAvailableAgents: (agents: AGUIAgentMetadata[]) => void
  currentThreadId: string | null
  setCurrentThreadId: (threadId: string | null) => void
  currentRunId: string | null
  setCurrentRunId: (runId: string | null) => void
  selectedAgentId: string | null
  setSelectedAgentId: (agentId: string | null) => void
  // Session persistence per agent+connection
  lastSessionPerAgent: Record<string, string>
  setLastSessionForAgent: (
    agentId: string,
    connectionId: string,
    sessionId: string | null
  ) => void
  getLastSessionForAgent: (
    agentId: string,
    connectionId: string
  ) => string | null
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      streamingErrorMessage: '',
      setStreamingErrorMessage: (streamingErrorMessage) =>
        set(() => ({ streamingErrorMessage })),
      endpoints: [],
      setEndpoints: (endpoints) => set(() => ({ endpoints })),
      isStreaming: false,
      setIsStreaming: (isStreaming) => set(() => ({ isStreaming })),
      isEndpointActive: false,
      setIsEndpointActive: (isActive) =>
        set(() => ({ isEndpointActive: isActive })),
      isEndpointLoading: true,
      setIsEndpointLoading: (isLoading) =>
        set(() => ({ isEndpointLoading: isLoading })),
      messages: [],
      setMessages: (messages) =>
        set((state) => ({
          messages:
            typeof messages === 'function' ? messages(state.messages) : messages
        })),
      chatInputRef: { current: null },
      selectedEndpoint: 'http://localhost:8888',
      setSelectedEndpoint: (selectedEndpoint) =>
        set(() => ({ selectedEndpoint })),
      agents: [],
      setAgents: (agents) => set({ agents }),
      teams: [],
      setTeams: (teams) => set({ teams }),
      selectedModel: '',
      setSelectedModel: (selectedModel) => set(() => ({ selectedModel })),
      mode: 'agent',
      setMode: (mode) => set(() => ({ mode })),
      sessionsData: null,
      setSessionsData: (sessionsData) =>
        set((state) => ({
          sessionsData:
            typeof sessionsData === 'function'
              ? sessionsData(state.sessionsData)
              : sessionsData
        })),
      isSessionsLoading: false,
      setIsSessionsLoading: (isSessionsLoading) =>
        set(() => ({ isSessionsLoading })),
      // Connection Management State
      connections: [],
      setConnections: (connections) => set(() => ({ connections })),
      selectedConnectionId: null,
      setSelectedConnectionId: (connectionId) =>
        set(() => ({ selectedConnectionId: connectionId })),
      addConnection: (input) => {
        // Check for duplicate endpoint
        const state = useStore.getState()
        const normalizedEndpoint = input.endpoint.replace(/\/$/, '').trim()

        const duplicate = state.connections.find(
          (conn) => conn.endpoint.replace(/\/$/, '').trim() === normalizedEndpoint
        )

        // If duplicate exists, just select it and return
        if (duplicate) {
          set({ selectedConnectionId: duplicate.id })
          return duplicate
        }

        const now = Date.now()
        const newConnection: AgentOSConnection = {
          id: crypto.randomUUID(),
          name: input.name,
          endpoint: normalizedEndpoint,
          apiKey: input.apiKey,
          environment: input.environment,
          tags: input.tags || [],
          isActive: false,
          createdAt: now,
          updatedAt: now
        }
        set((state) => ({
          connections: [...state.connections, newConnection],
          selectedConnectionId: newConnection.id
        }))
        return newConnection
      },
      updateConnection: (input) => {
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === input.id
              ? {
                  ...conn,
                  ...(input.name !== undefined && { name: input.name }),
                  ...(input.endpoint !== undefined && {
                    endpoint: input.endpoint
                  }),
                  ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
                  ...(input.environment !== undefined && {
                    environment: input.environment
                  }),
                  ...(input.tags !== undefined && { tags: input.tags }),
                  updatedAt: Date.now()
                }
              : conn
          )
        }))
      },
      deleteConnection: (connectionId) => {
        set((state) => {
          const newConnections = state.connections.filter(
            (conn) => conn.id !== connectionId
          )
          return {
            connections: newConnections,
            selectedConnectionId:
              state.selectedConnectionId === connectionId
                ? newConnections[0]?.id || null
                : state.selectedConnectionId
          }
        })
      },
      getActiveConnection: () => {
        const state = useStore.getState()
        return (
          state.connections.find(
            (conn) => conn.id === state.selectedConnectionId
          ) || null
        )
      },
      hasValidConnection: () => {
        const state = useStore.getState()
        const activeConnection = state.connections.find(
          (conn) => conn.id === state.selectedConnectionId
        )
        return !!(
          activeConnection &&
          activeConnection.apiKey &&
          activeConnection.apiKey.trim() !== ''
        )
      },
      updateConnectionHealth: (connectionId, isActive) => {
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === connectionId
              ? {
                  ...conn,
                  isActive,
                  lastConnected: isActive ? Date.now() : conn.lastConnected
                }
              : conn
          )
        }))
      },
      // AGUI Protocol State
      aguiCapable: false,
      setAguiCapable: (aguiCapable) => set(() => ({ aguiCapable })),
      availableAgents: [],
      setAvailableAgents: (availableAgents) => set(() => ({ availableAgents })),
      currentThreadId: null,
      setCurrentThreadId: (currentThreadId) => set(() => ({ currentThreadId })),
      currentRunId: null,
      setCurrentRunId: (currentRunId) => set(() => ({ currentRunId })),
      selectedAgentId: null,
      setSelectedAgentId: (selectedAgentId) => set(() => ({ selectedAgentId })),
      // Session persistence per agent+connection
      lastSessionPerAgent: {},
      setLastSessionForAgent: (agentId, connectionId, sessionId) =>
        set((state) => {
          const key = `${agentId}_${connectionId}`
          const newMap = { ...state.lastSessionPerAgent }
          if (sessionId === null) {
            delete newMap[key]
          } else {
            newMap[key] = sessionId
          }
          return { lastSessionPerAgent: newMap }
        }),
      getLastSessionForAgent: (agentId, connectionId) => {
        const key = `${agentId}_${connectionId}`
        return useStore.getState().lastSessionPerAgent[key] || null
      }
    }),
    {
      name: 'endpoint-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedEndpoint: state.selectedEndpoint, // Keep for backward compatibility
        connections: state.connections,
        selectedConnectionId: state.selectedConnectionId,
        lastSessionPerAgent: state.lastSessionPerAgent
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated?.()
      }
    }
  )
)
