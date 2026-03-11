# MCP Flow Agents

A real-time mission control dashboard for monitoring and interacting with your MCP (Model Context Protocol) servers. Features animated agent characters, live data flow visualization, tool testing, resource reading, and prompt execution.

## Overview

MCP Flow Agents consists of two parts:

1. **Landing Page** — A marketing/overview page with an interactive network visualization, features section, and code preview. Light theme with parallax effects and live data flow from the backend.
2. **Command Center Dashboard** — A single-screen mission control view where each MCP server appears as a workstation with an animated CSS agent character. Connection lines with real-time glow effects show data flowing between servers and the central router.

The dashboard automatically discovers your configured MCP servers from Claude Code, Claude Desktop, and Cursor. Manually added servers are persisted to `~/.mcp-dashboard/servers.json`.

## Features

- **Auto-Discovery** — Reads MCP server configs from `~/.claude/settings.json`, Claude Desktop config, and Cursor global config
- **Real-Time Monitoring** — WebSocket-powered live updates for server status, traffic, and JSON-RPC messages
- **Animated Agent Characters** — CSS-only characters that type when connected, sleep when disconnected, and shake on error
- **Tool Testing** — Execute any tool directly from the dashboard with auto-generated forms from `inputSchema`
- **Resource Reading** — Browse and read resources exposed by connected MCP servers
- **Prompt Execution** — Run prompts with argument forms, view formatted results
- **Searchable Tools** — Filter tools by name or description in the overlay
- **Live Activity Feed** — Horizontally scrolling ticker showing real-time JSON-RPC traffic (color-coded IN/OUT)
- **SVG Connection Lines** — Bezier curves with animated glow dots triggered by actual WebSocket messages
- **Manual Server Persistence** — Manually added servers are saved to disk and restored on restart
- **Security** — Environment variables (API keys) are masked before sending to the browser

## Project Structure

```
MCPflowagents/
├── index.html              # Landing page (light theme)
├── style.css               # Landing page styles
├── script.js               # Landing page JS (network visualization + parallax)
├── README.md               # This file
└── dashboard/
    ├── package.json         # Node.js dependencies
    ├── server.js            # Express + WebSocket backend
    └── public/
        ├── index.html       # Command Center layout
        ├── style.css        # Command Center styles (agents, connections, overlay)
        └── app.js           # Command Center frontend logic
```

## Quick Start

```bash
cd dashboard
npm install
npm start
```

