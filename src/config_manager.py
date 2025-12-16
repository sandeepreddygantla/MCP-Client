"""
MCP Server Configuration Manager

Handles loading, saving, and managing MCP server configurations.
Supports environment variable substitution in config values.
"""

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from enum import Enum


class TransportType(str, Enum):
    STDIO = "stdio"
    SSE = "sse"
    STREAMABLE_HTTP = "streamable-http"


class MCPServerConfig(BaseModel):
    """Configuration for a single MCP server."""
    id: str = Field(..., description="Unique identifier for the server")
    name: str = Field(..., description="Display name for the server")
    description: str = Field(default="", description="Description of the server")
    enabled: bool = Field(default=True, description="Whether the server is enabled")
    transport: TransportType = Field(..., description="Transport type (stdio, sse, streamable-http)")

    # For stdio transport
    command: Optional[str] = Field(default=None, description="Command to run the server")
    args: List[str] = Field(default_factory=list, description="Arguments for the command")

    # For HTTP-based transports (SSE, streamable-http)
    url: Optional[str] = Field(default=None, description="URL of the MCP server")
    headers: Dict[str, str] = Field(default_factory=dict, description="HTTP headers")

    # Environment variables
    env: Dict[str, str] = Field(default_factory=dict, description="Environment variables")

    # Connection settings
    timeout: Optional[int] = Field(default=30, description="Connection timeout in seconds")
    sse_read_timeout: Optional[int] = Field(default=300, description="SSE read timeout in seconds")


class ModelConfig(BaseModel):
    """Configuration for the LLM model."""
    provider: str = Field(default="openai", description="Model provider (openai, anthropic, etc.)")
    model_id: str = Field(default="gpt-4o-mini", description="Model ID")
    api_key_env: Optional[str] = Field(default=None, description="Environment variable for API key")
    base_url: Optional[str] = Field(default=None, description="Custom base URL for the model API")
    temperature: float = Field(default=0.7, description="Model temperature")
    max_tokens: Optional[int] = Field(default=None, description="Max tokens for response")


class AppConfig(BaseModel):
    """Full application configuration."""
    servers: List[MCPServerConfig] = Field(default_factory=list)
    default_model: ModelConfig = Field(default_factory=ModelConfig)


class ConfigManager:
    """Manages MCP server and model configurations."""

    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the configuration manager.

        Args:
            config_path: Path to the configuration file. Defaults to config/mcp_servers.json
        """
        if config_path is None:
            # Default to config/mcp_servers.json relative to project root
            project_root = Path(__file__).parent.parent
            config_path = project_root / "config" / "mcp_servers.json"

        self.config_path = Path(config_path)
        self._config: Optional[AppConfig] = None

    def _substitute_env_vars(self, value: str) -> str:
        """Substitute environment variables in a string value."""
        # Match ${VAR_NAME} pattern
        pattern = r'\$\{([^}]+)\}'

        def replace(match):
            var_name = match.group(1)
            return os.environ.get(var_name, "")

        return re.sub(pattern, replace, value)

    def _process_env_vars(self, data: Any) -> Any:
        """Recursively process environment variables in config data."""
        if isinstance(data, str):
            return self._substitute_env_vars(data)
        elif isinstance(data, dict):
            return {k: self._process_env_vars(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._process_env_vars(item) for item in data]
        return data

    def load_config(self) -> AppConfig:
        """Load configuration from file."""
        if not self.config_path.exists():
            # Create default config if it doesn't exist
            self._config = AppConfig()
            self.save_config()
            return self._config

        with open(self.config_path, 'r') as f:
            raw_data = json.load(f)

        # Process environment variables
        processed_data = self._process_env_vars(raw_data)

        self._config = AppConfig(**processed_data)
        return self._config

    def save_config(self) -> None:
        """Save configuration to file."""
        if self._config is None:
            return

        # Ensure directory exists
        self.config_path.parent.mkdir(parents=True, exist_ok=True)

        with open(self.config_path, 'w') as f:
            json.dump(self._config.model_dump(), f, indent=2)

    def get_config(self) -> AppConfig:
        """Get the current configuration, loading if necessary."""
        if self._config is None:
            self.load_config()
        return self._config

    def get_enabled_servers(self) -> List[MCPServerConfig]:
        """Get all enabled MCP server configurations."""
        config = self.get_config()
        return [s for s in config.servers if s.enabled]

    def get_server_by_id(self, server_id: str) -> Optional[MCPServerConfig]:
        """Get a server configuration by ID."""
        config = self.get_config()
        for server in config.servers:
            if server.id == server_id:
                return server
        return None

    def add_server(self, server: MCPServerConfig) -> None:
        """Add a new server configuration."""
        config = self.get_config()

        # Check if server with same ID already exists
        existing = self.get_server_by_id(server.id)
        if existing:
            raise ValueError(f"Server with ID '{server.id}' already exists")

        config.servers.append(server)
        self.save_config()

    def update_server(self, server_id: str, updates: Dict[str, Any]) -> MCPServerConfig:
        """Update an existing server configuration."""
        config = self.get_config()

        for i, server in enumerate(config.servers):
            if server.id == server_id:
                # Create updated server config
                server_dict = server.model_dump()
                server_dict.update(updates)
                updated_server = MCPServerConfig(**server_dict)
                config.servers[i] = updated_server
                self.save_config()
                return updated_server

        raise ValueError(f"Server with ID '{server_id}' not found")

    def delete_server(self, server_id: str) -> bool:
        """Delete a server configuration."""
        config = self.get_config()

        for i, server in enumerate(config.servers):
            if server.id == server_id:
                config.servers.pop(i)
                self.save_config()
                return True

        return False

    def toggle_server(self, server_id: str, enabled: bool) -> MCPServerConfig:
        """Enable or disable a server."""
        return self.update_server(server_id, {"enabled": enabled})

    def update_model_config(self, updates: Dict[str, Any]) -> ModelConfig:
        """Update the default model configuration."""
        config = self.get_config()
        model_dict = config.default_model.model_dump()
        model_dict.update(updates)
        config.default_model = ModelConfig(**model_dict)
        self.save_config()
        return config.default_model

    def export_config(self) -> str:
        """Export configuration as JSON string."""
        config = self.get_config()
        return json.dumps(config.model_dump(), indent=2)

    def import_config(self, json_str: str) -> None:
        """Import configuration from JSON string."""
        data = json.loads(json_str)
        self._config = AppConfig(**data)
        self.save_config()
