export interface ToolCall {
  role: 'user' | 'tool' | 'system' | 'assistant'
  content: string | null
  tool_call_id: string
  tool_name: string
  tool_args: Record<string, string>
  tool_call_error: boolean
  metrics: {
    time: number
  }
  created_at: number
}

export interface ReasoningSteps {
  title: string
  action?: string
  result: string
  reasoning: string
  confidence?: number
  next_action?: string
}
export interface ReasoningStepProps {
  index: number
  stepTitle: string
}
export interface ReasoningProps {
  reasoning: ReasoningSteps[]
}

export type ToolCallProps = {
  tools: ToolCall
}
interface ModelMessage {
  content: string | null
  context?: MessageContext[]
  created_at: number
  metrics?: {
    time: number
    prompt_tokens: number
    input_tokens: number
    completion_tokens: number
    output_tokens: number
  }
  name: string | null
  role: string
  tool_args?: unknown
  tool_call_id: string | null
  tool_calls: Array<{
    function: {
      arguments: string
      name: string
    }
    id: string
    type: string
  }> | null
}

export interface Model {
  name: string
  model: string
  provider: string
}

export interface Agent {
  agent_id: string
  name: string
  description: string
  model: Model
  storage?: boolean
}

export interface Team {
  team_id: string
  name: string
  description: string
  model: Model
  storage?: boolean
}

interface MessageContext {
  query: string
  docs?: Array<Record<string, object>>
  time?: number
}

export enum RunEvent {
  RunStarted = 'RunStarted',
  RunContent = 'RunContent',
  RunCompleted = 'RunCompleted',
  RunError = 'RunError',
  RunOutput = 'RunOutput',
  UpdatingMemory = 'UpdatingMemory',
  ToolCallStarted = 'ToolCallStarted',
  ToolCallCompleted = 'ToolCallCompleted',
  MemoryUpdateStarted = 'MemoryUpdateStarted',
  MemoryUpdateCompleted = 'MemoryUpdateCompleted',
  ReasoningStarted = 'ReasoningStarted',
  ReasoningStep = 'ReasoningStep',
  ReasoningCompleted = 'ReasoningCompleted',
  RunCancelled = 'RunCancelled',
  RunPaused = 'RunPaused',
  RunContinued = 'RunContinued',
  // Team Events
  TeamRunStarted = 'TeamRunStarted',
  TeamRunContent = 'TeamRunContent',
  TeamRunCompleted = 'TeamRunCompleted',
  TeamRunError = 'TeamRunError',
  TeamRunCancelled = 'TeamRunCancelled',
  TeamToolCallStarted = 'TeamToolCallStarted',
  TeamToolCallCompleted = 'TeamToolCallCompleted',
  TeamReasoningStarted = 'TeamReasoningStarted',
  TeamReasoningStep = 'TeamReasoningStep',
  TeamReasoningCompleted = 'TeamReasoningCompleted',
  TeamMemoryUpdateStarted = 'TeamMemoryUpdateStarted',
  TeamMemoryUpdateCompleted = 'TeamMemoryUpdateCompleted'
}

export interface ResponseAudio {
  id?: string
  content?: string
  transcript?: string
  channels?: number
  sample_rate?: number
}

export interface NewRunResponse {
  status: 'RUNNING' | 'PAUSED' | 'CANCELLED'
}

export interface RunResponseContent {
  content?: string | object
  content_type: string
  context?: MessageContext[]
  event: RunEvent
  event_data?: object
  messages?: ModelMessage[]
  metrics?: object
  model?: string
  run_id?: string
  agent_id?: string
  session_id?: string
  tool?: ToolCall
  tools?: Array<ToolCall>
  created_at: number
  extra_data?: AgentExtraData
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}

export interface RunResponse {
  content?: string | object
  content_type: string
  context?: MessageContext[]
  event: RunEvent
  event_data?: object
  messages?: ModelMessage[]
  metrics?: object
  model?: string
  run_id?: string
  agent_id?: string
  session_id?: string
  tool?: ToolCall
  tools?: Array<ToolCall>
  created_at: number
  extra_data?: AgentExtraData
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}

export interface AgentExtraData {
  reasoning_steps?: ReasoningSteps[]
  reasoning_messages?: ReasoningMessage[]
  references?: ReferenceData[]
}

export interface AgentExtraData {
  reasoning_messages?: ReasoningMessage[]
  references?: ReferenceData[]
}

export interface ReasoningMessage {
  role: 'user' | 'tool' | 'system' | 'assistant'
  content: string | null
  tool_call_id?: string
  tool_name?: string
  tool_args?: Record<string, string>
  tool_call_error?: boolean
  metrics?: {
    time: number
  }
  created_at?: number
}
export interface ChatMessage {
  role: 'user' | 'agent' | 'system' | 'tool'
  content: string
  streamingError?: boolean
  created_at: number
  tool_calls?: ToolCall[]
  extra_data?: {
    reasoning_steps?: ReasoningSteps[]
    reasoning_messages?: ReasoningMessage[]
    references?: ReferenceData[]
  }
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}