Open [http://localhost:3777](http://localhost:3777) in your browser.

The landing page at the project root links directly to the dashboard via the "Launch Dashboard" button.

## Architecture

### Backend (`server.js`)

- **Express** serves static files and a REST fallback endpoint (`GET /api/servers`)
- **WebSocket** server handles real-time bidirectional communication
- **MCP SDK** (`@modelcontextprotocol/sdk`) connects to servers via stdio or HTTP transports
- **Config Discovery** reads from 3 config file locations on startup
- **Persistence** saves/loads manually added servers from `~/.mcp-dashboard/servers.json`

#### WebSocket Protocol

| Client → Server | Description |
|-----------------|-------------|
| `connect` | Connect to an MCP server |
| `disconnect` | Disconnect from a server |
| `refresh` | Re-fetch tools/resources/prompts |
| `callTool` | Execute a tool with arguments |
| `readResource` | Read a resource by URI |
| `getPrompt` | Get a prompt with arguments |
| `addServer` | Register a new server manually |
| `removeServer` | Remove a server |
| `getMessageLog` | Fetch message history |

| Server → Client | Description |
|-----------------|-------------|
| `servers` | Full server list (on connect, add, remove) |
| `serverUpdate` | Single server state change |
| `message` | JSON-RPC traffic log entry |
| `toolResult` | Tool execution result |
| `resourceResult` | Resource read result |
| `promptResult` | Prompt execution result |
| `error` | Error message |

### Frontend — Command Center (`dashboard/public/`)

- **Vanilla HTML/CSS/JS** — no frameworks, no build step
- **Radial Layout** — stations positioned in a circle using `angle = (i / N) * 2π`
- **CSS Agent Characters** — geometric shapes with status-dependent keyframe animations
- **SVG Connections** — bezier curves with `stroke-dasharray` + `stroke-dashoffset` glow animation
- **Overlay Tabs** — Tools (searchable grid), Resources (clickable list), Prompts (clickable list)
- **Tester Panel** — Dynamic forms for tool execution, resource reading, and prompt running

### Frontend — Landing Page (root)

- **Light theme** with subtle grid background and animated orbs
- **Interactive network visualization** with 5 agent nodes and bezier SVG connections
- **Parallax mouse tracking** on the AI background layer
- **Live backend integration** via Socket.IO for real-time flow animation
- **Responsive** with breakpoints at 600px and 900px

## Design System

### Command Center (Dark Theme)

| Token | Value |
|-------|-------|
| Background | `#060a13` |
| Surface | `#0a0f1a` |
| Card | `rgba(12, 18, 30, 0.75)` |
| Text | `#f0f4f8` |
| Muted Text | `#7a8ba8` |
| Accent Purple | `#a78bfa` |
| Accent Blue | `#3b82f6` |
| Accent Green | `#10b981` |

### Landing Page (Light Theme)

| Token | Value |
|-------|-------|
| Background | `#ffffff` |
| Card | `#f8fafc` |
| Text | `#0f172a` |
| Muted Text | `#475569` |
| Accent Purple | `#8b5cf6` |
| Accent Blue | `#0284c7` |
| Accent Green | `#059669` |

### Shared

| Token | Value |
|-------|-------|
| Heading Font | Outfit |
| Code Font | JetBrains Mono |
| Border Radius (sm) | 8px |
| Border Radius (md) | 12px |
| Border Radius (lg) | 20px |

## Config Locations

The dashboard searches these paths for MCP server configurations:

| Path | Source |
|------|--------|
| `~/.claude/settings.json` | Claude Code |
| `~/Library/Application Support/Claude/claude_desktop_config.json` | Claude Desktop |
| `~/.cursor/mcp.json` | Cursor (global) |

Servers are expected under the `mcpServers` key with either stdio config (`command`, `args`, `env`) or HTTP config (`url`).

## Adding Servers

### Via Config Files
Add entries to any of the config files above and restart the dashboard.

### Via UI
Click "Add Server" in the top bar. Supports:
- **stdio** — provide a command and arguments (e.g., `npx -y @modelcontextprotocol/server-filesystem /tmp`)
- **HTTP** — provide a URL endpoint

Manually added servers persist across restarts.

### Via WebSocket
```json
{
  "type": "addServer",
  "payload": {
    "name": "my-server",
    "config": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
}
```

## Interacting with Servers

### Tools
1. Connect to a server by clicking the connect button on its station card
2. Click the station to open the overlay
3. Browse or search tools in the Tools tab
4. Click a tool to open the tester with auto-generated input fields
5. Click Execute and view the JSON result

### Resources
1. Open the overlay and switch to the Resources tab
2. Click any resource row to open the reader
3. Click Read to fetch the resource content

### Prompts
1. Open the overlay and switch to the Prompts tab
2. Click any prompt to open the runner with argument fields
3. Click Get Prompt to execute and view the result

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.21.0 | HTTP server + static files |
| `ws` | ^8.18.0 | WebSocket server |
| `@modelcontextprotocol/sdk` | ^1.12.0 | MCP client (stdio + HTTP transports) |

## Accessibility

- `prefers-reduced-motion` respected across all animations
- Visible focus states on interactive elements
- ARIA labels on icon-only buttons
- Semantic HTML structure
- Keyboard-navigable tool cards and overlays

## License

MIT
