"""
MCP Client Application

API backend for MCP client that integrates with the AgentOS frontend.
Provides REST and streaming endpoints for managing MCP servers and chat sessions.
"""

import os
import json
import time
import asyncio
import uuid
from pathlib import Path
from typing import List, Optional, AsyncGenerator
from contextlib import asynccontextmanager
from enum import Enum

from fastapi import FastAPI, HTTPException, Query, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from dotenv import load_dotenv

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.mcp import MCPTools
from agno.db.sqlite import SqliteDb
from agno.os import AgentOS

from mcp import StdioServerParameters

from .config_manager import ConfigManager, MCPServerConfig, TransportType, ModelConfig

# Load environment variables
load_dotenv()


# RunEvent enum matching frontend expectations
class RunEvent(str, Enum):
    RunStarted = "RunStarted"
    RunContent = "RunContent"
    RunCompleted = "RunCompleted"
    RunError = "RunError"
    ToolCallStarted = "ToolCallStarted"
    ToolCallCompleted = "ToolCallCompleted"
    MemoryUpdateStarted = "MemoryUpdateStarted"
    MemoryUpdateCompleted = "MemoryUpdateCompleted"
    ReasoningStarted = "ReasoningStarted"
    ReasoningStep = "ReasoningStep"
    ReasoningCompleted = "ReasoningCompleted"


# Pydantic models for API
class ServerCreateRequest(BaseModel):
    id: str
    name: str
    description: str = ""
    enabled: bool = True
    transport: str  # "stdio", "sse", "streamable-http"
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


class ChatRequest(BaseModel):
    message: str
    user_id: str = "default"
    session_id: Optional[str] = None


# ToolCall model matching frontend expectations
class ToolCallInfo(BaseModel):
    role: str = "tool"
    content: Optional[str] = None
    tool_call_id: str = ""
    tool_name: str = "unknown"
    tool_args: dict = {}
    tool_call_error: bool = False
    metrics: dict = {"time": 0}
    created_at: int = 0


class ChatResponse(BaseModel):
    response: str
    session_id: str
    tool_calls: List[ToolCallInfo] = []


# Model info for agent
class ModelInfo(BaseModel):
    name: str = ""
    model: str = ""
    provider: str = "openai"


# Agent info for /agents endpoint
class AgentInfo(BaseModel):
    agent_id: str
    name: str
    description: str = ""
    model: ModelInfo
    storage: bool = True


# Session info for /sessions endpoint
class SessionInfo(BaseModel):
    session_id: str
    session_name: str
    created_at: int
    updated_at: Optional[int] = None
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None


# RunResponse for SSE streaming
class RunResponseEvent(BaseModel):
    event: str
    content: Optional[str] = None
    content_type: str = "text"
    session_id: Optional[str] = None
    run_id: Optional[str] = None
    agent_id: Optional[str] = None
    tool: Optional[ToolCallInfo] = None
    tools: Optional[List[ToolCallInfo]] = None
    created_at: int = 0


# Global state
config_manager = ConfigManager()
mcp_tools_list: List[MCPTools] = []
agent: Optional[Agent] = None
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


