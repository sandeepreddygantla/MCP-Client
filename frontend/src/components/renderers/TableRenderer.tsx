/**
 * Table Renderer
 *
 * Renders tabular data (SQL results, CSV data, etc.)
 */

import React from 'react'
import type { ToolRendererProps } from './types'
import { cn } from '@/lib/utils'

interface TableData {
  columns?: string[]
  rows?: unknown[][]
  data?: Record<string, unknown>[]
}

export function TableRenderer({ data, className }: ToolRendererProps) {
  // Parse data into table format
  const tableData = parseTableData(data)

  if (!tableData || tableData.rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No data to display
      </div>
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-muted/50">
            {tableData.columns.map((column, index) => (
              <th
                key={index}
                className="text-left p-2 font-medium border-r last:border-r-0"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b hover:bg-muted/30 transition-colors"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="p-2 border-r last:border-r-0"
                >
                  {formatCellValue(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-muted-foreground mt-2 px-2">
        {tableData.rows.length} row{tableData.rows.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

/**
 * Parse unknown data into table format
 */
function parseTableData(data: unknown): TableData | null {
  if (!data) return null

  // Handle array of objects (most common)
  if (Array.isArray(data) && data.length > 0) {
    if (typeof data[0] === 'object' && data[0] !== null) {
      const columns = Object.keys(data[0])
      const rows = data.map((item) =>
        columns.map((col) => (item as Record<string, unknown>)[col])
      )
      return { columns, rows, data }
    }

    // Handle array of arrays
    if (Array.isArray(data[0])) {
      const columns = data[0].map((_, i) => `Column ${i + 1}`)
      return { columns, rows: data, data }
    }
  }

  // Handle object with columns and rows properties
  if (
    typeof data === 'object' &&
    data !== null &&
    'columns' in data &&
    'rows' in data
  ) {
    const typed = data as { columns: string[]; rows: unknown[][] }
    return {
      columns: typed.columns,
      rows: typed.rows,
      data
    }
  }

  // Handle object with data property
  if (
    typeof data === 'object' &&
    data !== null &&
    'data' in data &&
    Array.isArray((data as { data: unknown }).data)
  ) {
    const typed = data as { data: Record<string, unknown>[] }
    const columns = Object.keys(typed.data[0] || {})
    const rows = typed.data.map((item) =>
      columns.map((col) => item[col])
    )
    return { columns, rows, data: typed.data }
  }

  return null
}

/**
 * Format cell value for display
 */
function formatCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>
  }

  if (typeof value === 'boolean') {
    return <span className={value ? 'text-green-600' : 'text-red-600'}>{String(value)}</span>
  }

  if (typeof value === 'number') {
    return <span className="font-mono">{value.toLocaleString()}</span>
  }

  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > 100) {
      return (
        <span title={value}>
          {value.substring(0, 97)}...
        </span>
      )
    }
    return value
  }

  if (typeof value === 'object') {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        {JSON.stringify(value)}
      </span>
    )
  }

  return String(value)
}

/**
 * Detect if data is table-like
 */
export function isTableData(data: unknown): boolean {
  if (!data) return false

  // Array of objects
  if (Array.isArray(data) && data.length > 0) {
    if (typeof data[0] === 'object' && data[0] !== null) {
      return true
    }
    if (Array.isArray(data[0])) {
      return true
    }
  }

  // Object with columns and rows
  if (
    typeof data === 'object' &&
    data !== null &&
    'columns' in data &&
    'rows' in data
  ) {
    return true
  }

  // Object with data array
  if (
    typeof data === 'object' &&
    data !== null &&
    'data' in data &&
    Array.isArray((data as { data: unknown }).data)
  ) {
    return true
  }

  return false
}
