"""
MCP Client - Main Entry Point

A generic MCP client that connects to any MCP server using the Agno framework.
Supports multiple MCP servers, session persistence, and a web UI for configuration.
"""

import asyncio
import os
import sys
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

app = typer.Typer(
    name="mcp-client",
    help="A generic MCP client for connecting to any MCP server",
)
console = Console()


@app.command()
def serve(
    host: str = typer.Option("0.0.0.0", "--host", "-h", help="Host to bind to"),
    port: int = typer.Option(7777, "--port", "-p", help="Port to bind to"),
    reload: bool = typer.Option(False, "--reload", "-r", help="Enable auto-reload"),
):
    """Start the MCP Client web server with UI."""
    load_dotenv()

    console.print(Panel.fit(
        f"[bold blue]MCP Client Web Server[/bold blue]\n\n"
        f"Starting server at [green]http://{host}:{port}[/green]\n\n"
        f"Features:\n"
        f"  - Web UI for chat and configuration\n"
        f"  - REST API for MCP server management\n"
        f"  - Session persistence with SQLite\n"
        f"  - Support for stdio, SSE, and HTTP transports",
        title="Starting",
    ))

    import uvicorn
    uvicorn.run(
        "src.app:app",
        host=host,
        port=port,
        reload=reload,
    )


@app.command()
def chat():
    """Start an interactive CLI chat session."""
    load_dotenv()

    console.print(Panel.fit(
        "[bold blue]MCP Client CLI[/bold blue]\n\n"
        "Starting interactive chat session...\n\n"
        "Commands:\n"
        "  - Type your message to chat\n"
        "  - 'tools' to list available tools\n"
        "  - 'reconnect' to reconnect servers\n"
        "  - 'exit' or 'quit' to end session",
        title="CLI Chat",
    ))

    from src.mcp_client import run_cli_chat
    asyncio.run(run_cli_chat())


@app.command()
def list_servers():
    """List all configured MCP servers."""
    from src.config_manager import ConfigManager

    config_manager = ConfigManager()
    config = config_manager.get_config()

    console.print("\n[bold]Configured MCP Servers:[/bold]\n")

    if not config.servers:
        console.print("[dim]No servers configured. Use 'add-server' to add one.[/dim]")
        return

    for server in config.servers:
        status = "[green]Enabled[/green]" if server.enabled else "[dim]Disabled[/dim]"
        console.print(f"  [{server.transport.value}] [bold]{server.name}[/bold] ({server.id})")
        console.print(f"      Status: {status}")
        if server.description:
            console.print(f"      Description: {server.description}")
        if server.command:
            console.print(f"      Command: {server.command} {' '.join(server.args)}")
        if server.url:
            console.print(f"      URL: {server.url}")
        console.print()


@app.command()
def add_server(
    server_id: str = typer.Option(..., "--id", help="Unique server ID"),
    name: str = typer.Option(..., "--name", help="Server display name"),
    transport: str = typer.Option("stdio", "--transport", "-t", help="Transport type (stdio, sse, streamable-http)"),
    command: str = typer.Option(None, "--command", "-c", help="Command to run (for stdio transport)"),
    args: str = typer.Option("", "--args", "-a", help="Command arguments (comma-separated)"),
    url: str = typer.Option(None, "--url", "-u", help="Server URL (for HTTP transports)"),
    description: str = typer.Option("", "--description", "-d", help="Server description"),
    enabled: bool = typer.Option(True, "--enabled/--disabled", help="Enable/disable the server"),
):
    """Add a new MCP server configuration."""
    from src.config_manager import ConfigManager, MCPServerConfig, TransportType

    config_manager = ConfigManager()

    try:
        transport_type = TransportType(transport)
    except ValueError:
        console.print(f"[red]Invalid transport type: {transport}[/red]")
        console.print("Valid options: stdio, sse, streamable-http")
        raise typer.Exit(1)

    server = MCPServerConfig(
        id=server_id,
        name=name,
        description=description,
        enabled=enabled,
        transport=transport_type,
        command=command,
        args=[a.strip() for a in args.split(",") if a.strip()] if args else [],
        url=url,
    )

    try:
        config_manager.add_server(server)
        console.print(f"[green]Server '{name}' added successfully![/green]")
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def remove_server(
    server_id: str = typer.Argument(..., help="Server ID to remove"),
):
    """Remove an MCP server configuration."""
    from src.config_manager import ConfigManager

    config_manager = ConfigManager()

    if config_manager.delete_server(server_id):
        console.print(f"[green]Server '{server_id}' removed successfully![/green]")
    else:
        console.print(f"[red]Server '{server_id}' not found.[/red]")
        raise typer.Exit(1)


@app.command()
def toggle_server(
    server_id: str = typer.Argument(..., help="Server ID to toggle"),
    enable: bool = typer.Option(None, "--enable/--disable", help="Enable or disable the server"),
):
    """Enable or disable an MCP server."""
    from src.config_manager import ConfigManager

    config_manager = ConfigManager()
    server = config_manager.get_server_by_id(server_id)

    if not server:
        console.print(f"[red]Server '{server_id}' not found.[/red]")
        raise typer.Exit(1)

    if enable is None:
        enable = not server.enabled

    config_manager.toggle_server(server_id, enable)
    status = "enabled" if enable else "disabled"
    console.print(f"[green]Server '{server_id}' {status}.[/green]")


@app.command()
def show_config():
    """Show the current configuration."""
    from src.config_manager import ConfigManager

    config_manager = ConfigManager()
    console.print(config_manager.export_config())


@app.command()
def test_connection():
    """Test connection to all enabled MCP servers."""
    load_dotenv()

    async def _test():
        from src.mcp_client import MCPClient

        console.print("\n[bold]Testing MCP Server Connections...[/bold]\n")

        client = MCPClient()
        try:
            await client.connect()

            if client.is_connected:
                tools = client.get_available_tools()
                console.print(f"[green]Successfully connected![/green]")
                console.print(f"  Available tools: {len(tools)}")
                for tool in tools[:10]:  # Show first 10 tools
                    console.print(f"    - {tool['name']}")
                if len(tools) > 10:
                    console.print(f"    ... and {len(tools) - 10} more")
            else:
                console.print("[yellow]Connected but no MCP tools available.[/yellow]")

        except Exception as e:
            console.print(f"[red]Connection failed: {e}[/red]")
        finally:
            await client.disconnect()

    asyncio.run(_test())


def main():
    """Entry point for the CLI."""
    app()


if __name__ == "__main__":
    main()
