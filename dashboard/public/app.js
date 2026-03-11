// ============================================
// MCP Command Center — Frontend
// ============================================

// ---- State ----
let ws = null;
let servers = [];
let messageLogs = {};
let selectedServerId = null;
let selectedTab = 'tools';
let selectedTool = null;
let executing = false;
let selectedPrompt = null;
let selectedResource = null;
let startTime = Date.now();
let messageCount = 0;
let messagesPerSecond = 0;

const STATION_COLORS = [
    { css: '#3b82f6', rgb: '59,130,246' },
    { css: '#a78bfa', rgb: '167,139,250' },
    { css: '#10b981', rgb: '16,185,129' },
    { css: '#f59e0b', rgb: '245,158,11' },
    { css: '#ec4899', rgb: '236,72,153' },
    { css: '#06b6d4', rgb: '6,182,212' },
    { css: '#ef4444', rgb: '239,68,68' },
    { css: '#84cc16', rgb: '132,204,22' },
];

// ---- DOM helpers ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    bindEvents();
    startUptimeCounter();
    startMsgRateCounter();
    startTickerScroll();
});

// ---- WebSocket ----
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => updateWsStatus('connected');

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
            case 'servers':
                servers = msg.payload;
                renderStations();
                updateStats();
                break;
            case 'serverUpdate':
                handleServerUpdate(msg.payload);
                break;
            case 'message':
                handleMessage(msg.payload);
                break;
            case 'toolResult':
                handleToolResult(msg.payload);
                break;
            case 'resourceResult':
                handleResourceResult(msg.payload);
                break;
            case 'promptResult':
                handlePromptResult(msg.payload);
                break;
            case 'messageLog':
                messageLogs[msg.payload.serverId] = msg.payload.messages;
                break;
            case 'error':
                console.error('Server error:', msg.payload.message);
                break;
        }
    };

    ws.onclose = () => {
        updateWsStatus('disconnected');
        setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = () => updateWsStatus('disconnected');
}

function send(type, payload) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type, payload }));
}

function updateWsStatus(status) {
    const dot = $('.ws-dot');
    const label = $('.ws-label');
    dot.className = 'ws-dot ' + status;
    label.textContent = status === 'connected' ? 'Connected' : 'Reconnecting...';
}

// ---- Handlers ----
function handleServerUpdate(server) {
    const idx = servers.findIndex(s => s.id === server.id);
    if (idx >= 0) servers[idx] = server;
    else servers.push(server);

    renderStations();
    updateStats();

    // Update overlay if open for this server
    if (selectedServerId === server.id) renderOverlayContent();
}

function handleMessage(entry) {
    const { serverId } = entry;
    if (!messageLogs[serverId]) messageLogs[serverId] = [];
    messageLogs[serverId].push(entry);
    if (messageLogs[serverId].length > 200) messageLogs[serverId].shift();

    messageCount++;

    // Trigger connection glow
    triggerGlow(serverId);

    // Flash station card
    flashStation(serverId);

    // Add to feed
    addFeedItem(entry, serverId);
}

function handleToolResult(payload) {
    executing = false;
    const execBtn = $('#btn-execute');
    if (execBtn) {
        execBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Execute`;
        execBtn.disabled = false;
    }

    const resultDiv = $('#ov-tool-result');
    const resultBody = $('#ov-result-body');
    const duration = $('#exec-duration');

    if (resultDiv) resultDiv.classList.remove('hidden');
    if (duration) duration.textContent = `${payload.duration}ms`;

    if (payload.error) {
        if (resultBody) { resultBody.className = 'result-body error'; resultBody.textContent = payload.error; }
    } else {
        if (resultBody) { resultBody.className = 'result-body'; resultBody.innerHTML = syntaxHighlight(payload.result); }
    }
}

function handleResourceResult(payload) {
    executing = false;
    const resultDiv = $('#ov-tool-result');
    const resultBody = $('#ov-result-body');
    const duration = $('#exec-duration');
    const execBtn = $('#btn-execute');

    if (execBtn) {
        execBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Read`;
        execBtn.disabled = false;
    }

    if (resultDiv) resultDiv.classList.remove('hidden');
    if (duration) duration.textContent = `${payload.duration}ms`;

    if (payload.error) {
        if (resultBody) { resultBody.className = 'result-body error'; resultBody.textContent = payload.error; }
    } else {
        if (resultBody) { resultBody.className = 'result-body'; resultBody.innerHTML = syntaxHighlight(payload.result); }
    }
}

