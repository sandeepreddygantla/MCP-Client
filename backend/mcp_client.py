"""
Core MCP Client

Handles connecting to multiple MCP servers and managing the Agno agent
with support for different transport types (stdio, SSE, streamable-http).
"""

import asyncio
import os
from typing import Any, Dict, List, Optional, Union
from contextlib import asynccontextmanager

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.mcp import MCPTools, MultiMCPTools
from agno.db.sqlite import SqliteDb

from mcp import StdioServerParameters

from config_manager import (
    ConfigManager,
    MCPServerConfig,
    TransportType,
    ModelConfig,
)


class MCPClientError(Exception):
    """Base exception for MCP client errors."""
    pass


class MCPClient:
    """
    A generic MCP client that connects to multiple MCP servers
    using the Agno framework.
    """

    def __init__(
        self,
        config_manager: Optional[ConfigManager] = None,
        db_path: str = "data/mcp_client.db",
    ):
        """
        Initialize the MCP client.

        Args:
            config_manager: Configuration manager instance
            db_path: Path to SQLite database for session persistence
        """
        self.config_manager = config_manager or ConfigManager()
        self.db_path = db_path
        self._mcp_tools: List[MCPTools] = []
        self._multi_mcp_tools: Optional[MultiMCPTools] = None
        self._agent: Optional[Agent] = None
        self._db: Optional[SqliteDb] = None
        self._connected = False

    def _get_db(self) -> SqliteDb:
        """Get or create the SQLite database instance."""
        if self._db is None:
            # Ensure data directory exists
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            self._db = SqliteDb(db_file=self.db_path)
        return self._db

    def _create_model(self, model_config: ModelConfig) -> OpenAIChat:
        """Create an LLM model instance from configuration."""
        # Get API key from environment
        api_key = None
        if model_config.api_key_env:
            api_key = os.environ.get(model_config.api_key_env)
        else:
            # Default to OPENAI_API_KEY
            api_key = os.environ.get("OPENAI_API_KEY")

        kwargs = {
            "id": model_config.model_id,
            "temperature": model_config.temperature,
        }

        if api_key:
            kwargs["api_key"] = api_key

        if model_config.base_url:
            kwargs["base_url"] = model_config.base_url

        if model_config.max_tokens:
            kwargs["max_completion_tokens"] = model_config.max_tokens

        return OpenAIChat(**kwargs)

    def _create_stdio_params(self, server: MCPServerConfig) -> StdioServerParameters:
        """Create stdio server parameters from configuration."""
        env = {**os.environ}  # Start with current environment
        env.update(server.env)  # Add server-specific env vars

        return StdioServerParameters(
            command=server.command,
            args=server.args,
            env=env,
        )

    async def _create_mcp_tools(self, server: MCPServerConfig) -> MCPTools:
        """Create MCPTools instance for a server configuration."""
        if server.transport == TransportType.STDIO:
            if not server.command:
                raise MCPClientError(f"Server '{server.id}' requires a command for stdio transport")

            server_params = self._create_stdio_params(server)
            return MCPTools(server_params=server_params)

        elif server.transport == TransportType.SSE:
            if not server.url:
                raise MCPClientError(f"Server '{server.id}' requires a URL for SSE transport")

            return MCPTools(
                transport="sse",
                url=server.url,
                headers=server.headers or {},
            )

        elif server.transport == TransportType.STREAMABLE_HTTP:
            if not server.url:
                raise MCPClientError(f"Server '{server.id}' requires a URL for streamable-http transport")

            return MCPTools(
                transport="streamable-http",
                url=server.url,
                headers=server.headers or {},
            )

        else:
            raise MCPClientError(f"Unsupported transport type: {server.transport}")

    async def connect(self) -> None:
        """Connect to all enabled MCP servers."""
        if self._connected:
            return

        config = self.config_manager.get_config()
        enabled_servers = self.config_manager.get_enabled_servers()

        if not enabled_servers:
            # No servers configured, create agent without MCP tools
            model = self._create_model(config.default_model)
            self._agent = Agent(
                model=model,
                db=self._get_db(),
                add_history_to_context=True,
                num_history_runs=10,
                markdown=True,
            )
            self._connected = True
            return

        # Create and connect MCP tools for each server
        self._mcp_tools = []
        for server in enabled_servers:
            try:
                mcp_tool = await self._create_mcp_tools(server)
                await mcp_tool.connect()
                self._mcp_tools.append(mcp_tool)
                print(f"Connected to MCP server: {server.name}")
            except Exception as e:
                print(f"Failed to connect to MCP server '{server.name}': {e}")

        # Create the agent with all MCP tools
        model = self._create_model(config.default_model)
        self._agent = Agent(
            model=model,
            tools=self._mcp_tools,
            db=self._get_db(),
            add_history_to_context=True,
            num_history_runs=10,
            markdown=True,
            instructions=(
                "You are a helpful AI assistant with access to various tools through MCP servers. "
                "Use the available tools to help users accomplish their tasks. "
                "Always be clear about what actions you're taking."
            ),
        )

        self._connected = True

    async def disconnect(self) -> None:
        """Disconnect from all MCP servers."""
        for mcp_tool in self._mcp_tools:
            try:
                await mcp_tool.close()
            except Exception as e:
                print(f"Error closing MCP connection: {e}")

        self._mcp_tools = []
        self._agent = None
        self._connected = False

    async def reconnect(self) -> None:
        """Reconnect to MCP servers (useful after config changes)."""
        await self.disconnect()
        await self.connect()

    @asynccontextmanager
    async def session(self):
        """Context manager for MCP client session."""
        await self.connect()
        try:
            yield self
        finally:
            await self.disconnect()

    async def chat(
        self,
        message: str,
        user_id: str = "default",
        session_id: Optional[str] = None,
        stream: bool = True,
    ) -> str:
        """
        Send a message and get a response.

        Args:
            message: The user's message
            user_id: User identifier for session management
            session_id: Optional session ID to continue a conversation
            stream: Whether to stream the response

        Returns:
            The assistant's response
        """
        if not self._connected or not self._agent:
            await self.connect()

        # Update agent with session info
        self._agent.user_id = user_id
        if session_id:
            self._agent.session_id = session_id

        if stream:
            response = await self._agent.arun(message, stream=True)
        else:
            response = await self._agent.arun(message)

        return response.content if response else ""

    async def chat_stream(
        self,
        message: str,
        user_id: str = "default",
        session_id: Optional[str] = None,
    ):
        """
        Send a message and stream the response.

        Args:
            message: The user's message
            user_id: User identifier for session management
            session_id: Optional session ID to continue a conversation

        Yields:
            Response chunks as they arrive
        """
        if not self._connected or not self._agent:
            await self.connect()

        self._agent.user_id = user_id
        if session_id:
            self._agent.session_id = session_id

        async for chunk in self._agent.arun(message, stream=True, stream_intermediate_steps=True):
            if hasattr(chunk, 'content') and chunk.content:
                yield chunk.content

    def get_current_session_id(self) -> Optional[str]:
        """Get the current session ID."""
        if self._agent:
            return self._agent.session_id
        return None

    def get_available_tools(self) -> List[Dict[str, Any]]:
        """Get list of available tools from connected MCP servers."""
        tools = []
        for mcp_tool in self._mcp_tools:
            if hasattr(mcp_tool, 'tools') and mcp_tool.tools:
                for tool in mcp_tool.tools:
                    tools.append({
                        "name": tool.name if hasattr(tool, 'name') else str(tool),
                        "description": tool.description if hasattr(tool, 'description') else "",
                    })
        return tools

    @property
    def is_connected(self) -> bool:
        """Check if the client is connected."""
        return self._connected

    @property
    def agent(self) -> Optional[Agent]:
        """Get the underlying Agno agent."""
        return self._agent


