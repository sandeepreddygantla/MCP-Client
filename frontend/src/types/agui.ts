/**
 * AGUI (Agent User Interface) Protocol Type Definitions
 *
 * Based on Agno's AG-UI protocol specification
 * https://docs.agno.com/agent-os/interfaces/ag-ui/introduction
 */

/**
 * Message role types supported by AGUI protocol
 */
export type AGUIMessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'developer'

/**
 * Base message interface with discriminated role
 */
export interface AGUIBaseMessage {
  id: string
  role: AGUIMessageRole
}

/**
 * User message
 */
export interface AGUIUserMessage extends AGUIBaseMessage {
  role: 'user'
  content: string
}

/**
 * Assistant message with optional tool calls
 */
export interface AGUIAssistantMessage extends AGUIBaseMessage {
  role: 'assistant'
  content?: string
  toolCalls?: AGUIToolCall[]
}

/**
 * System message
 */
export interface AGUISystemMessage extends AGUIBaseMessage {
  role: 'system'
  content: string
}

/**
 * Tool result message
 */
export interface AGUIToolMessage extends AGUIBaseMessage {
  role: 'tool'
  content: string
  toolCallId: string
}

/**
 * Developer message
 */
export interface AGUIDeveloperMessage extends AGUIBaseMessage {
  role: 'developer'
  content: string
}

/**
 * Union type for all message types
 */
export type AGUIMessage =
  | AGUIUserMessage
  | AGUIAssistantMessage
  | AGUISystemMessage
  | AGUIToolMessage
  | AGUIDeveloperMessage

/**
 * Function call structure (part of tool call)
 */
export interface AGUIFunctionCall {
  name: string
  arguments: string
}

/**
 * Tool call structure (matches OpenAI format)
 */
export interface AGUIToolCall {
  id: string
  type: 'function'
  function: AGUIFunctionCall
}

/**
 * Tool definition
 */
export interface AGUITool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/**
 * Context item for additional information
 */
export interface AGUIContext {
  description: string
  value: string
}

/**
 * AGUI request format for /agui endpoint
 * All fields are required by the ag-ui protocol
 */
export interface AGUIRequest {
  /** Thread identifier for the conversation */
  threadId: string
  /** Unique identifier for this specific run */
  runId: string
  /** Current agent state - required, use {} if empty */
  state: Record<string, unknown>
  /** Array of messages in the conversation */
  messages: AGUIMessage[]
  /** Available tools for the agent - required, use [] if none */
  tools: AGUITool[]
  /** Additional context information - required, use [] if none */
  context: AGUIContext[]
  /** Forwarded properties (use for user_id, etc.) - required, use {} if empty */
  forwardedProps: Record<string, unknown>
}

/**
 * AGUI event types
 */
export enum AGUIEventType {
  MessageStart = 'message_start',
  MessageDelta = 'message_delta',
  MessageEnd = 'message_end',
  ToolCallStart = 'tool_call_start',
  ToolCallDelta = 'tool_call_delta',
  ToolCallEnd = 'tool_call_end',
  Error = 'error',
  Custom = 'custom'
}

/**
 * AGUI streaming event format (new format)
 */
export interface AGUIStreamEvent {
  /** Event type */
  event: string
  /** Event data (can be string or object) */
  data: string | Record<string, unknown>
}

/**
 * AGUI response content (legacy compatibility format)
 */
export interface AGUIResponseContent {
  event: string
  content?: string
  toolCall?: AGUIToolCall
  error?: string
  [key: string]: unknown
}

/**
 * Agent metadata from /agents endpoint
 */
export interface AGUIAgentMetadata {
  /** Agent unique identifier */
  id: string
  /** Agent display name */
  name: string
  /** Agent description */
  description?: string
  /** Agent model information */
  model?: {
    id: string
    provider: string
  }
  /** Agent capabilities */
  capabilities?: {
    hasTools: boolean
    hasKnowledge: boolean
    hasMemory: boolean
    supportsStreaming: boolean
    supportsMultimodal: boolean
  }
  /** Available tools */
  tools?: AGUITool[]
  /** Agent instructions */
  instructions?: string[]
}

/**
 * Status response from /status endpoint
 */
export interface AGUIStatusResponse {
  status: 'ok' | 'error'
  version?: string
  agents?: string[]
  teams?: string[]
  [key: string]: unknown
}

/**
 * Agent discovery response from /agents endpoint
 */
export interface AGUIAgentsResponse {
  agents: AGUIAgentMetadata[]
  count: number
}

/**
 * AGUI client configuration
 */
export interface AGUIClientConfig {
  /** Base URL for AGUI endpoint (e.g., http://localhost:7777) */
  baseUrl: string
  /** Optional authentication headers */
  authHeaders?: Record<string, string>
  /** Timeout in milliseconds */
  timeout?: number
  /** Enable debug logging */
  debug?: boolean
}

/**
 * AGUI client options for sending messages
 */
export interface AGUISendMessageOptions {
  /** Message content */
  message: string
  /** Thread ID (session ID) */
  threadId?: string
  /** Additional state to include */
  state?: Record<string, unknown>
  /** Available tools */
  tools?: AGUITool[]
  /** Additional context */
  context?: AGUIContext[]
  /** Callback for streaming chunks */
  onChunk?: (event: AGUIResponseContent) => void
  /** Callback for errors */
  onError?: (error: Error) => void
  /** Callback for completion */
  onComplete?: () => void
}

/**
 * Message conversion utilities types
 */
export interface MessageConversion {
  /** Convert UI message format to AGUI format */
  toAGUI: (uiMessage: unknown) => AGUIMessage
  /** Convert AGUI format to UI message format */
  fromAGUI: (aguiMessage: AGUIMessage) => unknown
}