function handlePromptResult(payload) {
    executing = false;
    const resultDiv = $('#ov-tool-result');
    const resultBody = $('#ov-result-body');
    const duration = $('#exec-duration');
    const execBtn = $('#btn-execute');

    if (execBtn) {
        execBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Get Prompt`;
        execBtn.disabled = false;
    }

    if (resultDiv) resultDiv.classList.remove('hidden');
    if (duration) duration.textContent = `${payload.duration}ms`;

    if (payload.error) {
        if (resultBody) { resultBody.className = 'result-body error'; resultBody.textContent = payload.error; }
    } else {
        if (resultBody) { resultBody.className = 'result-body'; resultBody.innerHTML = syntaxHighlight(payload.result); }
    }
}

// ---- Bind Events ----
function bindEvents() {
    // Add server modal
    $('#btn-add-server').addEventListener('click', () => $('#add-server-modal').classList.remove('hidden'));
    $('#btn-close-modal').addEventListener('click', closeModal);
    $('#btn-cancel-modal').addEventListener('click', closeModal);
    $('#add-server-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });

    $('#transport-type').addEventListener('change', (e) => {
        const isHttp = e.target.value === 'http';
        $('#stdio-fields').classList.toggle('hidden', isHttp);
        $('#http-fields').classList.toggle('hidden', !isHttp);
    });

    $('#add-server-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('#server-name').value.trim();
        const type = $('#transport-type').value;
        let config;
        if (type === 'http') {
            config = { type: 'http', url: $('#server-url').value.trim() };
        } else {
            const command = $('#server-command').value.trim();
            const argsStr = $('#server-args').value.trim();
            const args = argsStr ? argsStr.split(',').map(a => a.trim()).filter(Boolean) : [];
            config = { command, args };
        }
        send('addServer', { name, config });
        closeModal();
        e.target.reset();
    });

    // Overlay
    $('#btn-close-overlay').addEventListener('click', closeOverlay);
    $('.overlay-backdrop').addEventListener('click', closeOverlay);

    // Overlay tabs
    $$('.ov-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            selectedTab = tab.dataset.tab;
            $$('.ov-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderOverlayTabContent();
        });
    });

    // Tester
    $('#btn-close-tester').addEventListener('click', () => {
        $('#overlay-tester').classList.add('hidden');
        selectedTool = null;
    });

    $('#btn-execute').addEventListener('click', executeTool);

    // Resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => renderStations(), 150);
    });
}

function closeModal() {
    $('#add-server-modal').classList.add('hidden');
    $('#add-server-form').reset();
    $('#stdio-fields').classList.remove('hidden');
    $('#http-fields').classList.add('hidden');
}

// ---- Render Stations ----
function renderStations() {
    const container = $('#stations-container');
    const floor = $('#command-floor');
    if (!floor) return;

    container.innerHTML = '';

    const floorW = floor.offsetWidth;
    const floorH = floor.offsetHeight;
    const centerX = floorW / 2;
    const centerY = floorH / 2;
    const radius = Math.min(floorW, floorH) * 0.33;

    // Special layouts for small counts
    const positions = getStationPositions(servers.length, centerX, centerY, radius);

    servers.forEach((server, i) => {
        const pos = positions[i];
        const color = STATION_COLORS[i % STATION_COLORS.length];

        const station = document.createElement('div');
        station.className = 'station';
        station.dataset.serverId = server.id;
        station.dataset.status = server.status;
        station.style.left = pos.x + 'px';
        station.style.top = pos.y + 'px';
        station.style.setProperty('--station-color', color.css);

        const toolCount = server.tools.length;
        const resCount = server.resources.length;
        const isConnected = server.status === 'connected';

        station.innerHTML = `
            <div class="station-card" tabindex="0" role="button" aria-label="${escapeHtml(server.name)} server">
                <div class="station-status-light ${server.status}"></div>
                <div class="agent-scene">
                    <div class="agent-body">
                        <div class="agent-head"></div>
                        <div class="agent-torso"></div>
                        <div class="agent-arm agent-arm-l"></div>
                        <div class="agent-arm agent-arm-r"></div>
                    </div>
                    <div class="agent-desk"></div>
                    <div class="agent-monitor">
                        <div class="monitor-screen"></div>
                    </div>
                    <div class="monitor-stand"></div>
                </div>
                <div class="station-info">
                    <div class="station-name">${escapeHtml(server.name)}</div>
                    <div class="station-meta">
                        <span>${toolCount} tool${toolCount !== 1 ? 's' : ''}</span>
                        <span>${resCount} res</span>
                        <span>${server.transportType}</span>
                    </div>
                </div>
                <div class="station-actions">
                    ${isConnected
                        ? '<button class="btn-station btn-disconnect" type="button">Disconnect</button>'
                        : server.status === 'connecting'
                            ? '<button class="btn-station" type="button" disabled>Connecting...</button>'
                            : '<button class="btn-station btn-connect" type="button">Connect</button>'
                    }
                </div>
            </div>
        `;

        // Events
        const card = station.querySelector('.station-card');
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-station')) return;
            openOverlay(server.id);
        });

        const connectBtn = station.querySelector('.btn-connect');
        const disconnectBtn = station.querySelector('.btn-disconnect');
        if (connectBtn) connectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            send('connect', { serverId: server.id });
        });
        if (disconnectBtn) disconnectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            send('disconnect', { serverId: server.id });
        });

        container.appendChild(station);
    });

    drawConnections();
    updateCentralCore();
}

function getStationPositions(count, cx, cy, radius) {
    if (count === 0) return [];
    if (count === 1) return [{ x: cx - radius, y: cy }];
    if (count === 2) return [
        { x: cx - radius, y: cy },
        { x: cx + radius, y: cy }
    ];

    const positions = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        positions.push({
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle)
        });
    }
    return positions;
}

// ---- Draw SVG Connections ----
function drawConnections() {
    const svg = $('#connections-svg');
    const floor = $('#command-floor');
    if (!svg || !floor) return;

    const w = floor.offsetWidth;
    const h = floor.offsetHeight;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.innerHTML = '';

    const cx = w / 2;
    const cy = h / 2;

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.appendChild(defs);

    document.querySelectorAll('.station').forEach((station, i) => {
        const sx = parseFloat(station.style.left);
        const sy = parseFloat(station.style.top);
        const color = STATION_COLORS[i % STATION_COLORS.length];

        // Gradient
        const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        grad.setAttribute("id", `cg-${i}`);
        grad.setAttribute("gradientUnits", "userSpaceOnUse");
        grad.setAttribute("x1", sx); grad.setAttribute("y1", sy);
        grad.setAttribute("x2", cx); grad.setAttribute("y2", cy);

        const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        s1.setAttribute("offset", "0%");
        s1.setAttribute("stop-color", color.css);
        s1.setAttribute("stop-opacity", "0.12");

        const s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        s2.setAttribute("offset", "100%");
        s2.setAttribute("stop-color", "#ec4899");
        s2.setAttribute("stop-opacity", "0.08");

        grad.appendChild(s1);
        grad.appendChild(s2);
        defs.appendChild(grad);

        // Bezier path
        const mx = (sx + cx) / 2;
        const d = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${cy}, ${cx} ${cy}`;

        // Base line
        const basePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        basePath.setAttribute("d", d);
        basePath.setAttribute("class", "conn-line");
        basePath.setAttribute("stroke", `url(#cg-${i})`);
        svg.appendChild(basePath);

        // Glow path
        const glowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        glowPath.setAttribute("d", d);
        glowPath.setAttribute("class", "conn-glow");
        glowPath.setAttribute("id", `glow-${station.dataset.serverId}`);
        glowPath.style.stroke = color.css;
        svg.appendChild(glowPath);

        const len = basePath.getTotalLength();
        glowPath.style.setProperty('--path-len', len);
        glowPath.style.strokeDasharray = `10, ${len}`;
        glowPath.style.strokeDashoffset = len;
    });
}

