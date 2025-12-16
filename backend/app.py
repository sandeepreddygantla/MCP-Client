"""
MCP Client Application

Uses Agno's AgentOS to provide all standard endpoints automatically.
Adds custom routes for MCP server management.

IMPORTANT: AgentOS automatically manages MCPTools lifecycle (connect/disconnect).
Do not use reload=True when serving as it can break MCP connections.
"""

import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dotenv import load_dotenv

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.mcp import MCPTools
from agno.db.sqlite import SqliteDb
from agno.os import AgentOS

from mcp import StdioServerParameters

from config_manager import ConfigManager, MCPServerConfig, TransportType

# Load environment variables
load_dotenv()

# Global state
config_manager = ConfigManager()
db: Optional[SqliteDb] = None
# Track server_id -> MCPTools mapping for status reporting
server_tools_map: dict[str, MCPTools] = {}


def get_db() -> SqliteDb:
    """Get or create SQLite database."""
    global db
    if db is None:
        os.makedirs("data", exist_ok=True)
        db = SqliteDb(db_file="data/mcp_client.db")
    return db


def create_mcp_tools_instance(server: MCPServerConfig) -> MCPTools:
    """Create MCPTools instance from server configuration.

    Note: Do NOT call connect() - AgentOS manages the lifecycle automatically.
    """
    if server.transport == TransportType.STDIO:
        env = {**os.environ}
        env.update(server.env)
        server_params = StdioServerParameters(
            command=server.command,
            args=server.args,
            env=env,
        )
        return MCPTools(server_params=server_params)

    elif server.transport == TransportType.SSE:
        kwargs = {
            "transport": "sse",
            "url": server.url,
        }
        if server.headers:
            kwargs["headers"] = server.headers
        return MCPTools(**kwargs)

    elif server.transport == TransportType.STREAMABLE_HTTP:
        kwargs = {
            "transport": "streamable-http",
            "url": server.url,
        }
        if server.headers:
            kwargs["headers"] = server.headers
        return MCPTools(**kwargs)

    raise ValueError(f"Unknown transport type: {server.transport}")


def get_mcp_tools() -> List[MCPTools]:
    """Get MCPTools instances for all enabled servers.

    AgentOS will automatically manage connection lifecycle.
    Also stores mapping for status reporting.
    """
    global server_tools_map
    server_tools_map = {}  # Reset mapping

    enabled_servers = config_manager.get_enabled_servers()
    tools = []

    for server in enabled_servers:
        try:
            mcp_tool = create_mcp_tools_instance(server)
            tools.append(mcp_tool)
            server_tools_map[server.id] = mcp_tool
            print(f"Configured MCP server: {server.name}")
        except Exception as e:
            print(f"Failed to configure MCP server '{server.name}': {e}")

    return tools


def create_mcp_agent() -> Agent:
    """Create the MCP agent with tools.

    MCPTools are passed directly - AgentOS handles connection lifecycle.
    """
    config = config_manager.get_config()
    model_config = config.default_model

    model = OpenAIChat(
        id=model_config.model_id,
        temperature=model_config.temperature,
    )

    # Get MCP tools - AgentOS will manage their lifecycle
    mcp_tools = get_mcp_tools()

    return Agent(
        id="mcp-agent",
        name="MCP Agent",
        description="AI assistant with MCP server tools",
        model=model,
        tools=mcp_tools if mcp_tools else None,
        db=get_db(),
        add_history_to_context=True,
        num_history_runs=10,
        markdown=True,
        instructions=(
            "You are a helpful AI assistant with access to various tools through MCP servers. "
            "Use the available tools to help users accomplish their tasks. "
            "Always be clear about what actions you're taking and provide helpful responses."
        ),
    )


# Pydantic models for MCP server management API
class ServerCreateRequest(BaseModel):
    id: str
    name: str
    description: str = ""
    enabled: bool = True
    transport: str
    command: Optional[str] = None
    args: List[str] = []
    url: Optional[str] = None
    headers: dict = {}
    env: dict = {}
    timeout: int = 30


class ServerUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    command: Optional[str] = None
    args: Optional[List[str]] = None
    url: Optional[str] = None
    headers: Optional[dict] = None
    env: Optional[dict] = None
    timeout: Optional[int] = None


class ModelUpdateRequest(BaseModel):
    provider: Optional[str] = None
    model_id: Optional[str] = None
    api_key_env: Optional[str] = None
    base_url: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


# Create base FastAPI app for custom MCP server management routes
# Note: AgentOS handles the lifespan for MCPTools automatically
base_app = FastAPI(
    title="MCP Client",
    description="A generic MCP client for connecting to any MCP server",
    version="1.0.0",
)

# Add CORS middleware
base_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== MCP Server Management Routes ==============

@base_app.get("/api/servers")
async def list_servers():
    """List all configured MCP servers."""
    config = config_manager.get_config()
    return {"servers": [s.model_dump() for s in config.servers]}