export interface AgentDetails {
  id: string
  name?: string
  db_id?: string
  // Model
  model?: Model
}

export interface TeamDetails {
  id: string
  name?: string
  db_id?: string

  // Model
  model?: Model
}

export interface ImageData {
  revised_prompt: string
  url: string
}

export interface VideoData {
  id: number
  eta: number
  url: string
}

export interface AudioData {
  base64_audio?: string
  mime_type?: string
  url?: string
  id?: string
  content?: string
  channels?: number
  sample_rate?: number
}

export interface ReferenceData {
  query: string
  references: Reference[]
  time?: number
}

export interface Reference {
  content: string
  meta_data: {
    chunk: number
    chunk_size: number
  }
  name: string
}

export interface SessionEntry {
  session_id: string
  session_name: string
  created_at: number
  updated_at?: number
  agent_id?: string  // AGUI: Track which agent this session belongs to
  agent_name?: string  // AGUI: Display agent name in session list
}

export interface Pagination {
  page: number
  limit: number
  total_pages: number
  total_count: number
}

export interface Sessions extends SessionEntry {
  data: SessionEntry[]
  meta: Pagination
}

export interface ChatEntry {
  message: {
    role: 'user' | 'system' | 'tool' | 'assistant'
    content: string
    created_at: number
  }
  response: {
    content: string
    tools?: ToolCall[]
    extra_data?: {
      reasoning_steps?: ReasoningSteps[]
      reasoning_messages?: ReasoningMessage[]
      references?: ReferenceData[]
    }
    images?: ImageData[]
    videos?: VideoData[]
    audio?: AudioData[]
    response_audio?: {
      transcript?: string
    }
    created_at: number
  }
}

/**
 * AgentOS Connection Management Types
 *
 * These types support multi-connection architecture where a single hosted UI
 * can connect to multiple AgentOS instances (local or remote).
 */

export type ConnectionEnvironment = 'local' | 'live'

export interface AgentOSConnection {
  /** Unique identifier for the connection */
  id: string

  /** User-friendly name for the connection (e.g., "SQL Server Agent - Dev") */
  name: string

  /** AgentOS endpoint URL (e.g., "http://localhost:7777" or "https://api.example.com") */
  endpoint: string

  /** Bearer token (OS_SECURITY_KEY) for this specific connection */
  apiKey: string

  /** Environment type - local for development, live for production */
  environment: ConnectionEnvironment

  /** Optional tags for organizing connections (e.g., ["development", "sql"]) */
  tags?: string[]

  /** Current health status of the connection */
  isActive: boolean

  /** Last successful connection timestamp */
  lastConnected?: number

  /** Connection creation timestamp */
  createdAt: number

  /** Connection last update timestamp */
  updatedAt?: number
}

export interface CreateConnectionInput {
  name: string
  endpoint: string
  apiKey: string
  environment: ConnectionEnvironment
  tags?: string[]
}

export interface UpdateConnectionInput {
  id: string
  name?: string
  endpoint?: string
  apiKey?: string
  environment?: ConnectionEnvironment
  tags?: string[]
}

export interface ConnectionHealthStatus {
  connectionId: string
  isActive: boolean
  lastChecked: number
  error?: string
}

/**
 * MCP Server Configuration Types
 */

export type MCPTransportType = 'stdio' | 'sse' | 'streamable-http'

export interface MCPServer {
  id: string
  name: string
  description: string
  enabled: boolean
  transport: MCPTransportType
  command: string | null
  args: string[]
  url: string | null
  headers: Record<string, string>
  env: Record<string, string>
  timeout: number
  sse_read_timeout: number
}

export interface CreateMCPServerInput {
  id: string
  name: string
  description?: string
  enabled?: boolean
  transport: MCPTransportType
  command?: string | null
  args?: string[]
  url?: string | null
  headers?: Record<string, string>
  env?: Record<string, string>
  timeout?: number
  sse_read_timeout?: number
}

export interface UpdateMCPServerInput {
  name?: string
  description?: string
  enabled?: boolean
  command?: string | null
  args?: string[]
  url?: string | null
  headers?: Record<string, string>
  env?: Record<string, string>
  timeout?: number
  sse_read_timeout?: number
}

/**
 * MCP Server Status Types
 */

export type MCPServerConnectionStatus = 'connected' | 'failed' | 'disabled' | 'not_configured'

export interface MCPServerTool {
  name: string
  description: string
}

export interface MCPServerStatus {
  id: string
  name: string
  enabled: boolean
  status: MCPServerConnectionStatus
  tools_count: number
  tools: MCPServerTool[]
  error: string | null
}

export interface MCPServersStatusResponse {
  servers: MCPServerStatus[]
  summary: {
    total: number
    enabled: number
    connected: number
    failed: number
    total_tools: number
  }
}