// ---- Trigger Glow on Real Data ----
function triggerGlow(serverId) {
    const glow = document.getElementById(`glow-${serverId}`);
    if (!glow) return;
    glow.classList.remove('active');
    void glow.offsetWidth;
    glow.classList.add('active');
}

function flashStation(serverId) {
    const station = document.querySelector(`.station[data-server-id="${serverId}"] .station-card`);
    if (!station) return;
    station.classList.add('processing');
    setTimeout(() => station.classList.remove('processing'), 600);
}

// ---- Central Core ----
function updateCentralCore() {
    const connected = servers.filter(s => s.status === 'connected').length;
    const el = $('#core-connected');
    if (el) el.textContent = `${connected} online`;
}

// ---- Stats ----
function updateStats() {
    const connected = servers.filter(s => s.status === 'connected').length;
    const totalTools = servers.reduce((sum, s) => sum + s.tools.length, 0);
    $('#stat-servers').textContent = `${connected}/${servers.length}`;
    $('#stat-tools').textContent = totalTools;
}

function startUptimeCounter() {
    setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        $('#stat-uptime').textContent = `${h}:${m}:${s}`;
    }, 1000);
}

function startMsgRateCounter() {
    setInterval(() => {
        messagesPerSecond = messageCount;
        messageCount = 0;
        $('#stat-messages').textContent = `${messagesPerSecond}/s`;
    }, 1000);
}

