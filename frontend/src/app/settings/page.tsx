'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import { ConnectionList } from '@/components/settings/ConnectionList'
import { ConnectionDialog } from '@/components/settings/ConnectionDialog'
import { MCPServerList } from '@/components/settings/MCPServerList'
import { MCPServerDialog } from '@/components/settings/MCPServerDialog'
import { useStore } from '@/store'
import type { AgentOSConnection, CreateConnectionInput, MCPServer, CreateMCPServerInput } from '@/types/os'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isFirstRun = searchParams.get('firstRun') === 'true'

  const {
    connections,
    selectedConnectionId,
    addConnection,
    updateConnection,
    deleteConnection,
    setSelectedConnectionId
  } = useStore()

  // Connection dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConnection, setEditingConnection] =
    useState<AgentOSConnection | undefined>(undefined)

  // MCP Server state
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([])
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false)
  const [editingMcpServer, setEditingMcpServer] = useState<MCPServer | undefined>(undefined)
  const [isLoadingMcp, setIsLoadingMcp] = useState(false)
  const [activeTab, setActiveTab] = useState<'connections' | 'mcp'>('connections')

  // Get current connection endpoint
  const currentConnection = connections.find(c => c.id === selectedConnectionId)
  const apiEndpoint = currentConnection?.endpoint || 'http://localhost:8888'

  // Fetch MCP servers
  const fetchMcpServers = useCallback(async () => {
    setIsLoadingMcp(true)
    try {
      const response = await fetch(`${apiEndpoint}/api/servers`)
      if (response.ok) {
        const data = await response.json()
        // API returns {servers: [...]} so extract the array
        setMcpServers(Array.isArray(data) ? data : (data.servers || []))
      }
    } catch (error) {
      console.error('Failed to fetch MCP servers:', error)
    } finally {
      setIsLoadingMcp(false)
    }
  }, [apiEndpoint])

  // Load MCP servers on mount
  useEffect(() => {
    fetchMcpServers()
  }, [fetchMcpServers])

  // Auto-open dialog on first run
  useEffect(() => {
    if (isFirstRun && connections.length === 0) {
      setDialogOpen(true)
    }
  }, [isFirstRun, connections.length])

  const handleAddConnection = (input: CreateConnectionInput) => {
    addConnection(input)
    setDialogOpen(false)
  }

  const handleUpdateConnection = (
    id: string,
    input: Partial<CreateConnectionInput>
  ) => {
    updateConnection({ id, ...input })
    setDialogOpen(false)
    setEditingConnection(undefined)
  }

  const handleEditConnection = (connection: AgentOSConnection) => {
    setEditingConnection(connection)
    setDialogOpen(true)
  }

  const handleDeleteConnection = (id: string) => {
    if (connections.length === 1) {
      toast.error('Cannot delete the only connection')
      return
    }

    if (
      confirm(
        'Are you sure you want to delete this connection? This action cannot be undone.'
      )
    ) {
      deleteConnection(id)
      toast.success('Connection deleted successfully')
    }
  }

  const handleOpenDialog = () => {
    setEditingConnection(undefined)
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingConnection(undefined)
  }

  // MCP Server handlers
  const handleAddMcpServer = async (input: CreateMCPServerInput) => {
    try {
      const response = await fetch(`${apiEndpoint}/api/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (response.ok) {
        await fetchMcpServers()
        setMcpDialogOpen(false)
      } else {
        const error = await response.json()
        toast.error(error.detail || 'Failed to add MCP server')
      }
    } catch (error) {
      toast.error('Failed to add MCP server')
    }
  }

  const handleUpdateMcpServer = async (id: string, input: Partial<CreateMCPServerInput>) => {
    try {
      const response = await fetch(`${apiEndpoint}/api/servers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (response.ok) {
        await fetchMcpServers()
        setMcpDialogOpen(false)
        setEditingMcpServer(undefined)
      } else {
        const error = await response.json()
        toast.error(error.detail || 'Failed to update MCP server')
      }
    } catch (error) {
      toast.error('Failed to update MCP server')
    }
  }

  const handleDeleteMcpServer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this MCP server?')) {
      return
    }
    try {
      const response = await fetch(`${apiEndpoint}/api/servers/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        toast.success('MCP server deleted')
        await fetchMcpServers()
      } else {
        toast.error('Failed to delete MCP server')
      }
    } catch (error) {
      toast.error('Failed to delete MCP server')
    }
  }

  const handleToggleMcpServer = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`${apiEndpoint}/api/servers/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })
      if (response.ok) {
        await fetchMcpServers()
        toast.success(enabled ? 'MCP server enabled' : 'MCP server disabled')
      } else {
        toast.error('Failed to toggle MCP server')
      }
    } catch (error) {
      toast.error('Failed to toggle MCP server')
    }
  }

  const handleEditMcpServer = (server: MCPServer) => {
    setEditingMcpServer(server)
    setMcpDialogOpen(true)
  }

  const handleOpenMcpDialog = () => {
    setEditingMcpServer(undefined)
    setMcpDialogOpen(true)
  }

  const handleCloseMcpDialog = () => {
    setMcpDialogOpen(false)
    setEditingMcpServer(undefined)
  }

  const handleReconnectServers = async () => {
    try {
      const response = await fetch(`${apiEndpoint}/api/servers/reconnect`, {
        method: 'POST'
      })
      if (response.ok) {
        toast.success('MCP servers reconnected')
        await fetchMcpServers()
      } else {
        toast.error('Failed to reconnect MCP servers')
      }
    } catch (error) {
      toast.error('Failed to reconnect MCP servers')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-dmmono">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="gap-2"
            >
              <Icon type="arrow-left" size="xs" />
              Back to Chat
            </Button>
            <div className="h-6 w-px bg-border/20" />
            <div className="flex items-center gap-2">
              <Icon type="agno" size="xs" />
              <h1 className="text-sm font-medium uppercase">
                Connection Settings
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          {/* Tabs */}
          <div className="mb-8 flex gap-4 border-b border-border/20">
            <button
              onClick={() => setActiveTab('connections')}
              className={`pb-3 text-sm font-medium uppercase transition-colors ${
                activeTab === 'connections'
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              <Icon type="server" size="xs" className="mr-2 inline" />
              Connections
            </button>
            <button
              onClick={() => setActiveTab('mcp')}
              className={`pb-3 text-sm font-medium uppercase transition-colors ${
                activeTab === 'mcp'
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              <Icon type="terminal" size="xs" className="mr-2 inline" />
              MCP Servers
            </button>
          </div>

          {/* Connections Tab */}
          {activeTab === 'connections' && (
            <>
              {/* Page Header */}
              <div className="mb-8">
                <h2 className="mb-2 text-2xl font-bold text-foreground">
                  AgentOS Connections
                </h2>
                <p className="text-sm text-foreground-secondary">
                  Manage your AgentOS connections. Connect to local development
                  instances or live production servers.
                </p>
              </div>


              {/* Add Connection Button */}
              <div className="mb-6 flex items-center justify-between">
                <div className="text-xs text-foreground-secondary">
                  {connections.length}{' '}
                  {connections.length === 1 ? 'connection' : 'connections'}
                </div>
                <Button onClick={handleOpenDialog} size="sm" className="gap-2">
                  <Icon type="plus-icon" size="xs" />
                  Add Connection
                </Button>
              </div>

              {/* Connections List */}
              <ConnectionList
                connections={connections}
                selectedConnectionId={selectedConnectionId}
                onSelectConnection={setSelectedConnectionId}
                onEditConnection={handleEditConnection}
                onDeleteConnection={handleDeleteConnection}
              />
            </>
          )}

          {/* MCP Servers Tab */}
          {activeTab === 'mcp' && (
            <>
              {/* Page Header */}
              <div className="mb-8">
                <h2 className="mb-2 text-2xl font-bold text-foreground">
                  MCP Servers
                </h2>
                <p className="text-sm text-foreground-secondary">
                  Configure Model Context Protocol (MCP) servers to give your agents
                  access to external tools and services.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-xs text-foreground-secondary">
                    {mcpServers.length}{' '}
                    {mcpServers.length === 1 ? 'server' : 'servers'}
                    {' '} ({mcpServers.filter(s => s.enabled).length} enabled)
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReconnectServers}
                    className="gap-2"
                  >
                    <Icon type="refresh" size="xs" />
                    Reconnect All
                  </Button>
                </div>
                <Button onClick={handleOpenMcpDialog} size="sm" className="gap-2">
                  <Icon type="plus-icon" size="xs" />
                  Add MCP Server
                </Button>
              </div>

              {/* MCP Servers List */}
              {isLoadingMcp ? (
                <div className="flex items-center justify-center py-12">
                  <Icon type="refresh" size="sm" className="animate-spin text-foreground-secondary" />
                </div>
              ) : (
                <MCPServerList
                  servers={mcpServers}
                  onEdit={handleEditMcpServer}
                  onDelete={handleDeleteMcpServer}
                  onToggle={handleToggleMcpServer}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Connection Dialog */}
      <ConnectionDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        connection={editingConnection}
        onSave={handleAddConnection}
        onUpdate={handleUpdateConnection}
      />

      {/* MCP Server Dialog */}
      <MCPServerDialog
        open={mcpDialogOpen}
        onOpenChange={handleCloseMcpDialog}
        server={editingMcpServer}
        onSave={handleAddMcpServer}
        onUpdate={handleUpdateMcpServer}
      />
    </div>
  )
}
