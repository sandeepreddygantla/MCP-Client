/**
 * Tool Renderer Type Definitions
 */

export type ToolResultType =
  | 'table'
  | 'chart'
  | 'json'
  | 'text'
  | 'image'
  | 'file'
  | 'unknown'

export interface ToolRendererProps {
  data: unknown
  toolName?: string
  className?: string
}

export interface ToolRenderer {
  type: ToolResultType
  component: React.ComponentType<ToolRendererProps>
  detect: (data: unknown) => boolean
}
