/**
 * AGUI Protocol Utilities
 *
 * Handles message conversion, thread/run ID management, and protocol logic
 */

import type {
  AGUIMessage,
  AGUIUserMessage,
  AGUIAssistantMessage,
  AGUIToolCall,
  AGUIRequest
} from '@/types/agui'
import type { Message } from '@/types/os'

/**
 * Convert UI message format to AGUI message format
 */
export function convertToAGUIMessage(
  uiMessage: Message,
  index: number
): AGUIMessage {
  const messageId = `msg_${index}_${Date.now()}`

  if (uiMessage.role === 'user') {
    const aguiMessage: AGUIUserMessage = {
      id: messageId,
      role: 'user',
      content: uiMessage.content
    }
    return aguiMessage
  }

  if (uiMessage.role === 'agent') {
    const toolCalls: AGUIToolCall[] | undefined =
      uiMessage.tool_calls?.map((tc) => ({
        id: tc.tool_call_id || `call_${Date.now()}`,
        type: 'function' as const,
        function: {
          name: tc.tool_name || 'unknown',
          arguments: JSON.stringify(tc.tool_args || {})
        }
      }))

    const aguiMessage: AGUIAssistantMessage = {
      id: messageId,
      role: 'assistant',
      content: uiMessage.content,
      toolCalls: toolCalls
    }
    return aguiMessage
  }

  // Fallback for other message types
  return {
    id: messageId,
    role: 'user',
    content: typeof uiMessage.content === 'string' ? uiMessage.content : ''
  }
}

/**
 * Convert array of UI messages to AGUI messages
 */
export function convertMessagesToAGUI(uiMessages: Message[]): AGUIMessage[] {
  return uiMessages.map((msg, idx) => convertToAGUIMessage(msg, idx))
}

/**
 * Convert AGUI message back to UI message format
 */
export function convertFromAGUIMessage(aguiMessage: AGUIMessage): Message {
  const timestamp = Math.floor(Date.now() / 1000)

  if (aguiMessage.role === 'user') {
    return {
      role: 'user',
      content: aguiMessage.content,
      created_at: timestamp
    }
  }

  if (aguiMessage.role === 'assistant') {
    const toolCalls = aguiMessage.toolCalls?.map((tc) => {
      let parsedArgs: Record<string, unknown> = {}
      try {
        parsedArgs = typeof tc.function.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments
      } catch {
        parsedArgs = {}
      }

      return {
        tool_call_id: tc.id,
        tool_name: tc.function.name,
        tool_args: parsedArgs,
        tool_result: undefined,
        created_at: timestamp
      }
    })

    return {
      role: 'agent',
      content: aguiMessage.content || '',
      tool_calls: toolCalls,
      created_at: timestamp
    }
  }

  // Fallback
  return {
    role: 'user',
    content: '',
    created_at: timestamp
  }
}

/**
 * Generate a unique run ID
 */
export function generateRunId(): string {
  return `run_${crypto.randomUUID()}`
}

/**
 * Generate a unique thread ID
 */
export function generateThreadId(): string {
  return `thread_${crypto.randomUUID()}`
}

/**
 * Build AGUI request from UI state
 */
export interface BuildAGUIRequestOptions {
  /** New message to send */
  message: string
  /** Thread ID (session ID) */
  threadId?: string
  /** Previous messages in conversation */
  previousMessages?: Message[]
  /** Additional state */
  state?: Record<string, unknown>
  /** Agent ID */
  agentId?: string
  /** User ID */
  userId?: string
}

export function buildAGUIRequest(options: BuildAGUIRequestOptions): AGUIRequest {
  const {
    message,
    threadId,
    previousMessages = [],
    state = {},
    agentId,
    userId
  } = options

  // Generate IDs
  const finalThreadId = threadId || generateThreadId()
  const runId = generateRunId()

  // Convert previous messages to AGUI format
  const aguiMessages = convertMessagesToAGUI(previousMessages)

  // Add the new user message
  const newUserMessage: AGUIUserMessage = {
    id: `msg_${Date.now()}`,
    role: 'user',
    content: message
  }
  aguiMessages.push(newUserMessage)

  // Build state object
  const finalState = {
    ...state,
    ...(agentId && { agent_id: agentId })
  }

  // Build forwardedProps with user_id
  const forwardedProps: Record<string, unknown> = {}
  if (userId) {
    forwardedProps.user_id = userId
  }

  // Build AGUI request (all fields required by protocol)
  const request: AGUIRequest = {
    threadId: finalThreadId,
    runId,
    state: finalState,
    messages: aguiMessages,
    tools: [],
    context: [],
    forwardedProps
  }

  return request
}

/**
 * Extract agent-specific information from AGUI response
 */
export interface AGUIResponseInfo {
  threadId?: string
  runId?: string
  sessionId?: string
  agentId?: string
  content?: string
  error?: string
}

export function extractResponseInfo(
  response: Record<string, unknown>
): AGUIResponseInfo {
  return {
    threadId: response.threadId as string | undefined,
    runId: response.runId as string | undefined,
    sessionId: response.session_id as string | undefined,
    agentId: response.agent_id as string | undefined,
    content: response.content as string | undefined,
    error: response.error as string | undefined
  }
}

/**
 * Check if endpoint supports AGUI protocol
 */
export async function checkAGUISupport(
  baseUrl: string,
  authHeaders?: Record<string, string>
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      headers: {
        ...authHeaders
      }
    })

    if (!response.ok) {
      return false
    }

    // If /status endpoint exists, assume AGUI support
    // Could be enhanced to check response body for specific AGUI indicators
    return true
  } catch {
    return false
  }
}

/**
 * Parse AGUI event stream chunk
 */
export function parseAGUIChunk(chunk: unknown): {
  event: string
  data: Record<string, unknown>
} | null {
  if (typeof chunk !== 'object' || chunk === null) {
    return null
  }

  const obj = chunk as Record<string, unknown>

  // Check for new format: { event: string, data: string | object }
  if ('event' in obj && 'data' in obj) {
    const event = String(obj.event)
    let data: Record<string, unknown>

    if (typeof obj.data === 'string') {
      try {
        data = JSON.parse(obj.data)
      } catch {
        data = { content: obj.data }
      }
    } else if (typeof obj.data === 'object' && obj.data !== null) {
      data = obj.data as Record<string, unknown>
    } else {
      data = {}
    }

    return { event, data }
  }

  // Check for legacy format: direct object with event property
  if ('event' in obj && typeof obj.event === 'string') {
    return {
      event: obj.event,
      data: obj
    }
  }

  return null
}

/**
 * Convert AGUI event names to UI event names
 */
export function mapAGUIEventToUIEvent(aguiEvent: string): string {
  const eventMap: Record<string, string> = {
    message_start: 'run_started',
    message_delta: 'run_content',
    message_end: 'run_completed',
    tool_call_start: 'tool_call_started',
    tool_call_delta: 'tool_call_started',
    tool_call_end: 'tool_call_completed',
    error: 'run_error'
  }

  return eventMap[aguiEvent] || aguiEvent
}
