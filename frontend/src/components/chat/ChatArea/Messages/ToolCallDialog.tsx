import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import Icon from '@/components/ui/icon'
import { ToolCall } from '@/types/os'

interface ToolCallDialogProps {
  tool: ToolCall
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ToolCallDialog({ tool, open, onOpenChange }: ToolCallDialogProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const getToolResult = (): string | null => {
    const toolData = tool as any

    if (tool.content) {
      return tool.content
    }

    const possibleResultKeys = ['result', 'output', 'response', 'data', 'value']
    for (const key of possibleResultKeys) {
      if (toolData[key]) {
        return typeof toolData[key] === 'string'
          ? toolData[key]
          : JSON.stringify(toolData[key], null, 2)
      }
    }

    return null
  }

  const extractValueFromJSON = (jsonString: string): string => {
    try {
      const parsed = JSON.parse(jsonString)

      if (typeof parsed === 'object' && parsed !== null) {
        const keys = Object.keys(parsed)

        if (keys.length === 1) {
          const value = parsed[keys[0]]
          if (typeof value === 'string') {
            return value
          }
        }

        const queryKeys = ['query', 'sql', 'command', 'statement', 'code', 'script']
        for (const key of queryKeys) {
          if (parsed[key] && typeof parsed[key] === 'string') {
            return parsed[key]
          }
        }
      }

      return jsonString
    } catch {
      return jsonString
    }
  }

  const copyToClipboard = async (text: string, section: string) => {
    try {
      let textToCopy = text

      if (section === 'args') {
        textToCopy = extractValueFromJSON(text)
      }

      await navigator.clipboard.writeText(textToCopy)
      setCopiedSection(section)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopiedSection(null), 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const formatContent = (content: string | null) => {
    if (!content) return ''
    try {
      const parsed = JSON.parse(content)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return content
    }
  }

  const formatArgs = (args: Record<string, unknown>) => {
    if (!args || Object.keys(args).length === 0) return ''
    return JSON.stringify(args, null, 2)
  }

  const getArgKeys = (args: Record<string, unknown>) => {
    return Object.keys(args || {})
  }

  const renderArgValue = (value: unknown) => {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2)

    const isSQLQuery = stringValue.trim().toUpperCase().match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)/)

    if (isSQLQuery) {
      return (
        <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-primary">
          {stringValue}
        </pre>
      )
    }

    return (
      <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-accent-foreground">
        {stringValue}
      </pre>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col border-border/30 bg-card">
        <DialogHeader className="border-b border-border/30 pb-4">
          <DialogTitle className="font-dmmono uppercase text-2xl tracking-wide flex items-center gap-3 text-card-foreground">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
              <Icon type="hammer" size="xs" className="text-primary" />
            </div>
            {tool.tool_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-2 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                <Icon type="hammer" size="xs" className="text-primary" />
                <span>Tool Name</span>
              </div>
              <button
                onClick={() => copyToClipboard(tool.tool_name, 'name')}
                className="p-2 rounded-md hover:bg-accent transition-all duration-200 group"
                aria-label="Copy tool name"
              >
                <Icon
                  type={copiedSection === 'name' ? 'check' : 'copy'}
                  size="xs"
                  className={copiedSection === 'name' ? 'text-positive' : 'text-muted-foreground group-hover:text-foreground'}
                />
              </button>
            </div>
            <div className="relative rounded-xl bg-accent border border-border/30 p-4">
              <p className="font-dmmono text-sm text-accent-foreground">
                {tool.tool_name}
              </p>
            </div>
          </div>

          <div className="h-px bg-border/30" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                <Icon type="edit" size="xs" className="text-primary" />
                <span>Arguments</span>
              </div>
              {getArgKeys(tool.tool_args).length > 0 && (
                <button
                  onClick={() => copyToClipboard(formatArgs(tool.tool_args), 'args')}
                  className="p-2 rounded-md hover:bg-accent transition-all duration-200 group"
                  aria-label="Copy arguments"
                >
                  <Icon
                    type={copiedSection === 'args' ? 'check' : 'copy'}
                    size="xs"
                    className={copiedSection === 'args' ? 'text-positive' : 'text-muted-foreground group-hover:text-foreground'}
                  />
                </button>
              )}
            </div>
            <div className="rounded-xl bg-accent border border-border/30 overflow-hidden">
              {getArgKeys(tool.tool_args).length > 0 ? (
                <div className="divide-y divide-border/30">
                  {getArgKeys(tool.tool_args).map((key) => {
                    const value = tool.tool_args[key]
                    return (
                      <div key={key} className="p-4 space-y-2 hover:bg-accent/80 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {key}
                          </span>
                        </div>
                        <div className="font-dmmono text-sm text-accent-foreground">
                          {renderArgValue(value)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No arguments provided</p>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-border/30" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                <Icon type="list" size="xs" className="text-positive" />
                <span>Result</span>
              </div>
              {getToolResult() && (
                <button
                  onClick={() => copyToClipboard(formatContent(getToolResult()), 'result')}
                  className="p-2 rounded-md hover:bg-accent transition-all duration-200 group"
                  aria-label="Copy result"
                >
                  <Icon
                    type={copiedSection === 'result' ? 'check' : 'copy'}
                    size="xs"
                    className={copiedSection === 'result' ? 'text-positive' : 'text-muted-foreground group-hover:text-foreground'}
                  />
                </button>
              )}
            </div>
            <div className="rounded-xl bg-accent border border-border/30 overflow-hidden">
              <div className="p-4 max-h-80 overflow-auto">
                {getToolResult() ? (
                  <pre className="font-dmmono text-sm leading-relaxed whitespace-pre-wrap break-words text-accent-foreground">
                    {formatContent(getToolResult())}
                  </pre>
                ) : (
                  <div className="py-4 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Waiting for result...</p>
                    <p className="text-xs text-muted-foreground">Tool execution may still be in progress</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {tool.tool_call_error && (
            <>
              <div className="h-px bg-border/30" />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <Icon type="alert-triangle" size="xs" />
                  <span>Error</span>
                </div>
                <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4">
                  <p className="text-sm text-destructive">Tool execution failed</p>
                </div>
              </div>
            </>
          )}

          {tool.metrics?.time && (
            <>
              <div className="h-px bg-border/30" />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                  <Icon type="clock" size="xs" className="text-primary" />
                  <span>Execution Time</span>
                </div>
                <div className="rounded-xl bg-accent border border-border/30 p-4">
                  <p className="font-dmmono text-sm text-accent-foreground">
                    {tool.metrics.time.toFixed(3)}s
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
