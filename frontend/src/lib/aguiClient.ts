/**
 * AGUI Client Library
 *
 * High-level client for interacting with AGUI-compatible AgentOS endpoints
 */

import type {
  AGUIClientConfig,
  AGUIRequest,
  AGUIAgentMetadata,
  AGUIStatusResponse,
  AGUISendMessageOptions,
  AGUIResponseContent
} from '@/types/agui'
import {
  buildAGUIRequest,
  checkAGUISupport,
  parseAGUIChunk,
  mapAGUIEventToUIEvent
} from './aguiProtocol'
import type { Message } from '@/types/os'

/**
 * AGUI Client for universal agent communication
 */
export class AGUIClient {
  private config: AGUIClientConfig
  private currentThreadId?: string
  private messageHistory: Message[] = []

  constructor(config: AGUIClientConfig) {
    this.config = {
      timeout: 120000, // 2 minutes default
      debug: false,
      ...config
    }
  }

  /**
   * Check if the endpoint supports AGUI protocol
   */
  async checkSupport(): Promise<boolean> {
    return checkAGUISupport(this.config.baseUrl, this.config.authHeaders)
  }

  /**
   * Get status from AGUI endpoint
   */
  async getStatus(): Promise<AGUIStatusResponse> {
    const url = `${this.config.baseUrl}/status`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.config.authHeaders
        }
      })

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      if (this.config.debug) {
        console.error('AGUI status check failed:', error)
      }
      throw error
    }
  }

  /**
   * Discover all available agents
   */
  async discoverAgents(): Promise<AGUIAgentMetadata[]> {
    const url = `${this.config.baseUrl}/agents`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.authHeaders
        }
      })

      if (!response.ok) {
        throw new Error(`Agent discovery failed: ${response.statusText}`)
      }

      const data = await response.json()

      // Handle different response formats
      if (Array.isArray(data)) {
        return data as AGUIAgentMetadata[]
      }

      if (data.agents && Array.isArray(data.agents)) {
        return data.agents as AGUIAgentMetadata[]
      }

      return []
    } catch (error) {
      if (this.config.debug) {
        console.error('AGUI agent discovery failed:', error)
      }
      throw error
    }
  }

  /**
   * Get details about a specific agent
   */
  async getAgentDetails(agentId: string): Promise<AGUIAgentMetadata | null> {
    try {
      const agents = await this.discoverAgents()
      return agents.find((agent) => agent.id === agentId) || null
    } catch (error) {
      if (this.config.debug) {
        console.error('Failed to get agent details:', error)
      }
      return null
    }
  }

  /**
   * Send a message using AGUI protocol
   */
  async sendMessage(options: AGUISendMessageOptions): Promise<void> {
    const {
      message,
      threadId,
      state = {},
      tools = [],
      context = [],
      onChunk,
      onError,
      onComplete
    } = options

    // Use existing thread ID or create new one
    const finalThreadId = threadId || this.currentThreadId
    this.currentThreadId = finalThreadId

    // Build AGUI request
    const request: AGUIRequest = buildAGUIRequest({
      message,
      threadId: finalThreadId,
      previousMessages: this.messageHistory,
      state,
      agentId: state.agent_id as string | undefined,
      userId: state.user_id as string | undefined
    })

    // Add tools and context if provided
    if (tools.length > 0) {
      request.tools = tools
    }
    if (context.length > 0) {
      request.context = context
    }

    const url = `${this.config.baseUrl}/agui`

    if (this.config.debug) {
      console.log('AGUI Request:', request)
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.authHeaders
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.detail || `Request failed: ${response.statusText}`
        )
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Add user message to history
      this.messageHistory.push({
        role: 'user',
        content: message,
        created_at: Math.floor(Date.now() / 1000)
      })

      // Stream the response
      await this.streamResponse(response.body, onChunk, onError, onComplete)
    } catch (error) {
      if (this.config.debug) {
        console.error('AGUI message failed:', error)
      }
      if (onError) {
        onError(
          error instanceof Error ? error : new Error('Unknown error')
        )
      }
    }
  }

  /**
   * Stream and parse AGUI response
   */
  private async streamResponse(
    body: ReadableStream<Uint8Array>,
    onChunk?: (chunk: AGUIResponseContent) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            this.processBuffer(buffer, onChunk)
          }
          if (onComplete) {
            onComplete()
          }
          break
        }

        // Decode and accumulate
        buffer += decoder.decode(value, { stream: true })

        // Process complete JSON objects
        buffer = this.processBuffer(buffer, onChunk)
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('Stream processing error:', error)
      }
      if (onError) {
        onError(
          error instanceof Error ? error : new Error('Stream error')
        )
      }
    }
  }

  /**
   * Process buffer and extract complete JSON objects
   */
  private processBuffer(
    buffer: string,
    onChunk?: (chunk: AGUIResponseContent) => void
  ): string {
    let currentIndex = 0
    let jsonStartIndex = buffer.indexOf('{', currentIndex)

    while (jsonStartIndex !== -1 && jsonStartIndex < buffer.length) {
      let braceCount = 0
      let inString = false
      let escapeNext = false
      let jsonEndIndex = -1

      for (let i = jsonStartIndex; i < buffer.length; i++) {
        const char = buffer[i]

        if (inString) {
          if (escapeNext) {
            escapeNext = false
          } else if (char === '\\') {
            escapeNext = true
          } else if (char === '"') {
            inString = false
          }
        } else {
          if (char === '"') {
            inString = true
          } else if (char === '{') {
            braceCount++
          } else if (char === '}') {
            braceCount--
            if (braceCount === 0) {
              jsonEndIndex = i
              break
            }
          }
        }
      }

      if (jsonEndIndex !== -1) {
        const jsonString = buffer.slice(jsonStartIndex, jsonEndIndex + 1)

        try {
          const parsed = JSON.parse(jsonString)
          const aguiChunk = parseAGUIChunk(parsed)

          if (aguiChunk && onChunk) {
            // Convert AGUI event to UI-compatible format
            const uiEvent = mapAGUIEventToUIEvent(aguiChunk.event)
            const chunk: AGUIResponseContent = {
              event: uiEvent,
              ...aguiChunk.data
            }

            if (this.config.debug) {
              console.log('AGUI Chunk:', chunk)
            }

            onChunk(chunk)
          }
        } catch {
          // Skip invalid JSON
        }

        currentIndex = jsonEndIndex + 1
        buffer = buffer.slice(currentIndex).trim()
        currentIndex = 0
        jsonStartIndex = buffer.indexOf('{', currentIndex)
      } else {
        break
      }
    }

    return buffer
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = []
  }

  /**
   * Get current thread ID
   */
  getThreadId(): string | undefined {
    return this.currentThreadId
  }

  /**
   * Set thread ID (useful for resuming conversations)
   */
  setThreadId(threadId: string): void {
    this.currentThreadId = threadId
  }

  /**
   * Get message history
   */
  getHistory(): Message[] {
    return [...this.messageHistory]
  }

  /**
   * Set message history (useful for resuming conversations)
   */
  setHistory(messages: Message[]): void {
    this.messageHistory = [...messages]
  }
}

/**
 * Create a new AGUI client instance
 */
export function createAGUIClient(config: AGUIClientConfig): AGUIClient {
  return new AGUIClient(config)
}

/**
 * Default export
 */
export default AGUIClient