async def connect_mcp_servers():
    """Connect to all enabled MCP servers."""
    global mcp_tools_list, agent

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

    # Create or update the agent
    config = config_manager.get_config()
    model_config = config.default_model

    model = OpenAIChat(
        id=model_config.model_id,
        temperature=model_config.temperature,
    )

    agent = Agent(
        id="mcp-agent",
        name="MCP Agent",
        model=model,
        tools=mcp_tools_list if mcp_tools_list else None,
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


async def disconnect_mcp_servers():
    """Disconnect from all MCP servers."""
    global mcp_tools_list
    for mcp_tool in mcp_tools_list:
        try:
            await mcp_tool.close()
        except:
            pass
    mcp_tools_list = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    print("Starting MCP Client...")
    await connect_mcp_servers()
    yield
    # Shutdown
    print("Shutting down MCP Client...")
    await disconnect_mcp_servers()


# Create FastAPI app
app = FastAPI(
    title="MCP Client",
    description="A generic MCP client for connecting to any MCP server",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== API Routes ==============

# ----- MCP Server Management -----

@app.get("/api/servers")
async def list_servers():
    """List all configured MCP servers."""
    config = config_manager.get_config()
    return {"servers": [s.model_dump() for s in config.servers]}


@app.get("/api/servers/{server_id}")
async def get_server(server_id: str):
    """Get a specific MCP server configuration."""
    server = config_manager.get_server_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server.model_dump()


@app.post("/api/servers")
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


@app.put("/api/servers/{server_id}")
async def update_server(server_id: str, request: ServerUpdateRequest):
    """Update an MCP server configuration."""
    try:
        updates = {k: v for k, v in request.model_dump().items() if v is not None}
        server = config_manager.update_server(server_id, updates)
        return {"message": "Server updated", "server": server.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/api/servers/{server_id}")
async def delete_server(server_id: str):
    """Delete an MCP server configuration."""
    if config_manager.delete_server(server_id):
        return {"message": "Server deleted"}
    raise HTTPException(status_code=404, detail="Server not found")


@app.post("/api/servers/{server_id}/toggle")
async def toggle_server(server_id: str, enabled: bool = Query(...)):
    """Enable or disable an MCP server."""
    try:
        server = config_manager.toggle_server(server_id, enabled)
        return {"message": f"Server {'enabled' if enabled else 'disabled'}", "server": server.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/servers/reconnect")
async def reconnect_servers():
    """Reconnect to all enabled MCP servers."""
    await connect_mcp_servers()
    return {"message": "Reconnected to MCP servers", "connected": len(mcp_tools_list)}


# ----- Model Configuration -----

@app.get("/api/model")
async def get_model_config():
    """Get the current model configuration."""
    config = config_manager.get_config()
    return config.default_model.model_dump()


@app.put("/api/model")
async def update_model_config(request: ModelUpdateRequest):
    """Update the model configuration."""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    model_config = config_manager.update_model_config(updates)
    # Reconnect with new model
    await connect_mcp_servers()
    return {"message": "Model configuration updated", "model": model_config.model_dump()}


# ----- Tools -----

@app.get("/api/tools")
async def list_tools():
    """List all available tools from connected MCP servers."""
    tools = []
    for mcp_tool in mcp_tools_list:
        # Try different ways to access tools from MCPTools
        tool_list = None
        if hasattr(mcp_tool, 'functions') and mcp_tool.functions:
            tool_list = mcp_tool.functions
        elif hasattr(mcp_tool, 'tools') and mcp_tool.tools:
            tool_list = mcp_tool.tools
        elif hasattr(mcp_tool, '_tools') and mcp_tool._tools:
            tool_list = mcp_tool._tools

        if tool_list:
            for tool in tool_list:
                tools.append({
                    "name": getattr(tool, 'name', str(tool)),
                    "description": getattr(tool, 'description', ''),
                })

    # Also try to get tools from the agent if available
    if agent and hasattr(agent, 'tools') and agent.tools and not tools:
        for tool in agent.tools:
            if hasattr(tool, 'functions'):
                for func in tool.functions:
                    tools.append({
                        "name": getattr(func, 'name', str(func)),
                        "description": getattr(func, 'description', ''),
                    })

    return {"tools": tools, "count": len(tools)}


# ----- Agents (AgentOS-compatible) -----

@app.get("/agents")
async def list_agents():
    """List all available agents (AgentOS-compatible endpoint)."""
    config = config_manager.get_config()
    model_config = config.default_model

    # Return our MCP agent - using 'id' to match frontend AgentDetails interface
    agents = [
        {
            "id": "mcp-agent",
            "name": "MCP Agent",
            "description": "AI assistant with MCP server tools",
            "model": {
                "name": model_config.model_id,
                "model": model_config.model_id,
                "provider": model_config.provider,
            },
            "storage": True
        }
    ]
    return agents


@app.get("/teams")
async def list_teams():
    """List all available teams (AgentOS-compatible endpoint). Returns empty as this is an MCP client."""
    return []


@app.post("/agents/{agent_id}/runs")
async def agent_run(
    agent_id: str,
    message: str = Form(...),
    session_id: Optional[str] = Form(None),
    stream: bool = Form(True),
    user_id: str = Form("default"),
    images: Optional[List[UploadFile]] = File(None),
):
    """
    Run an agent with streaming response (AgentOS-compatible endpoint).
    Returns Server-Sent Events with RunEvent types.
    Uses Agno's native streaming to capture tool call events in real-time.
    """
    global agent

    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    if agent_id != "mcp-agent":
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    async def generate_sse_response() -> AsyncGenerator[str, None]:
        """Generate SSE events for the agent run using Agno's streaming."""
        nonlocal session_id
        from agno.run.agent import RunEvent as AgnoRunEvent

        run_id = str(uuid.uuid4())
        current_time = int(time.time())

        # Set up agent for this request
        agent.user_id = user_id
        if session_id:
            agent.session_id = session_id
        else:
            session_id = str(uuid.uuid4())
            agent.session_id = session_id

        # Track tool calls for this run
        tool_calls = []
        tool_call_map = {}  # tool_call_id -> tool_info
        accumulated_content = ""

        try:
            # Send RunStarted event
            start_event = {
                "event": RunEvent.RunStarted.value,
                "content": None,
                "content_type": "text",
                "session_id": session_id,
                "run_id": run_id,
                "agent_id": agent_id,
                "created_at": current_time
            }
            yield f"data: {json.dumps(start_event)}\n\n"

            # Use Agno's streaming with stream_events=True for real-time tool events
            # Note: arun with stream=True returns an async generator directly (no await)
            response_stream = agent.arun(message, stream=True, stream_events=True)

            async for chunk in response_stream:
                chunk_event = getattr(chunk, 'event', None)
                chunk_time = int(time.time())

                # Handle tool call started
                if chunk_event == AgnoRunEvent.tool_call_started:
                    tool = getattr(chunk, 'tool', None)
                    if tool:
                        tc_id = getattr(tool, 'tool_call_id', None) or str(uuid.uuid4())
                        tc_name = getattr(tool, 'tool_name', None) or getattr(tool, 'name', 'unknown')
                        tc_args = getattr(tool, 'tool_args', None) or getattr(tool, 'arguments', {}) or {}

                        tool_info = {
                            "role": "tool",
                            "content": None,
                            "tool_call_id": tc_id,
                            "tool_name": tc_name,
                            "tool_args": tc_args if isinstance(tc_args, dict) else {},
                            "tool_call_error": False,
                            "metrics": {"time": 0},
                            "created_at": chunk_time
                        }
                        tool_calls.append(tool_info)
                        tool_call_map[tc_id] = tool_info

                        # Send ToolCallStarted event
                        tool_started_event = {
                            "event": RunEvent.ToolCallStarted.value,
                            "content": None,
                            "content_type": "text",
                            "session_id": session_id,
                            "run_id": run_id,
                            "agent_id": agent_id,
                            "tool": tool_info,
                            "created_at": chunk_time
                        }
                        yield f"data: {json.dumps(tool_started_event)}\n\n"

                # Handle tool call completed
                elif chunk_event == AgnoRunEvent.tool_call_completed:
                    tool = getattr(chunk, 'tool', None)
                    if tool:
                        tc_id = getattr(tool, 'tool_call_id', None)
                        tc_result = getattr(tool, 'result', None) or getattr(tool, 'content', None)
                        tc_error = getattr(tool, 'tool_call_error', False)

                        # Find matching tool call
                        matching_tool = tool_call_map.get(tc_id)
                        if not matching_tool and tool_calls:
                            # Try to find by checking which one has no result yet
                            for tc in tool_calls:
                                if tc["content"] is None:
                                    matching_tool = tc
                                    break

                        if matching_tool:
                            result_str = str(tc_result) if tc_result else ""
                            matching_tool["content"] = result_str[:2000] if len(result_str) > 2000 else result_str
                            matching_tool["tool_call_error"] = tc_error
                            end_time = chunk_time
                            start_time = matching_tool["created_at"]
                            matching_tool["metrics"]["time"] = end_time - start_time

                            # Send ToolCallCompleted event
                            tool_completed_event = {
                                "event": RunEvent.ToolCallCompleted.value,
                                "content": None,
                                "content_type": "text",
                                "session_id": session_id,
                                "run_id": run_id,
                                "agent_id": agent_id,
                                "tool": matching_tool,
                                "created_at": end_time
                            }
                            yield f"data: {json.dumps(tool_completed_event)}\n\n"

                # Handle content streaming
                elif chunk_event == AgnoRunEvent.run_content:
                    content = getattr(chunk, 'content', '')
                    if content:
                        accumulated_content = content  # Agno sends full content each time

                        # Send RunContent event
                        content_event = {
                            "event": RunEvent.RunContent.value,
                            "content": accumulated_content,
                            "content_type": "text",
                            "session_id": session_id,
                            "run_id": run_id,
                            "agent_id": agent_id,
                            "tools": tool_calls if tool_calls else None,
                            "created_at": chunk_time
                        }
                        yield f"data: {json.dumps(content_event)}\n\n"

                # Handle run completed
                elif chunk_event == AgnoRunEvent.run_completed:
                    final_content = getattr(chunk, 'content', accumulated_content) or accumulated_content

                    # Send RunCompleted event
                    completed_event = {
                        "event": RunEvent.RunCompleted.value,
                        "content": final_content,
                        "content_type": "text",
                        "session_id": session_id,
                        "run_id": run_id,
                        "agent_id": agent_id,
                        "tools": tool_calls if tool_calls else None,
                        "created_at": chunk_time
                    }
                    yield f"data: {json.dumps(completed_event)}\n\n"

        except Exception as e:
            import traceback
            traceback.print_exc()

            # Send RunError event
            error_event = {
                "event": RunEvent.RunError.value,
                "content": str(e),
                "content_type": "text",
                "session_id": session_id,
                "run_id": run_id,
                "agent_id": agent_id,
                "created_at": int(time.time())
            }
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(
        generate_sse_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# ----- Chat (Legacy) -----

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a chat message and get a response."""
    global agent

    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    agent.user_id = request.user_id
    if request.session_id:
        agent.session_id = request.session_id

    try:
        response = await agent.arun(request.message)

        # Extract tool calls from the response
        tool_calls = []

        def safe_get_name(obj):
            """Safely get tool name from various object structures."""
            if obj is None:
                return None
            if hasattr(obj, 'function') and obj.function:
                name = getattr(obj.function, 'name', None)
                if name:
                    return name
            name = getattr(obj, 'name', None)
            return name if name else None

        def safe_get_args(obj):
            """Safely get tool arguments from various object structures."""
            if obj is None:
                return {}
            if hasattr(obj, 'function') and obj.function:
                args = getattr(obj.function, 'arguments', None)
                if args:
                    if isinstance(args, str):
                        try:
                            import json
                            return json.loads(args)
                        except:
                            return {"raw": args}
                    return args
            args = getattr(obj, 'arguments', None) or getattr(obj, 'parameters', None)
            if args:
                if isinstance(args, str):
                    try:
                        import json
                        return json.loads(args)
                    except:
                        return {"raw": args}
                return args
            return {}

        # Track tool call IDs to match calls with results
        tool_call_map = {}  # id -> ToolCallInfo

        if response and hasattr(response, 'messages'):
            for msg in response.messages:
                # Check for tool calls in assistant messages
                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                    for tc in msg.tool_calls:
                        name = safe_get_name(tc)
                        tc_id = getattr(tc, 'id', None)
                        if name:
                            tool_info = ToolCallInfo(
                                name=name,
                                parameters=safe_get_args(tc),
                                result=None,
                                status="called"
                            )
                            tool_calls.append(tool_info)
                            if tc_id:
                                tool_call_map[tc_id] = tool_info

                # Check for tool results
                if hasattr(msg, 'role') and msg.role == 'tool':
                    content = getattr(msg, 'content', '') or ''
                    tool_call_id = getattr(msg, 'tool_call_id', None)
                    tool_name = getattr(msg, 'name', None)

                    # Try to extract tool name from content if not provided
                    if not tool_name and content:
                        import re
                        # Look for patterns like "Error from MCP tool 'tool_name':" or similar
                        match = re.search(r"(?:MCP tool|tool) ['\"]?(\w+)['\"]?", str(content))
                        if match:
                            tool_name = match.group(1)

                    # Try to match by tool_call_id first
                    if tool_call_id and tool_call_id in tool_call_map:
                        tool_call_map[tool_call_id].result = content[:2000] if len(str(content)) > 2000 else str(content)
                        tool_call_map[tool_call_id].status = "success"
                    else:
                        # Find unmatched tool call or create new one
                        found = False
                        for tc in tool_calls:
                            if tc.result is None:
                                tc.result = content[:2000] if len(str(content)) > 2000 else str(content)
                                tc.status = "success"
                                if tool_name and tc.name == "unknown":
                                    tc.name = tool_name
                                found = True
                                break
                        if not found:
                            tool_calls.append(ToolCallInfo(
                                name=tool_name or "mcp_tool",
                                parameters={},
                                result=content[:2000] if len(str(content)) > 2000 else str(content),
                                status="success"
                            ))

        # Also check run_response for tool usage
        if response and hasattr(response, 'tools'):
            for tool_use in response.tools or []:
                name = safe_get_name(tool_use)
                if name:
                    existing = next((tc for tc in tool_calls if tc.name == name), None)
                    if not existing:
                        tool_calls.append(ToolCallInfo(
                            name=name,
                            parameters=safe_get_args(tool_use),
                            result=getattr(tool_use, 'result', None),
                            status="success"
                        ))

        return ChatResponse(
            response=response.content if response else "",
            session_id=agent.session_id or "",
            tool_calls=tool_calls,
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ----- Sessions (AgentOS-compatible) -----

@app.get("/sessions")
async def get_sessions(user_id: str = "default", agent_id: Optional[str] = None):
    """List all sessions (AgentOS-compatible endpoint)."""
    database = get_db()
    sessions = database.get_sessions(user_id=user_id)

    result = []
    for s in sessions:
        created_at = s.created_at
        # Convert to unix timestamp if it's a datetime
        if hasattr(created_at, 'timestamp'):
            created_at = int(created_at.timestamp())
        elif isinstance(created_at, str):
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                created_at = int(dt.timestamp())
            except:
                created_at = int(time.time())

        result.append({
            "session_id": s.session_id,
            "session_name": getattr(s, 'session_name', None) or f"Session {s.session_id[:8]}",
            "created_at": created_at,
            "updated_at": created_at,
            "agent_id": agent_id or "mcp-agent",
            "agent_name": "MCP Agent"
        })

    return result


@app.get("/sessions/{session_id}/runs")
async def get_session_runs(session_id: str, user_id: str = "default"):
    """Get chat history for a session (AgentOS-compatible endpoint)."""
    database = get_db()

    # Get session data - this depends on the database implementation
    try:
        # Try to get runs from the session
        runs = database.read_runs(session_id=session_id) if hasattr(database, 'read_runs') else []

        chat_entries = []
        for run in runs:
            # Format as chat entries
            if hasattr(run, 'message') and hasattr(run, 'response'):
                msg_created = int(run.message.created_at.timestamp()) if hasattr(run.message.created_at, 'timestamp') else int(time.time())
                resp_created = int(run.response.created_at.timestamp()) if hasattr(run.response, 'created_at') and hasattr(run.response.created_at, 'timestamp') else msg_created

                chat_entries.append({
                    "message": {
                        "role": "user",
                        "content": str(run.message.content) if hasattr(run.message, 'content') else "",
                        "created_at": msg_created
                    },
                    "response": {
                        "content": str(run.response.content) if hasattr(run.response, 'content') else "",
                        "tools": [],
                        "created_at": resp_created
                    }
                })

        return chat_entries
    except Exception as e:
        print(f"Error getting session runs: {e}")
        return []


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user_id: str = "default"):
    """Delete a session (AgentOS-compatible endpoint)."""
    database = get_db()
    try:
        if hasattr(database, 'delete_session'):
            database.delete_session(session_id=session_id)
        return {"message": "Session deleted", "session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ----- Sessions (Legacy API) -----

@app.get("/api/sessions")
async def list_sessions_legacy(user_id: str = "default"):
    """List all sessions for a user (legacy endpoint)."""
    database = get_db()
    sessions = database.get_sessions(user_id=user_id)
    return {"sessions": [{"session_id": s.session_id, "created_at": str(s.created_at)} for s in sessions]}


# ----- Config Export/Import -----

@app.get("/api/config/export")
async def export_config():
    """Export the full configuration."""
    return JSONResponse(content=config_manager.get_config().model_dump())


@app.post("/api/config/import")
async def import_config(config: dict):
    """Import a configuration."""
    try:
        import json
        config_manager.import_config(json.dumps(config))
        await connect_mcp_servers()
        return {"message": "Configuration imported"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ----- Health (AgentOS-compatible) -----

@app.get("/health")
async def health():
    """Health check endpoint (AgentOS-compatible)."""
    return {
        "status": "healthy",
        "connected_servers": len(mcp_tools_list),
        "agent_ready": agent is not None,
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint (legacy)."""
    return {
        "status": "healthy",
        "connected_servers": len(mcp_tools_list),
        "agent_ready": agent is not None,
    }


# ============== Static Files / Frontend ==============
# The frontend is served separately via Next.js dev server or built static files


# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8888)


# Note: Embedded HTML UI has been removed in favor of the separate Next.js frontend.
# Run the frontend with: cd frontend && npm run dev