// ---- Activity Feed ----
const feedItems = [];
const MAX_FEED = 40;

function addFeedItem(entry, serverId) {
    const server = servers.find(s => s.id === serverId);
    const name = server ? server.name : serverId;
    const data = entry.data;
    const method = data?.method || (data?.result !== undefined ? 'response' : '?');
    const id = data?.id !== undefined ? ` #${data.id}` : '';
    const text = `[${entry.direction.toUpperCase()}] ${method}${id} → ${name}`;

    // Hide empty message
    const empty = $('#feed-empty');
    if (empty) empty.style.display = 'none';

    const ticker = $('#feed-ticker');
    const span = document.createElement('span');
    span.className = `feed-item ${entry.direction}`;
    span.textContent = text;
    ticker.appendChild(span);

    feedItems.push(span);
    if (feedItems.length > MAX_FEED) {
        const old = feedItems.shift();
        old.remove();
    }
}

function startTickerScroll() {
    function tick() {
        const ticker = $('#feed-ticker');
        if (ticker && !ticker.matches(':hover') && ticker.scrollWidth > ticker.clientWidth) {
            ticker.scrollLeft += 0.8;
            // Loop back when we've scrolled past content
            if (ticker.scrollLeft >= ticker.scrollWidth - ticker.clientWidth) {
                ticker.scrollLeft = 0;
            }
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ---- Overlay ----
function openOverlay(serverId) {
    selectedServerId = serverId;
    selectedTab = 'tools';
    selectedTool = null;

    // Reset tabs
    $$('.ov-tab').forEach(t => t.classList.remove('active'));
    $$('.ov-tab')[0].classList.add('active');

    $('#station-overlay').classList.remove('hidden');
    $('#overlay-tester').classList.add('hidden');

    renderOverlayContent();
    send('getMessageLog', { serverId });
}

function closeOverlay() {
    $('#station-overlay').classList.add('hidden');
    selectedServerId = null;
    selectedTool = null;
}

function renderOverlayContent() {
    const server = servers.find(s => s.id === selectedServerId);
    if (!server) return;

    $('#overlay-name').textContent = server.name;
    $('#overlay-badge').textContent = server.transportType;

    const statusEl = $('#overlay-status');
    statusEl.textContent = server.status;
    statusEl.className = 'status-badge ' + server.status;

    $('#ov-tools-count').textContent = server.tools.length;
    $('#ov-resources-count').textContent = server.resources.length;
    $('#ov-prompts-count').textContent = server.prompts.length;

    renderOverlayTabContent();
}

function renderOverlayTabContent() {
    const server = servers.find(s => s.id === selectedServerId);
    if (!server) return;

    const content = $('#overlay-tab-content');

    switch (selectedTab) {
        case 'tools': renderTools(content, server.tools); break;
        case 'resources': renderResources(content, server.resources); break;
        case 'prompts': renderPrompts(content, server.prompts); break;
    }
}

function renderTools(container, tools) {
    if (!tools.length) {
        container.innerHTML = '<div class="no-items">No tools available. Connect to the server first.</div>';
        return;
    }

    function buildToolsHTML(filteredTools) {
        return filteredTools.map(tool => {
            const props = tool.inputSchema?.properties || {};
            const required = tool.inputSchema?.required || [];
            const params = Object.keys(props).map(p =>
                `<span class="param-chip ${required.includes(p) ? 'required' : ''}">${escapeHtml(p)}</span>`
            ).join('');

            return `
                <div class="tool-card" data-tool="${escapeHtml(tool.name)}" tabindex="0" role="button">
                    <div class="tool-card-name">${escapeHtml(tool.name)}</div>
                    <div class="tool-card-desc">${escapeHtml(tool.description || 'No description')}</div>
                    <div class="tool-card-params">${params || '<span class="param-chip">no params</span>'}</div>
                </div>
            `;
        }).join('');
    }

    container.innerHTML = `
        <div class="tools-search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="tools-search-input" placeholder="Search tools..." autocomplete="off">
            <span class="tools-search-count">${tools.length} tool${tools.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="tools-grid" id="tools-grid">${buildToolsHTML(tools)}</div>`;

    function bindToolCards() {
        container.querySelectorAll('.tool-card').forEach(card => {
            card.addEventListener('click', () => openTester(card.dataset.tool));
        });
    }
    bindToolCards();

    const searchInput = container.querySelector('#tools-search-input');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const filtered = query
            ? tools.filter(t => t.name.toLowerCase().includes(query) || (t.description || '').toLowerCase().includes(query))
            : tools;
        const grid = container.querySelector('#tools-grid');
        const count = container.querySelector('.tools-search-count');
        grid.innerHTML = buildToolsHTML(filtered);
        count.textContent = `${filtered.length} tool${filtered.length !== 1 ? 's' : ''}`;
        bindToolCards();
    });
}

function renderResources(container, resources) {
    if (!resources.length) {
        container.innerHTML = '<div class="no-items">No resources available.</div>';
        return;
    }

    container.innerHTML = `<div class="item-list">${resources.map(r => `
        <div class="item-row item-row-clickable" data-uri="${escapeHtml(r.uri)}" tabindex="0" role="button">
            <svg class="item-row-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
            </svg>
            <div>
                <div class="item-row-name">${escapeHtml(r.name || r.uri)}</div>
                <div class="item-row-detail">${escapeHtml(r.uri)}${r.mimeType ? ` · ${escapeHtml(r.mimeType)}` : ''}</div>
            </div>
            <span class="item-row-action">Read</span>
        </div>
    `).join('')}</div>`;

    container.querySelectorAll('.item-row-clickable').forEach(row => {
        row.addEventListener('click', () => openResourceReader(row.dataset.uri));
    });
}

function openResourceReader(uri) {
    selectedResource = uri;
    selectedTool = null;
    selectedPrompt = null;

    const tester = $('#overlay-tester');
    tester.classList.remove('hidden');

    $('#ov-tester-name').textContent = 'Read Resource';
    $('#ov-tester-desc').textContent = uri;
    $('#ov-tool-result').classList.add('hidden');
    $('#exec-duration').textContent = '';
    $('#ov-tester-form').innerHTML = '<div class="no-items" style="padding:0.8rem">Click "Read" to fetch this resource.</div>';

    const execBtn = $('#btn-execute');
    execBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Read`;
    execBtn.disabled = false;

    tester.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderPrompts(container, prompts) {
    if (!prompts.length) {
        container.innerHTML = '<div class="no-items">No prompts available.</div>';
        return;
    }

    container.innerHTML = `<div class="item-list">${prompts.map(p => `
        <div class="item-row item-row-clickable" data-prompt="${escapeHtml(p.name)}" tabindex="0" role="button">
            <svg class="item-row-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div>
                <div class="item-row-name">${escapeHtml(p.name)}</div>
                <div class="item-row-detail">${escapeHtml(p.description || 'No description')}</div>
            </div>
            <span class="item-row-action">Run</span>
        </div>
    `).join('')}</div>`;

    container.querySelectorAll('.item-row-clickable').forEach(row => {
        row.addEventListener('click', () => openPromptRunner(row.dataset.prompt));
    });
}

function openPromptRunner(promptName) {
    const server = servers.find(s => s.id === selectedServerId);
    if (!server) return;

    const prompt = server.prompts.find(p => p.name === promptName);
    if (!prompt) return;

    selectedPrompt = prompt;
    selectedTool = null;
    selectedResource = null;

    const tester = $('#overlay-tester');
    tester.classList.remove('hidden');

    $('#ov-tester-name').textContent = prompt.name;
    $('#ov-tester-desc').textContent = prompt.description || '';
    $('#ov-tool-result').classList.add('hidden');
    $('#exec-duration').textContent = '';

    const form = $('#ov-tester-form');
    const args = prompt.arguments || [];

    if (args.length) {
        form.innerHTML = args.map(arg => `
            <div class="form-group">
                <label for="f-${escapeHtml(arg.name)}">${escapeHtml(arg.name)}${arg.required ? '<span class="field-required">*</span>' : ''}</label>
                <input type="text" id="f-${escapeHtml(arg.name)}" data-field="${escapeHtml(arg.name)}" data-type="string"
                    placeholder="${escapeHtml(arg.description || '')}" ${arg.required ? 'required' : ''}>
            </div>
        `).join('');
    } else {
        form.innerHTML = '<div class="no-items" style="padding:0.8rem">This prompt takes no arguments.</div>';
    }

    const execBtn = $('#btn-execute');
    execBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Get Prompt`;
    execBtn.disabled = false;

    tester.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---- Tool Tester ----
function openTester(toolName) {
    const server = servers.find(s => s.id === selectedServerId);
    if (!server) return;

    const tool = server.tools.find(t => t.name === toolName);
    if (!tool) return;

    selectedTool = tool;
    const tester = $('#overlay-tester');
    tester.classList.remove('hidden');

    $('#ov-tester-name').textContent = tool.name;
    $('#ov-tester-desc').textContent = tool.description || '';
    $('#ov-tool-result').classList.add('hidden');
    $('#exec-duration').textContent = '';

    const form = $('#ov-tester-form');
    const props = tool.inputSchema?.properties || {};
    const required = tool.inputSchema?.required || [];

    form.innerHTML = Object.entries(props).map(([name, schema]) => {
        const isReq = required.includes(name);
        const type = schema.type || 'string';
        const desc = schema.description || '';

        let input;
        if (type === 'boolean') {
            input = `<select id="f-${name}" data-field="${name}" data-type="boolean">
                <option value="">-- select --</option>
                <option value="true">true</option>
                <option value="false">false</option>
            </select>`;
        } else if (type === 'number' || type === 'integer') {
            input = `<input type="number" id="f-${name}" data-field="${name}" data-type="number"
                placeholder="${escapeHtml(desc)}" ${isReq ? 'required' : ''} step="any">`;
        } else if (type === 'object' || type === 'array') {
            input = `<textarea id="f-${name}" data-field="${name}" data-type="json"
                placeholder='${type === 'array' ? '["item1"]' : '{"key": "value"}'}'
                rows="2" ${isReq ? 'required' : ''}></textarea>`;
        } else if (schema.enum) {
            input = `<select id="f-${name}" data-field="${name}" data-type="string">
                <option value="">-- select --</option>
                ${schema.enum.map(v => `<option value="${escapeHtml(String(v))}">${escapeHtml(String(v))}</option>`).join('')}
            </select>`;
        } else {
            input = `<input type="text" id="f-${name}" data-field="${name}" data-type="string"
                placeholder="${escapeHtml(desc)}" ${isReq ? 'required' : ''}>`;
        }

        return `<div class="form-group">
            <label for="f-${name}">${escapeHtml(name)}${isReq ? '<span class="field-required">*</span>' : ''}</label>
            ${input}
        </div>`;
    }).join('');

    if (!Object.keys(props).length) {
        form.innerHTML = '<div class="no-items" style="padding:0.8rem">This tool takes no arguments.</div>';
    }

    tester.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function executeTool() {
    if (executing || !selectedServerId) return;
    if (!selectedTool && !selectedResource && !selectedPrompt) return;

    executing = true;
    const execBtn = $('#btn-execute');
    execBtn.innerHTML = '<span class="spinner"></span> Running...';
    execBtn.disabled = true;
    $('#ov-tool-result').classList.add('hidden');

    if (selectedResource) {
        send('readResource', { serverId: selectedServerId, uri: selectedResource });
        return;
    }

    if (selectedPrompt) {
        const args = {};
        $$('#ov-tester-form [data-field]').forEach(el => {
            const val = el.value.trim();
            if (val) args[el.dataset.field] = val;
        });
        send('getPrompt', { serverId: selectedServerId, promptName: selectedPrompt.name, args });
        return;
    }

    // Tool execution
    const args = {};
    $$('#ov-tester-form [data-field]').forEach(el => {
        const name = el.dataset.field;
        const type = el.dataset.type;
        const val = el.value.trim();
        if (!val) return;

        switch (type) {
            case 'number': args[name] = Number(val); break;
            case 'boolean': args[name] = val === 'true'; break;
            case 'json':
                try { args[name] = JSON.parse(val); } catch { args[name] = val; }
                break;
            default: args[name] = val;
        }
    });

    send('callTool', { serverId: selectedServerId, tool: selectedTool.name, args });
}

// ---- Utilities ----
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function syntaxHighlight(obj) {
    let json;
    if (typeof obj === 'string') {
        try { json = JSON.stringify(JSON.parse(obj), null, 2); }
        catch { return escapeHtml(obj); }
    } else {
        json = JSON.stringify(obj, null, 2);
    }
    if (!json) return '';

    return json
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
            (match) => {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    cls = /:$/.test(match) ? 'json-key' : 'json-string';
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return `<span class="${cls}">${match}</span>`;
            }
        );
}
