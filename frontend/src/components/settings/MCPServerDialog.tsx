'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { MCPServer, MCPTransportType, CreateMCPServerInput } from '@/types/os'
import { toast } from 'sonner'
import Icon from '@/components/ui/icon'

interface MCPServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  server?: MCPServer
  onSave: (input: CreateMCPServerInput) => void
  onUpdate?: (id: string, input: Partial<CreateMCPServerInput>) => void
}

interface EnvVar {
  key: string
  value: string
}

export function MCPServerDialog({
  open,
  onOpenChange,
  server,
  onSave,
  onUpdate
}: MCPServerDialogProps) {
  const isEditing = !!server

  // Form state
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [transport, setTransport] = useState<MCPTransportType>('stdio')
  const [command, setCommand] = useState('')
  const [argsList, setArgsList] = useState<string[]>([])
  const [url, setUrl] = useState('')
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [timeout, setTimeout] = useState(30)

  // Initialize form when dialog opens or server changes
  useEffect(() => {
    if (server) {
      setId(server.id)
      setName(server.name)
      setDescription(server.description)
      setTransport(server.transport)
      setCommand(server.command || '')
      setArgsList(server.args || [])
      setUrl(server.url || '')
      setEnvVars(
        Object.entries(server.env).map(([key, value]) => ({ key, value }))
      )
      setTimeout(server.timeout)
    } else {
      // Reset form for new server
      setId('')
      setName('')
      setDescription('')
      setTransport('stdio')
      setCommand('')
      setArgsList([])
      setUrl('')
      setEnvVars([])
      setTimeout(30)
    }
  }, [server, open])

  // Auto-generate ID from name
  useEffect(() => {
    if (!isEditing && name) {
      const generatedId = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      setId(generatedId)
    }
  }, [name, isEditing])

  // Argument handlers
  const handleAddArg = () => {
    setArgsList([...argsList, ''])
  }

  const handleRemoveArg = (index: number) => {
    setArgsList(argsList.filter((_, i) => i !== index))
  }

  const handleArgChange = (index: number, value: string) => {
    const updated = [...argsList]
    updated[index] = value
    setArgsList(updated)
  }

  // Environment variable handlers
  const handleAddEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
  }

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
  }

  const handleEnvVarChange = (
    index: number,
    field: 'key' | 'value',
    value: string
  ) => {
    const updated = [...envVars]
    updated[index][field] = value
    setEnvVars(updated)
  }

  const handleSave = () => {
    // Validation
    if (!id.trim()) {
      toast.error('Please enter a server ID')
      return
    }
    if (!name.trim()) {
      toast.error('Please enter a server name')
      return
    }
    if (transport === 'stdio' && !command.trim()) {
      toast.error('Please enter a command for stdio transport')
      return
    }
    if ((transport === 'sse' || transport === 'streamable-http') && !url.trim()) {
      toast.error('Please enter a URL for HTTP transport')
      return
    }

    // Build env object
    const env: Record<string, string> = {}
    for (const { key, value } of envVars) {
      if (key.trim()) {
        env[key.trim()] = value
      }
    }

    const input: CreateMCPServerInput = {
      id: id.trim(),
      name: name.trim(),
      description: description.trim(),
      enabled: true,
      transport,
      command: transport === 'stdio' ? command.trim() : null,
      args: transport === 'stdio' ? argsList.filter(arg => arg.trim() !== '') : [],
      url: transport !== 'stdio' ? url.trim() : null,
      env,
      timeout
    }

    if (isEditing && onUpdate) {
      onUpdate(server.id, input)
      toast.success('MCP server updated successfully')
    } else {
      onSave(input)
      toast.success('MCP server added successfully')
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-base font-medium uppercase">
            {isEditing ? 'Edit MCP Server' : 'Add MCP Server'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? 'Update your MCP server configuration'
              : 'Configure a new MCP server connection'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
          {/* Transport Type */}
          <div className="space-y-2">
            <Label>Transport Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={transport === 'stdio' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setTransport('stdio')}
              >
                <Icon type="terminal" size="xs" className="mr-2" />
                Stdio
              </Button>
              <Button
                type="button"
                variant={transport === 'streamable-http' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setTransport('streamable-http')}
              >
                <Icon type="globe" size="xs" className="mr-2" />
                HTTP
              </Button>
              <Button
                type="button"
                variant={transport === 'sse' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setTransport('sse')}
              >
                <Icon type="globe" size="xs" className="mr-2" />
                SSE
              </Button>
            </div>
            <p className="text-[10px] text-foreground-secondary">
              {transport === 'stdio'
                ? 'Run a local command (npx, uvx, or custom binary)'
                : transport === 'streamable-http'
                ? 'Connect to a remote HTTP MCP server'
                : 'Connect via Server-Sent Events'}
            </p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My MCP Server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* ID */}
          <div className="space-y-2">
            <Label htmlFor="id">Server ID</Label>
            <Input
              id="id"
              placeholder="my-mcp-server"
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={isEditing}
              autoComplete="off"
            />
            <p className="text-[10px] text-foreground-secondary">
              Unique identifier for this server (auto-generated from name)
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Access to filesystem operations"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Command (for stdio) */}
          {transport === 'stdio' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="command">Command</Label>
                <Input
                  id="command"
                  placeholder="npx"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-[10px] text-foreground-secondary">
                  The command to run (e.g., npx, uvx, node, python)
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Arguments</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddArg}
                    className="h-6 text-xs"
                  >
                    <Icon type="plus" size="xs" className="mr-1" />
                    Add Argument
                  </Button>
                </div>
                {argsList.length > 0 ? (
                  <div className="space-y-2">
                    {argsList.map((arg, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={index === 0 ? "-y" : index === 1 ? "@modelcontextprotocol/server-..." : "/path/to/directory"}
                          value={arg}
                          onChange={(e) => handleArgChange(index, e.target.value)}
                          className="flex-1 font-mono text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveArg(index)}
                          className="h-9 w-9 shrink-0"
                        >
                          <Icon type="minus" size="xs" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-foreground-secondary">
                    Add arguments one by one (supports paths with spaces)
                  </p>
                )}
              </div>
            </>
          )}

          {/* URL (for HTTP/SSE) */}
          {(transport === 'sse' || transport === 'streamable-http') && (
            <div className="space-y-2">
              <Label htmlFor="url">Server URL</Label>
              <Input
                id="url"
                placeholder="http://localhost:8000/mcp"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoComplete="off"
              />
              <p className="text-[10px] text-foreground-secondary">
                The URL of the MCP server endpoint
              </p>
            </div>
          )}

          {/* Environment Variables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Environment Variables</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddEnvVar}
                className="h-6 text-xs"
              >
                <Icon type="plus" size="xs" className="mr-1" />
                Add Variable
              </Button>
            </div>
            {envVars.length > 0 ? (
              <div className="space-y-2">
                {envVars.map((envVar, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="KEY"
                      value={envVar.key}
                      onChange={(e) =>
                        handleEnvVarChange(index, 'key', e.target.value)
                      }
                      className="flex-1 font-mono text-xs"
                    />
                    <Input
                      placeholder="value"
                      value={envVar.value}
                      onChange={(e) =>
                        handleEnvVarChange(index, 'value', e.target.value)
                      }
                      className="flex-1 font-mono text-xs"
                      type="password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEnvVar(index)}
                      className="h-9 w-9 shrink-0"
                    >
                      <Icon type="minus" size="xs" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-foreground-secondary">
                Add environment variables like API keys (e.g., GITHUB_TOKEN)
              </p>
            )}
          </div>

          {/* Timeout */}
          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (seconds)</Label>
            <Input
              id="timeout"
              type="number"
              min={1}
              max={300}
              value={timeout}
              onChange={(e) => setTimeout(parseInt(e.target.value) || 30)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              !name ||
              !id ||
              (transport === 'stdio' && !command) ||
              (transport !== 'stdio' && !url)
            }
          >
            {isEditing ? 'Update' : 'Add Server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