async def run_cli_chat():
    """Run an interactive CLI chat session."""
    from rich.console import Console
    from rich.prompt import Prompt
    from rich.panel import Panel
    from rich.markdown import Markdown
    from dotenv import load_dotenv

    # Load environment variables
    load_dotenv()

    console = Console()
    console.print(Panel.fit(
        "[bold blue]MCP Client[/bold blue]\n"
        "A generic MCP client powered by Agno\n\n"
        "Type 'exit' or 'quit' to end the session\n"
        "Type 'tools' to list available tools\n"
        "Type 'reconnect' to reconnect to servers",
        title="Welcome",
    ))

    client = MCPClient()

    try:
        console.print("\n[yellow]Connecting to MCP servers...[/yellow]")
        await client.connect()
        console.print("[green]Connected![/green]\n")

        # Show available tools
        tools = client.get_available_tools()
        if tools:
            console.print(f"[dim]Available tools: {len(tools)}[/dim]\n")

        session_id = client.get_current_session_id()
        console.print(f"[dim]Session ID: {session_id}[/dim]\n")

        while True:
            try:
                message = Prompt.ask("[bold cyan]You[/bold cyan]")

                if message.lower() in ['exit', 'quit', 'bye']:
                    console.print("[yellow]Goodbye![/yellow]")
                    break

                if message.lower() == 'tools':
                    tools = client.get_available_tools()
                    if tools:
                        for tool in tools:
                            console.print(f"  - [green]{tool['name']}[/green]: {tool['description']}")
                    else:
                        console.print("[dim]No tools available[/dim]")
                    continue

                if message.lower() == 'reconnect':
                    console.print("[yellow]Reconnecting...[/yellow]")
                    await client.reconnect()
                    console.print("[green]Reconnected![/green]")
                    continue

                # Get response
                console.print("\n[bold green]Assistant[/bold green]:")
                response = await client.chat(message)
                console.print(Markdown(response))
                console.print()

            except KeyboardInterrupt:
                console.print("\n[yellow]Interrupted. Type 'exit' to quit.[/yellow]")
            except Exception as e:
                console.print(f"[red]Error: {e}[/red]")

    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(run_cli_chat())
