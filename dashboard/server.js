import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const PORT = 3777;
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.use(express.json());
app.use(express.static(path.join(import.meta.dirname, 'public')));

// ---- Server Records ----
const servers = new Map();
const wsClients = new Set();

// ---- Persistence for manual servers ----
const PERSISTENCE_DIR = path.join(os.homedir(), '.mcp-dashboard');
const PERSISTENCE_FILE = path.join(PERSISTENCE_DIR, 'servers.json');

function loadManualServers() {
  try {
    if (!fs.existsSync(PERSISTENCE_FILE)) return;
    const raw = fs.readFileSync(PERSISTENCE_FILE, 'utf-8').trim();
    if (!raw) return;
    const manualServers = JSON.parse(raw);
    for (const { name, config } of manualServers) {
      const id = `manual_${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const transportType = (config.type === 'http' || config.url) ? 'http' : 'stdio';
      if (servers.has(id)) continue;
      servers.set(id, {
        id, name, source: 'Manual', config, transportType,
        status: 'disconnected', error: null,
        tools: [], resources: [], prompts: [], messageLog: [],
        _client: null, _transport: null,
      });
    }
    console.log(`Loaded ${manualServers.length} manual server(s) from disk`);
  } catch (err) {
    console.error('Failed to load manual servers:', err.message);
  }
}

function saveManualServers() {
  try {
    if (!fs.existsSync(PERSISTENCE_DIR)) fs.mkdirSync(PERSISTENCE_DIR, { recursive: true });
    const manualServers = Array.from(servers.values())
      .filter(s => s.source === 'Manual')
      .map(s => ({ name: s.name, config: s.config }));
    fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(manualServers, null, 2));
  } catch (err) {
    console.error('Failed to save manual servers:', err.message);
  }
}

// ---- Config Discovery ----
const CONFIG_PATHS = [
  { path: path.join(os.homedir(), '.claude', 'settings.json'), source: 'Claude Code' },
  { path: path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'), source: 'Claude Desktop' },
  { path: path.join(os.homedir(), '.cursor', 'mcp.json'), source: 'Cursor (global)' },
];

function discoverConfigs() {
  for (const { path: configPath, source } of CONFIG_PATHS) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const raw = fs.readFileSync(configPath, 'utf-8').trim();
      if (!raw) continue;
      const config = JSON.parse(raw);
      const mcpServers = config.mcpServers || {};

      for (const [name, serverConfig] of Object.entries(mcpServers)) {
        const id = `${source.toLowerCase().replace(/[^a-z0-9]/g, '-')}_${name}`;
        const transportType = (serverConfig.type === 'http' || serverConfig.url) ? 'http' : 'stdio';

        servers.set(id, {
          id,
          name,
          source,
          config: serverConfig,
          transportType,
          status: 'disconnected',
          error: null,
          tools: [],
          resources: [],
          prompts: [],
          messageLog: [],
          _client: null,
          _transport: null,
        });
      }
    } catch (err) {
      console.error(`Failed to read ${configPath}:`, err.message);
    }
  }

  console.log(`Discovered ${servers.size} MCP server(s)`);
  for (const [id, s] of servers) {
    console.log(`  - ${s.name} (${s.transportType}) from ${s.source}`);
  }
}

// ---- Serialize for frontend (strip secrets) ----
function serializeServer(s) {
  const config = { ...s.config };
  if (config.env) {
    config.env = Object.fromEntries(
      Object.keys(config.env).map(k => [k, '***'])
    );
  }
  return {
    id: s.id,
    name: s.name,
    source: s.source,
    config,
    transportType: s.transportType,
    status: s.status,
    error: s.error,
    tools: s.tools,
    resources: s.resources,
    prompts: s.prompts,
  };
}

function serializeAllServers() {
  return Array.from(servers.values()).map(serializeServer);
}

// ---- Broadcast to all WS clients ----
function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload });
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function broadcastServerUpdate(id) {
  const s = servers.get(id);
  if (s) broadcast('serverUpdate', serializeServer(s));
}

// ---- Log a JSON-RPC message ----
function logMessage(serverId, direction, data) {
  const s = servers.get(serverId);
  if (!s) return;

  const entry = {
    direction,
    data: typeof data === 'string' ? JSON.parse(data) : data,
    timestamp: Date.now(),
  };

  s.messageLog.push(entry);
  if (s.messageLog.length > 200) s.messageLog.shift();

  broadcast('message', { serverId, ...entry });
}

// ---- Connect to an MCP Server ----
async function connectServer(id) {
  const s = servers.get(id);
  if (!s) throw new Error(`Server ${id} not found`);
  if (s.status === 'connected' || s.status === 'connecting') return;

  s.status = 'connecting';
  s.error = null;
  broadcastServerUpdate(id);

  try {
    let transport;

    if (s.transportType === 'http') {
      // Dynamic import for HTTP transport
      const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
      transport = new StreamableHTTPClientTransport(new URL(s.config.url));
    } else {
      transport = new StdioClientTransport({
        command: s.config.command,
        args: s.config.args || [],
        env: { ...process.env, ...(s.config.env || {}) },
      });
    }

    const client = new Client({
      name: 'mcp-dashboard',
      version: '1.0.0',
    });

    // Intercept messages for logging
    const originalSend = transport.send?.bind(transport);
    if (originalSend) {
      transport.send = (message) => {
        logMessage(id, 'out', message);
        return originalSend(message);
      };
    }

    const originalOnMessage = transport.onmessage;
    transport.onmessage = (message) => {
      logMessage(id, 'in', message);
      if (originalOnMessage) originalOnMessage(message);
    };

    await client.connect(transport);

    s._client = client;
    s._transport = transport;
    s.status = 'connected';

    // Fetch capabilities
    try {
      const toolsResult = await client.listTools();
      s.tools = toolsResult.tools || [];
    } catch { s.tools = []; }

    try {
      const resourcesResult = await client.listResources();
      s.resources = resourcesResult.resources || [];
    } catch { s.resources = []; }

    try {
      const promptsResult = await client.listPrompts();
      s.prompts = promptsResult.prompts || [];
    } catch { s.prompts = []; }

    broadcastServerUpdate(id);
    console.log(`Connected to ${s.name}: ${s.tools.length} tools, ${s.resources.length} resources, ${s.prompts.length} prompts`);

  } catch (err) {
    s.status = 'error';
    s.error = err.message;
    s._client = null;
    s._transport = null;
    broadcastServerUpdate(id);
    console.error(`Failed to connect to ${s.name}:`, err.message);
  }
}

// ---- Disconnect ----
async function disconnectServer(id) {
  const s = servers.get(id);
  if (!s) return;

  try {
    if (s._client) await s._client.close();
  } catch (err) {
    console.error(`Error closing ${s.name}:`, err.message);
  }

  s._client = null;
  s._transport = null;
  s.status = 'disconnected';
  s.error = null;
  s.tools = [];
  s.resources = [];
  s.prompts = [];
  s.messageLog = [];
  broadcastServerUpdate(id);
  console.log(`Disconnected from ${s.name}`);
}

// ---- Refresh server capabilities ----
async function refreshServer(id) {
  const s = servers.get(id);
  if (!s || !s._client || s.status !== 'connected') return;

  try {
    const toolsResult = await s._client.listTools();
    s.tools = toolsResult.tools || [];
  } catch { s.tools = []; }

  try {
    const resourcesResult = await s._client.listResources();
    s.resources = resourcesResult.resources || [];
  } catch { s.resources = []; }

  try {
    const promptsResult = await s._client.listPrompts();
    s.prompts = promptsResult.prompts || [];
  } catch { s.prompts = []; }

  broadcastServerUpdate(id);
}

// ---- Call a tool ----
async function callTool(serverId, toolName, args) {
  const s = servers.get(serverId);
  if (!s || !s._client || s.status !== 'connected') {
    throw new Error('Server not connected');
  }

  const start = Date.now();
  const result = await s._client.callTool({ name: toolName, arguments: args });
  const duration = Date.now() - start;

  return { result, duration };
}

// ---- Read a resource ----
async function readResource(serverId, uri) {
  const s = servers.get(serverId);
  if (!s || !s._client || s.status !== 'connected') {
    throw new Error('Server not connected');
  }

  const start = Date.now();
  const result = await s._client.readResource({ uri });
  const duration = Date.now() - start;

  return { result, duration };
}

// ---- Get a prompt ----
async function getPrompt(serverId, promptName, args) {
  const s = servers.get(serverId);
  if (!s || !s._client || s.status !== 'connected') {
    throw new Error('Server not connected');
  }

  const start = Date.now();
  const result = await s._client.getPrompt({ name: promptName, arguments: args });
  const duration = Date.now() - start;

  return { result, duration };
}

// ---- Add server manually ----
function addServer(name, config) {
  const id = `manual_${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const transportType = (config.type === 'http' || config.url) ? 'http' : 'stdio';

  if (servers.has(id)) throw new Error(`Server "${name}" already exists`);

  servers.set(id, {
    id,
    name,
    source: 'Manual',
    config,
    transportType,
    status: 'disconnected',
    error: null,
    tools: [],
    resources: [],
    prompts: [],
    messageLog: [],
    _client: null,
    _transport: null,
  });

  broadcast('servers', serializeAllServers());
  saveManualServers();
  return id;
}

// ---- Remove server ----
function removeServer(id) {
  const s = servers.get(id);
  if (!s) return;
  if (s.status === 'connected') disconnectServer(id);
  servers.delete(id);
  broadcast('servers', serializeAllServers());
  saveManualServers();
}

// ---- WebSocket Handling ----
wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: 'servers', payload: serializeAllServers() }));

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch { return; }

    try {
      switch (msg.type) {
        case 'connect':
          await connectServer(msg.payload.serverId);
          break;

        case 'disconnect':
          await disconnectServer(msg.payload.serverId);
          break;

        case 'refresh':
          await refreshServer(msg.payload.serverId);
          break;

        case 'callTool': {
          const { serverId, tool, args } = msg.payload;
          try {
            const { result, duration } = await callTool(serverId, tool, args);
            ws.send(JSON.stringify({
              type: 'toolResult',
              payload: { serverId, tool, result, error: null, duration },
            }));
          } catch (err) {
            ws.send(JSON.stringify({
              type: 'toolResult',
              payload: { serverId, tool, result: null, error: err.message, duration: 0 },
            }));
          }
          break;
        }

        case 'readResource': {
          const { serverId, uri } = msg.payload;
          try {
            const { result, duration } = await readResource(serverId, uri);
            ws.send(JSON.stringify({
              type: 'resourceResult',
              payload: { serverId, uri, result, error: null, duration },
            }));
          } catch (err) {
            ws.send(JSON.stringify({
              type: 'resourceResult',
              payload: { serverId, uri, result: null, error: err.message, duration: 0 },
            }));
          }
          break;
        }

        case 'getPrompt': {
          const { serverId, promptName, args } = msg.payload;
          try {
            const { result, duration } = await getPrompt(serverId, promptName, args);
            ws.send(JSON.stringify({
              type: 'promptResult',
              payload: { serverId, promptName, result, error: null, duration },
            }));
          } catch (err) {
            ws.send(JSON.stringify({
              type: 'promptResult',
              payload: { serverId, promptName, result: null, error: err.message, duration: 0 },
            }));
          }
          break;
        }

        case 'addServer': {
          const { name, config } = msg.payload;
          try {
            addServer(name, config);
          } catch (err) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: err.message } }));
          }
          break;
        }

        case 'removeServer':
          removeServer(msg.payload.serverId);
          break;

        case 'getMessageLog': {
          const s = servers.get(msg.payload.serverId);
          if (s) {
            ws.send(JSON.stringify({
              type: 'messageLog',
              payload: { serverId: s.id, messages: s.messageLog },
            }));
          }
          break;
        }
      }
    } catch (err) {
      console.error('WS handler error:', err.message);
      ws.send(JSON.stringify({ type: 'error', payload: { message: err.message } }));
    }
  });

  ws.on('close', () => wsClients.delete(ws));
});

// ---- REST fallback ----
app.get('/api/servers', (req, res) => {
  res.json(serializeAllServers());
});

// ---- Cleanup on exit ----
async function cleanup() {
  console.log('\nShutting down...');
  for (const [id, s] of servers) {
    if (s.status === 'connected') {
      try { await disconnectServer(id); } catch {}
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ---- Start ----
discoverConfigs();
loadManualServers();
httpServer.listen(PORT, () => {
  console.log(`\n  MCP Server Dashboard running at http://localhost:${PORT}\n`);
});
