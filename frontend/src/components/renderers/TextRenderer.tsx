/**
 * Text Renderer
 *
 * Renders plain text content
 */

import React from 'react'
import type { ToolRendererProps } from './types'
import { cn } from '@/lib/utils'

export function TextRenderer({ data, className }: ToolRendererProps) {
  const textContent = extractText(data)

  if (!textContent) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No text content
      </div>
    )
  }

  return (
    <div className={cn('p-4 text-sm whitespace-pre-wrap', className)}>
      {textContent}
    </div>
  )
}

/**
 * Extract text from data
 */
function extractText(data: unknown): string {
  if (typeof data === 'string') {
    return data
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return String(data)
  }

  if (data === null || data === undefined) {
    return ''
  }

  if (typeof data === 'object' && 'text' in data) {
    return String((data as { text: unknown }).text)
  }

  if (typeof data === 'object' && 'content' in data) {
    return String((data as { content: unknown }).content)
  }

  if (typeof data === 'object' && 'message' in data) {
    return String((data as { message: unknown }).message)
  }

  return JSON.stringify(data, null, 2)
}

/**
 * Detect if data is text
 */
export function isTextData(data: unknown): boolean {
  if (typeof data === 'string') {
    return true
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return true
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    ('text' in data || 'content' in data || 'message' in data)
  ) {
    return true
  }

  return false
}
