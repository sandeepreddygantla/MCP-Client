"""
MCP Client Application

Uses Agno's AgentOS to provide all standard endpoints automatically.
Adds custom routes for MCP server management.
"""

import os
from pathlib import Path
from typing import List, Optional
from contextlib import asynccontextmanager

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
mcp_tools_list: List[MCPTools] = []
db: Optional[SqliteDb] = None


def get_db() -> SqliteDb:
    """Get or create SQLite database."""
    global db
    if db is None:
        os.makedirs("data", exist_ok=True)
        db = SqliteDb(db_file="data/mcp_client.db")
    return db


async def create_mcp_tools(server: MCPServerConfig) -> MCPTools:
    """Create MCPTools instance from server configuration."""
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
        return MCPTools(
            transport="sse",
            url=server.url,
            headers=server.headers or {},
        )

    elif server.transport == TransportType.STREAMABLE_HTTP:
        return MCPTools(
            transport="streamable-http",
            url=server.url,
            headers=server.headers or {},
        )

    raise ValueError(f"Unknown transport type: {server.transport}")


async def connect_mcp_servers() -> List[MCPTools]:
    """Connect to all enabled MCP servers and return tools list."""
    global mcp_tools_list

    # Disconnect existing connections
    for mcp_tool in mcp_tools_list:
        try:
            await mcp_tool.close()
        except:
            pass

    mcp_tools_list = []

    # Connect to enabled servers
    enabled_servers = config_manager.get_enabled_servers()

    for server in enabled_servers:
        try:
            mcp_tool = await create_mcp_tools(server)
            await mcp_tool.connect()
            mcp_tools_list.append(mcp_tool)
            print(f"Connected to MCP server: {server.name}")
        except Exception as e:
            print(f"Failed to connect to MCP server '{server.name}': {e}")

    return mcp_tools_list


async def disconnect_mcp_servers():
    """Disconnect from all MCP servers."""
    global mcp_tools_list
    for mcp_tool in mcp_tools_list:
        try:
            await mcp_tool.close()
        except:
            pass
    mcp_tools_list = []


def create_mcp_agent(tools: List[MCPTools]) -> Agent:
    """Create the MCP agent with tools."""
    config = config_manager.get_config()
    model_config = config.default_model

    model = OpenAIChat(
        id=model_config.model_id,
        temperature=model_config.temperature,
    )

    return Agent(
        id="mcp-agent",
        name="MCP Agent",
        description="AI assistant with MCP server tools",
        model=model,
        tools=tools if tools else None,
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


# Create custom FastAPI app for MCP server management routes
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("Starting MCP Client...")
    await connect_mcp_servers()
    yield
    print("Shutting down MCP Client...")
    await disconnect_mcp_servers()


# Create base FastAPI app with lifespan
base_app = FastAPI(
    title="MCP Client",
    description="A generic MCP client for connecting to any MCP server",
    version="1.0.0",
    lifespan=lifespan,
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
    """Reconnect to all enabled MCP servers."""
    global mcp_tools_list
    mcp_tools_list = await connect_mcp_servers()
    return {"message": "Reconnected to MCP servers", "connected": len(mcp_tools_list)}


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
    for mcp_tool in mcp_tools_list:
        if hasattr(mcp_tool, 'functions') and mcp_tool.functions:
            for func in mcp_tool.functions:
                tools.append({
                    "name": getattr(func, 'name', str(func)),
                    "description": getattr(func, 'description', ''),
                })
    return {"tools": tools, "count": len(tools)}


# ============== Create AgentOS ==============

# Create agent with MCP tools (will be updated on startup)
mcp_agent = create_mcp_agent([])

# Create AgentOS instance with the agent
agent_os = AgentOS(
    name="MCP Client",
    description="A generic MCP client for connecting to any MCP server",
    agents=[mcp_agent],
    base_app=base_app,  # Use our custom app with MCP routes
)

# Get the FastAPI app from AgentOS
app = agent_os.get_app()


# Run the application
if __name__ == "__main__":
    agent_os.serve(app="app:app", host="0.0.0.0", port=8888, reload=False)
