# MCP Client

A generic MCP (Model Context Protocol) client built with the Agno framework. This client allows you to connect to any MCP server from third-party providers or your own servers, with a web UI for configuration and chat.

## Features

- **Multi-Server Support**: Connect to multiple MCP servers simultaneously
- **Multiple Transports**: Support for stdio, SSE, and streamable-http transports
- **Web UI**: Beautiful web interface for chat and server configuration
- **Session Persistence**: SQLite-based conversation history and session management
- **REST API**: Full API for programmatic access and integration
- **CLI Support**: Interactive command-line chat and server management
- **Environment Variable Substitution**: Use `${VAR_NAME}` in config for secrets

## Installation

1. Clone or navigate to the project:
```bash
cd mcp-client-agno
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up your environment variables in `.env`:
```bash
OPENAI_API_KEY=your-openai-api-key
# Add other API keys as needed
GITHUB_TOKEN=your-github-token
```

## Quick Start

### Start the Web Server
```bash
python main.py serve
```
Then open http://localhost:7777 in your browser.

### Start CLI Chat
```bash
python main.py chat
```

## Usage

### Web UI

The web UI at http://localhost:7777 provides:
- **Chat Interface**: Chat with the AI assistant that has access to MCP tools
- **Server Management**: Add, edit, enable/disable MCP servers
- **Model Configuration**: Configure the LLM model (model ID, temperature, etc.)
- **Tools View**: See all available tools from connected MCP servers

### CLI Commands

```bash
# Start web server
python main.py serve --port 7777

# Interactive CLI chat
python main.py chat

# List configured servers
python main.py list-servers

# Add a new server
python main.py add-server --id github --name "GitHub" --transport stdio \
    --command npx --args "-y,@modelcontextprotocol/server-github"

# Remove a server
python main.py remove-server github

# Enable/disable a server
python main.py toggle-server github --enable
python main.py toggle-server github --disable

# Test connections
python main.py test-connection

# Show full config
python main.py show-config
```

### REST API

The server exposes a REST API at http://localhost:7777/api:

#### Server Management
- `GET /api/servers` - List all servers
- `POST /api/servers` - Add a new server
- `GET /api/servers/{id}` - Get server details
- `PUT /api/servers/{id}` - Update a server
- `DELETE /api/servers/{id}` - Delete a server
- `POST /api/servers/{id}/toggle?enabled=true` - Enable/disable server
- `POST /api/servers/reconnect` - Reconnect to all servers

#### Model Configuration
- `GET /api/model` - Get model config
- `PUT /api/model` - Update model config

#### Chat
- `POST /api/chat` - Send a message
  ```json
  {
    "message": "Hello",
    "user_id": "user123",
    "session_id": "optional-session-id"
  }
  ```

#### Tools & Sessions
- `GET /api/tools` - List available tools
- `GET /api/sessions?user_id=user123` - List user sessions

#### Configuration
- `GET /api/config/export` - Export full config
- `POST /api/config/import` - Import config

## Configuration

### MCP Server Configuration

Edit `config/mcp_servers.json` to configure your MCP servers:

```json
{
  "servers": [
    {
      "id": "github",
      "name": "GitHub Server",
      "description": "Access GitHub repositories",
      "enabled": true,
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    {
      "id": "custom-http",
      "name": "Custom HTTP Server",
      "description": "Your custom MCP server",
      "enabled": true,
      "transport": "streamable-http",
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    }
  ],
  "default_model": {
    "provider": "openai",
    "model_id": "gpt-4o-mini",
    "temperature": 0.7
  }
}
```

### Transport Types

1. **stdio**: For command-line MCP servers (most common)
   - Requires `command` and optionally `args`
   - Example: `npx -y @modelcontextprotocol/server-github`

2. **sse**: Server-Sent Events transport
   - Requires `url`
   - Good for remote servers

3. **streamable-http**: Modern HTTP transport (recommended for remote)
   - Requires `url`
   - Supports multiple connections

### Environment Variables

Use `${VAR_NAME}` syntax in configuration to reference environment variables:
```json
{
  "env": {
    "GITHUB_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

## Examples

### Adding Popular MCP Servers

**GitHub:**
```bash
python main.py add-server --id github --name "GitHub" --transport stdio \
    --command npx --args "-y,@modelcontextprotocol/server-github" \
    --description "Access GitHub repositories"
```

**Filesystem:**
```bash
python main.py add-server --id filesystem --name "Filesystem" --transport stdio \
    --command npx --args "-y,@modelcontextprotocol/server-filesystem,/home/user" \
    --description "Access local filesystem"
```

**Brave Search:**
```bash
python main.py add-server --id brave --name "Brave Search" --transport stdio \
    --command npx --args "-y,@modelcontextprotocol/server-brave-search" \
    --description "Web search via Brave"
```

### Using with Custom LLM

Update the model configuration via API or edit the config file:
```json
{
  "default_model": {
    "provider": "openai",
    "model_id": "gpt-4o",
    "base_url": "https://your-custom-endpoint.com/v1",
    "api_key_env": "CUSTOM_API_KEY",
    "temperature": 0.5
  }
}
```

## Project Structure

```
mcp-client-agno/
├── main.py                 # CLI entry point
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables
├── config/
│   └── mcp_servers.json    # MCP server configuration
├── data/
│   └── mcp_client.db       # SQLite database (auto-created)
└── src/
    ├── __init__.py
    ├── app.py              # FastAPI application with UI
    ├── config_manager.py   # Configuration management
    └── mcp_client.py       # Core MCP client
```

## Troubleshooting

### Server won't connect
- Check that the command/URL is correct
- Verify environment variables are set
- Check server logs for errors
- Try `python main.py test-connection`

### Tools not showing up
- Ensure the server is enabled
- Click "Reconnect Servers" in the UI
- Check the server implements MCP correctly

### Session not persisting
- Check the `data/` directory exists and is writable
- SQLite database is created automatically

## License

MIT
