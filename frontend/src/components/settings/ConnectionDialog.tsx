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
import type {
  AgentOSConnection,
  CreateConnectionInput,
  ConnectionEnvironment
} from '@/types/os'
import {
  validateConnectionInput,
  normalizeEndpoint,
  detectEnvironment,
  parseTagsString,
  formatTagsToString
} from '@/lib/connectionManager'
import { toast } from 'sonner'
import Icon from '@/components/ui/icon'

interface ConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection?: AgentOSConnection // If editing existing connection
  onSave: (input: CreateConnectionInput) => void
  onUpdate?: (id: string, input: Partial<CreateConnectionInput>) => void
}

export function ConnectionDialog({
  open,
  onOpenChange,
  connection,
  onSave,
  onUpdate
}: ConnectionDialogProps) {
  const isEditing = !!connection

  // Form state
  const [name, setName] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [environment, setEnvironment] = useState<ConnectionEnvironment>('local')
  const [tagsString, setTagsString] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  // Initialize form when dialog opens or connection changes
  useEffect(() => {
    if (connection) {
      setName(connection.name)
      setEndpoint(connection.endpoint)
      setApiKey(connection.apiKey)
      setEnvironment(connection.environment)
      setTagsString(formatTagsToString(connection.tags))
    } else {
      // Reset form for new connection
      setName('')
      setEndpoint('')
      setApiKey('')
      setEnvironment('local')
      setTagsString('')
    }
    setShowApiKey(false)
  }, [connection, open])

  // Auto-detect environment when endpoint changes
  useEffect(() => {
    if (endpoint && !isEditing) {
      const detectedEnv = detectEnvironment(endpoint)
      setEnvironment(detectedEnv)
    }
  }, [endpoint, isEditing])

  const handleSave = () => {
    const tags = parseTagsString(tagsString)

    const input: CreateConnectionInput = {
      name: name.trim(),
      endpoint: normalizeEndpoint(endpoint),
      apiKey: apiKey.trim(),
      environment,
      tags
    }

    // Validate input
    const validation = validateConnectionInput(input)
    if (!validation.valid) {
      toast.error(validation.errors[0]) // Show first error
      return
    }

    if (isEditing && onUpdate) {
      onUpdate(connection.id, input)
      toast.success('Connection updated successfully')
    } else {
      onSave(input)
      toast.success('Connection added successfully')
    }

    onOpenChange(false)
  }

  const handleTestConnection = async () => {
    if (!endpoint) {
      toast.error('Please enter an endpoint URL')
      return
    }

    setIsTesting(true)
    try {
      const normalizedEndpoint = normalizeEndpoint(endpoint)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      const response = await fetch(`${normalizedEndpoint}/status`, {
        method: 'GET',
        headers
      })

      if (response.ok) {
        toast.success('Connection successful!')
      } else if (response.status === 401) {
        toast.error('Authentication failed - check API key')
      } else {
        toast.error(`Connection failed: ${response.statusText}`)
      }
    } catch (error) {
      toast.error('Connection failed - check endpoint URL')
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-base font-medium uppercase">
            {isEditing ? 'Edit AgentOS Connection' : 'Add AgentOS Connection'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? 'Update your AgentOS connection settings'
              : 'Connect to a local or remote AgentOS instance'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
          {/* Environment Selector */}
          <div className="space-y-2">
            <Label>Environment</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={environment === 'local' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setEnvironment('local')}
              >
                <Icon type="server" size="xs" className="mr-2" />
                Local
              </Button>
              <Button
                type="button"
                variant={environment === 'live' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setEnvironment('live')}
              >
                <Icon type="globe" size="xs" className="mr-2" />
                Live
              </Button>
            </div>
            <p className="text-[10px] text-foreground-secondary">
              {environment === 'local'
                ? 'Connect to a local AgentOS running on your machine'
                : 'Connect to a live AgentOS running in your infrastructure'}
            </p>
          </div>

          {/* Endpoint URL */}
          <div className="space-y-2">
            <Label htmlFor="endpoint">Endpoint URL</Label>
            <Input
              id="endpoint"
              placeholder="http://localhost:8888"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              autoComplete="off"
            />
            <p className="text-[10px] text-foreground-secondary">
              The URL where your AgentOS is running
            </p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My AgentOS"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
            <p className="text-[10px] text-foreground-secondary">
              A friendly name to identify this connection
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder="OSK_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-accent-foreground/50 hover:text-accent-foreground"
              >
                <Icon type={showApiKey ? 'eye-off' : 'eye'} size="xs" />
              </button>
            </div>
            <p className="text-[10px] text-foreground-secondary">
              Your OS_SECURITY_KEY for authentication
            </p>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (Optional)</Label>
            <Input
              id="tags"
              placeholder="development, sql, production"
              value={tagsString}
              onChange={(e) => setTagsString(e.target.value)}
              autoComplete="off"
            />
            <p className="text-[10px] text-foreground-secondary">
              Comma-separated tags for organization
            </p>
          </div>

          {/* Test Connection */}
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={!endpoint || isTesting}
            className="w-full"
          >
            {isTesting ? (
              <>
                <Icon type="refresh" size="xs" className="mr-2 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Icon type="check" size="xs" className="mr-2" />
                Test Connection
              </>
            )}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || !endpoint || !apiKey}>
            {isEditing ? 'Update' : 'Add Connection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
