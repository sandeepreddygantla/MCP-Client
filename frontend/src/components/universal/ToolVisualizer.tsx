/**
 * Tool Visualizer
 *
 * Universal component for rendering tool results.
 * Automatically detects data type and uses appropriate renderer.
 */

import React from 'react'
import {
  TableRenderer,
  JSONRenderer,
  TextRenderer,
  DefaultRenderer,
  isTableData,
  isJSONData,
  isTextData,
  type ToolResultType
} from '@/components/renderers'
import type { ToolCall } from '@/types/os'
import { cn } from '@/lib/utils'

interface ToolVisualizerProps {
  toolCall: ToolCall
  className?: string
}

export function ToolVisualizer({ toolCall, className }: ToolVisualizerProps) {
  const { tool_result, tool_name } = toolCall

  if (!tool_result) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No result data
      </div>
    )
  }

  // Detect tool result type
  const resultType = detectToolResultType(tool_result)

  // Render with appropriate renderer
  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {renderToolResult(tool_result, resultType, tool_name)}
    </div>
  )
}

/**
 * Detect the type of tool result
 */
export function detectToolResultType(data: unknown): ToolResultType {
  if (!data) return 'unknown'

  // Check for table data (highest priority for SQL results)
  if (isTableData(data)) {
    return 'table'
  }

  // Check for text data
  if (isTextData(data)) {
    return 'text'
  }

  // Check for JSON/structured data
  if (isJSONData(data)) {
    return 'json'
  }

  // Check for chart data (if data has chart-specific properties)
  if (isChartData(data)) {
    return 'chart'
  }

  // Check for image data
  if (isImageData(data)) {
    return 'image'
  }

  // Check for file data
  if (isFileData(data)) {
    return 'file'
  }

  return 'unknown'
}

/**
 * Render tool result with appropriate renderer
 */
function renderToolResult(
  data: unknown,
  type: ToolResultType,
  toolName?: string
): React.ReactNode {
  const commonProps = { data, toolName }

  switch (type) {
    case 'table':
      return <TableRenderer {...commonProps} />

    case 'json':
      return <JSONRenderer {...commonProps} />

    case 'text':
      return <TextRenderer {...commonProps} />

    case 'chart':
      // TODO: Implement ChartRenderer
      return <DefaultRenderer {...commonProps} />

    case 'image':
      // TODO: Implement ImageRenderer
      return <DefaultRenderer {...commonProps} />

    case 'file':
      // TODO: Implement FileRenderer
      return <DefaultRenderer {...commonProps} />

    case 'unknown':
    default:
      return <DefaultRenderer {...commonProps} />
  }
}

/**
 * Detect if data is chart data
 */
function isChartData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false

  const obj = data as Record<string, unknown>

  // Check for common chart data properties
  if ('type' in obj && typeof obj.type === 'string') {
    const chartTypes = ['bar', 'line', 'pie', 'scatter', 'area']
    if (chartTypes.includes(obj.type)) {
      return true
    }
  }

  if ('chart' in obj || 'graph' in obj) {
    return true
  }

  return false
}

/**
 * Detect if data is image data
 */
function isImageData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false

  const obj = data as Record<string, unknown>

  // Check for image URL or base64
  if ('image_url' in obj || 'imageUrl' in obj || 'url' in obj) {
    return true
  }

  if ('base64' in obj && typeof obj.base64 === 'string') {
    return true
  }

  if ('type' in obj && obj.type === 'image') {
    return true
  }

  return false
}

/**
 * Detect if data is file data
 */
function isFileData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false

  const obj = data as Record<string, unknown>

  // Check for file properties
  if ('filename' in obj || 'file_name' in obj) {
    return true
  }

  if ('download_url' in obj || 'downloadUrl' in obj) {
    return true
  }

  if ('type' in obj && obj.type === 'file') {
    return true
  }

  return false
}
