/**
 * JSON Renderer
 *
 * Renders structured JSON data with collapsible tree view
 */

import React, { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { ToolRendererProps } from './types'
import { cn } from '@/lib/utils'

export function JSONRenderer({ data, className }: ToolRendererProps) {
  if (!data || typeof data !== 'object') {
    return (
      <div className="text-sm text-muted-foreground p-4">
        Invalid JSON data
      </div>
    )
  }

  return (
    <div className={cn('p-4 font-mono text-sm', className)}>
      <JSONNode data={data} name="root" level={0} />
    </div>
  )
}

interface JSONNodeProps {
  data: unknown
  name: string
  level: number
}

function JSONNode({ data, name, level }: JSONNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2) // Auto-expand first 2 levels

  if (data === null || data === undefined) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{name}:</span>
        <span className="text-muted-foreground italic">null</span>
      </div>
    )
  }

  if (typeof data === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{name}:</span>
        <span className={data ? 'text-green-600' : 'text-red-600'}>
          {String(data)}
        </span>
      </div>
    )
  }

  if (typeof data === 'number') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{name}:</span>
        <span className="text-blue-600">{data}</span>
      </div>
    )
  }

  if (typeof data === 'string') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{name}:</span>
        <span className="text-green-600">"{data}"</span>
      </div>
    )
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{name}:</span>
          <span>[]</span>
        </div>
      )
    }

    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 hover:bg-muted/50 rounded px-1 -mx-1"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="text-muted-foreground">{name}:</span>
          <span className="text-muted-foreground text-xs">
            [{data.length} items]
          </span>
        </button>
        {isExpanded && (
          <div className="ml-4 border-l pl-2 mt-1">
            {data.map((item, index) => (
              <JSONNode
                key={index}
                data={item}
                name={String(index)}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data)

    if (keys.length === 0) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{name}:</span>
          <span>{'{}'}</span>
        </div>
      )
    }

    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 hover:bg-muted/50 rounded px-1 -mx-1"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="text-muted-foreground">{name}:</span>
          <span className="text-muted-foreground text-xs">
            {'{'}{keys.length} keys{'}'}
          </span>
        </button>
        {isExpanded && (
          <div className="ml-4 border-l pl-2 mt-1">
            {keys.map((key) => (
              <JSONNode
                key={key}
                data={(data as Record<string, unknown>)[key]}
                name={key}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{name}:</span>
      <span>{String(data)}</span>
    </div>
  )
}

/**
 * Detect if data is JSON-like (object or array)
 */
export function isJSONData(data: unknown): boolean {
  if (!data) return false

  // Don't treat arrays of simple objects as JSON (those are tables)
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0]
    if (
      typeof first === 'object' &&
      first !== null &&
      !Array.isArray(first) &&
      Object.keys(first).length < 10
    ) {
      return false // This is likely table data
    }
  }

  return typeof data === 'object' && data !== null
}