@base_app.get("/api/servers/status")
async def get_servers_status():
    """Get connection status and tools for all configured servers."""
    config = config_manager.get_config()
    status_list = []

    for server in config.servers:
        server_status = {
            "id": server.id,
            "name": server.name,
            "enabled": server.enabled,
            "status": "disabled",
            "tools_count": 0,
            "tools": [],
            "error": None,
        }

        if server.enabled:
            # Check if we have a tools instance for this server
            if server.id in server_tools_map:
                mcp_tool = server_tools_map[server.id]
                # Check if connected by looking at functions
                if hasattr(mcp_tool, 'functions') and mcp_tool.functions:
                    server_status["status"] = "connected"
                    server_status["tools_count"] = len(mcp_tool.functions)
                    server_status["tools"] = [
                        {
                            "name": getattr(func, 'name', str(func)),
                            "description": getattr(func, 'description', ''),
                        }
                        for func in mcp_tool.functions
                    ]
                else:
                    # Tools instance exists but no functions - likely failed to connect
                    server_status["status"] = "failed"
                    server_status["error"] = "No tools available - connection may have failed"
            else:
                server_status["status"] = "not_configured"
                server_status["error"] = "Server not in active configuration"

        status_list.append(server_status)

    # Calculate totals
    total_connected = sum(1 for s in status_list if s["status"] == "connected")
    total_tools = sum(s["tools_count"] for s in status_list)

    return {
        "servers": status_list,
        "summary": {
            "total": len(status_list),
            "enabled": sum(1 for s in status_list if s["enabled"]),
            "connected": total_connected,
            "failed": sum(1 for s in status_list if s["status"] == "failed"),
            "total_tools": total_tools,
        }
    }


@base_app.get("/api/servers/{server_id}")
async def get_server(server_id: str):
    """Get a specific MCP server configuration."""
    server = config_manager.get_server_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server.model_dump()


@base_app.post("/api/servers")
async def create_server(request: ServerCreateRequest):
    """Create a new MCP server configuration."""
    try:
        server = MCPServerConfig(
            id=request.id,
            name=request.name,
            description=request.description,
            enabled=request.enabled,
            transport=TransportType(request.transport),
            command=request.command,
            args=request.args,
            url=request.url,
            headers=request.headers,
            env=request.env,
            timeout=request.timeout,
        )
        config_manager.add_server(server)
        return {"message": "Server created", "server": server.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@base_app.put("/api/servers/{server_id}")
async def update_server(server_id: str, request: ServerUpdateRequest):
    """Update an MCP server configuration."""
    try:
        updates = {k: v for k, v in request.model_dump().items() if v is not None}
        server = config_manager.update_server(server_id, updates)
        return {"message": "Server updated", "server": server.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@base_app.delete("/api/servers/{server_id}")
async def delete_server(server_id: str):
    """Delete an MCP server configuration."""
    if config_manager.delete_server(server_id):
        return {"message": "Server deleted"}
    raise HTTPException(status_code=404, detail="Server not found")


@base_app.post("/api/servers/{server_id}/toggle")
async def toggle_server(server_id: str, enabled: bool = Query(...)):
    """Enable or disable an MCP server."""
    try:
        server = config_manager.toggle_server(server_id, enabled)
        return {"message": f"Server {'enabled' if enabled else 'disabled'}", "server": server.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@base_app.post("/api/servers/reconnect")
async def reconnect_servers():
    """Reconnect to all enabled MCP servers.

    Note: This requires a server restart to take effect with AgentOS.
    AgentOS manages MCP lifecycle, so config changes need a restart.
    """
    # With AgentOS, MCP connections are managed at startup
    # Return info about configured servers
    enabled_servers = config_manager.get_enabled_servers()
    return {
        "message": "Server restart required for MCP reconnection with AgentOS",
        "configured": len(enabled_servers),
        "servers": [s.name for s in enabled_servers]
    }


@base_app.get("/api/model")
async def get_model_config():
    """Get the current model configuration."""
    config = config_manager.get_config()
    return config.default_model.model_dump()


@base_app.put("/api/model")
async def update_model_config(request: ModelUpdateRequest):
    """Update the model configuration."""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    model_config = config_manager.update_model_config(updates)
    return {"message": "Model configuration updated", "model": model_config.model_dump()}


@base_app.get("/api/tools")
async def list_tools():
    """List all available tools from connected MCP servers."""
    tools = []
    # Get tools from the agent (managed by AgentOS)
    if mcp_agent and mcp_agent.tools:
        for tool in mcp_agent.tools:
            if hasattr(tool, 'functions') and tool.functions:
                for func in tool.functions:
                    tools.append({
                        "name": getattr(func, 'name', str(func)),
                        "description": getattr(func, 'description', ''),
                    })
    return {"tools": tools, "count": len(tools)}


# ============== Create AgentOS ==============

# Create agent with MCP tools - AgentOS automatically manages MCPTools lifecycle
mcp_agent = create_mcp_agent()

# Create AgentOS instance with the agent
agent_os = AgentOS(
    name="MCP Client",
    description="A generic MCP client for connecting to any MCP server",
    agents=[mcp_agent],
    base_app=base_app,  # Include our custom MCP management routes
)

# Get the FastAPI app from AgentOS
app = agent_os.get_app()

# Add CORS middleware to the AgentOS app (must be added after get_app())
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Run the application
if __name__ == "__main__":
    agent_os.serve(app="app:app", host="0.0.0.0", port=8888, reload=False)
