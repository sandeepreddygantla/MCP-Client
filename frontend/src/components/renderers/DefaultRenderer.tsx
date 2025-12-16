/**
 * Default Renderer
 *
 * Fallback renderer for unknown data types
 */

import React from 'react'
import type { ToolRendererProps } from './types'
import { cn } from '@/lib/utils'

export function DefaultRenderer({ data, toolName, className }: ToolRendererProps) {
  return (
    <div className={cn('p-4', className)}>
      <div className="space-y-2">
        {toolName && (
          <div className="text-xs font-medium text-muted-foreground">
            Tool: {toolName}
          </div>
        )}
        <div className="p-3 bg-muted/50 rounded-md">
          <pre className="text-xs overflow-x-auto">
            {formatData(data)}
          </pre>
        </div>
      </div>
    </div>
  )
}

/**
 * Format data for display
 */
function formatData(data: unknown): string {
  if (data === null || data === undefined) {
    return 'null'
  }

  if (typeof data === 'string') {
    return data
  }

  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}
