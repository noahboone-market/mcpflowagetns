const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

// Defining the active connections that match the UI state
const connections = [
    { from: 'router', to: 'auth_git' },
    { from: 'router', to: 'codegen_react' },
    { from: 'router', to: 'query_mem' },
    { from: 'router', to: 'sec_lint' },
    { from: 'auth_git', to: 'codegen_react' },
    { from: 'codegen_react', to: 'sec_lint' },
    { from: 'sec_lint', to: 'router' }
];

let globalUptime = 99.9;
let activeClients = 0;

io.on('connection', (socket) => {
    activeClients++;
    console.log(`[MCP Router] Client connected. Total active: ${activeClients}`);

    // Send initial startup data
    socket.emit('agent_activity', {
        fromId: 'router',
        toId: 'router',
        duration: 500,
        metrics: { activeAgents: activeClients + 3, latency: '4', uptime: globalUptime }
    });

    // Emulate an orchestrator executing tools over the MCP layer
    const orchestratorLoop = setInterval(() => {
        // Pick a random connection to simulate flow
        const randomConn = connections[Math.floor(Math.random() * connections.length)];
        const latency = Math.floor(Math.random() * 20) + 5; // 5ms - 25ms

        console.log(`[Flow Data] Routing context from ${randomConn.from} to ${randomConn.to} (Latency: ${latency}ms)`);

        socket.emit('agent_activity', {
            fromId: randomConn.from,
            toId: randomConn.to,
            duration: latency * 50, // Animation duration based on simulated latency
            metrics: {
                activeAgents: activeClients + 3,
                latency: latency,
                uptime: globalUptime
            }
        });
    }, 3500);

    socket.on('disconnect', () => {
        activeClients--;
        console.log(`[MCP Router] Client disconnected. Total active: ${activeClients}`);
        clearInterval(orchestratorLoop);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` 🤖 MCP Flow Backend is LIVE on port ${PORT}`);
    console.log(`===============================================`);
    console.log(`Listening for real-time web-socket events...`);
});
