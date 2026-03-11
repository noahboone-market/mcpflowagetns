document.addEventListener('DOMContentLoaded', () => {
    renderAgents();

    setTimeout(() => {
        drawConnections();
        simulateFlow();
    }, 100);

    window.addEventListener('resize', drawConnections);

    // Smooth Parallax tracking for AI Background
    if (!prefersReducedMotion()) {
        const bg = document.getElementById('ai-bg');
        if (bg) {
            let lastScrollY = window.scrollY;
            let mouseX = 0;
            let mouseY = 0;

            // Mouse interaction effect
            document.addEventListener('mousemove', (e) => {
                mouseX = (e.clientX / window.innerWidth - 0.5) * 20; // -10px to +10px
                mouseY = (e.clientY / window.innerHeight - 0.5) * 20;
            });

            // Smooth fluid animation loop
            const renderParallax = () => {
                const currentScrollY = window.scrollY;
                const scrollTranslate = currentScrollY * -0.15; // Moves up slightly slower than scroll
                const zoomScale = 1 + (currentScrollY * 0.0003); // Slight zoom out

                bg.style.transform = `translate3d(${mouseX}px, calc(${mouseY}px + ${scrollTranslate}px), 0) scale(${zoomScale})`;

                requestAnimationFrame(renderParallax);
            };
            requestAnimationFrame(renderParallax);
        }
    }
});

// ---- Reduced Motion Check ----
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---- Syntax Highlighting ----
function syntaxHighlight(json) {
    if (typeof json !== 'string') {
        json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        function (match) {
            let cls = 'json-number';
            if (/^"/.test(match)) {
                cls = /:$/.test(match) ? 'json-key' : 'json-string';
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        }
    );
}

// ---- Icons ----
const icons = {
    github: `<svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>`,
    code: `<svg viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`,
    layers: `<svg viewBox="0 0 24 24"><path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"/></svg>`,
    database: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 4.24 2 7v10c0 2.76 4.48 5 10 5s10-2.24 10-5V7c0-2.76-4.48-5-10-5zm0 18c-4.41 0-8-1.79-8-4v-2.11c2.14 1.31 4.91 2.11 8 2.11s5.86-.8 8-2.11V16c0 2.21-3.59 4-8 4zm0-6c-4.41 0-8-1.79-8-4V7.9c2.14 1.31 4.91 2.11 8 2.11s5.86-.8 8-2.11V10c0 2.21-3.59 4-8 4zm0-6C7.59 4 4 5.79 4 8s3.59 4 8 4 8-1.79 8-4-3.59-4-8-4z"/></svg>`,
    check: `<svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>`
};

// ---- Agent Data ----
const agentsData = [
    {
        id: 'agent-git',
        name: 'Git / Version Info',
        icon: 'github',
        color: '#3b82f6',
        tooltipTitle: 'auth_git',
        x: 20, y: 30,
        data: { "query": "SELECT * context", "vector_match": 0.94, "found": true }
    },
    {
        id: 'agent-react',
        name: 'React / CodeGen',
        icon: 'code',
        color: '#f59e0b',
        tooltipTitle: 'generate_react',
        x: 80, y: 30,
        data: { "component": "Button", "props": ["onClick", "variant"], "status": "generated" }
    },
    {
        id: 'agent-router',
        name: 'MCP Router Core',
        icon: 'layers',
        color: '#ec4899',
        tooltipTitle: 'mcp_core_router',
        x: 50, y: 50,
        data: { "routed_requests": 3491, "latency_ms": 12, "active_nodes": 4 }
    },
    {
        id: 'agent-db',
        name: 'Postgres Memory',
        icon: 'database',
        color: '#10b981',
        tooltipTitle: 'query_mem',
        x: 20, y: 70,
        data: { "connection": "established", "pool_size": 10, "hit_rate": 0.99 }
    },
    {
        id: 'agent-lint',
        name: 'Lint & Security',
        icon: 'check',
        color: '#94a3b8',
        tooltipTitle: 'sec_scan',
        x: 80, y: 70,
        data: { "vulnerabilities": 0, "lint_errors": 0, "pass": true }
    }
];

const connections = [
    { from: 'agent-git', to: 'agent-router' },
    { from: 'agent-react', to: 'agent-router' },
    { from: 'agent-router', to: 'agent-db' },
    { from: 'agent-router', to: 'agent-lint' }
];

// ---- Render Agents ----
function renderAgents() {
    const area = document.getElementById('visualization-area');

    agentsData.forEach((agent) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'agent-node-wrapper';
        wrapper.id = `wrapper-${agent.id}`;

        // Flip tooltip for right-side nodes
        if (agent.x > 60) {
            wrapper.classList.add('tooltip-left');
        }

        wrapper.style.left = `${agent.x}%`;
        wrapper.style.top = `${agent.y}%`;

        const highlightedJson = syntaxHighlight(agent.data);
        const svgIcon = icons[agent.icon] || '';
        const isCenter = agent.id === 'agent-router' ? 'center-node' : '';

        wrapper.innerHTML = `
            <div class="agent-node ${isCenter}" id="${agent.id}"
                 style="--glow-color: ${agent.color};"
                 role="button"
                 tabindex="0"
                 aria-label="${agent.name} agent node">
                ${svgIcon}
            </div>
            <div class="agent-label">${agent.name}</div>
            <div class="agent-tooltip" role="tooltip">
                <div class="tooltip-header">
                    <h3>${agent.tooltipTitle}</h3>
                    <div class="status-dot" style="background-color: ${agent.color}; box-shadow: 0 0 8px ${agent.color};"></div>
                </div>
                <div class="json-display"><pre><code>${highlightedJson}</code></pre></div>
            </div>
        `;

        area.appendChild(wrapper);
    });
}

// ---- Draw SVG Connections ----
function drawConnections() {
    const svg = document.getElementById('connections-svg');
    const container = document.getElementById('network-container');
    if (!svg || !container) return;

    svg.innerHTML = '';
    const containerRect = container.getBoundingClientRect();

    // Define gradient for connection lines
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    connections.forEach((conn, i) => {
        const fromAgent = agentsData.find(a => a.id === conn.from);
        const toAgent = agentsData.find(a => a.id === conn.to);
        const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        gradient.setAttribute("id", `grad-${i}`);
        gradient.setAttribute("gradientUnits", "userSpaceOnUse");

        const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", fromAgent.color);
        stop1.setAttribute("stop-opacity", "0.15");

        const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", toAgent.color);
        stop2.setAttribute("stop-opacity", "0.15");

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
    });
    svg.appendChild(defs);

    connections.forEach((conn, i) => {
        const fromEl = document.getElementById(conn.from);
        const toEl = document.getElementById(conn.to);
        if (!fromEl || !toEl) return;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const fromX = fromRect.left + fromRect.width / 2 - containerRect.left;
        const fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
        const toX = toRect.left + toRect.width / 2 - containerRect.left;
        const toY = toRect.top + toRect.height / 2 - containerRect.top;

        const curveX = (fromX + toX) / 2;
        const d = `M ${fromX} ${fromY} C ${curveX} ${fromY}, ${curveX} ${toY}, ${toX} ${toY}`;

        // Base line with gradient
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("class", "conn-line");
        path.setAttribute("stroke", `url(#grad-${i})`);

        // Animated glow
        const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
        glow.setAttribute("d", d);
        glow.setAttribute("class", "conn-glow");
        glow.setAttribute("id", `glow-${conn.from}-${conn.to}`);

        const fromData = agentsData.find(a => a.id === conn.from);
        glow.style.stroke = fromData.color;

        svg.appendChild(path);
        svg.appendChild(glow);

        const length = path.getTotalLength();
        glow.style.setProperty('--path-length', length);
        glow.style.strokeDasharray = `10, ${length}`;
        glow.style.strokeDashoffset = length;
    });
}

// ---- Simulate Flow via Live Server backend ----
function simulateFlow() {
    if (prefersReducedMotion() || typeof io === 'undefined') return;

    // Connect to the Node backend
    const socket = io('http://localhost:3001');

    console.log('Connecting to MCP Orchestrator backend...');

    socket.on('agent_activity', (data) => {
        const { fromId, toId, duration } = data;

        const fromEl = document.getElementById(fromId);
        const toEl = document.getElementById(toId);
        const wrapperFrom = document.getElementById(`wrapper-${fromId}`);
        const wrapperTo = document.getElementById(`wrapper-${toId}`);
        const glow = document.getElementById(`glow-${fromId}-${toId}`) || document.getElementById(`glow-${toId}-${fromId}`);

        // Update real time values on dashboard
        if (data.metrics) {
            const statsElements = document.querySelectorAll('.stat-value');
            if (statsElements.length === 3) {
                statsElements[0].textContent = data.metrics.activeAgents;
                statsElements[1].textContent = data.metrics.latency + 'ms';
                statsElements[2].textContent = data.metrics.uptime + '%';
            }
        }

        if (glow) {
            glow.classList.remove('active');
            void glow.offsetWidth; // Trigger reflow
            glow.style.animationDuration = `${duration}ms`;
            glow.classList.add('active');
        }

        if (fromEl) {
            fromEl.classList.add('active');
            if (wrapperFrom) wrapperFrom.classList.add('active-tooltip');
        }

        setTimeout(() => {
            if (fromEl) {
                fromEl.classList.remove('active');
                if (wrapperFrom) wrapperFrom.classList.remove('active-tooltip');
            }

            if (toEl) {
                toEl.classList.add('active');
                if (wrapperTo) wrapperTo.classList.add('active-tooltip');
            }

            setTimeout(() => {
                if (toEl) {
                    toEl.classList.remove('active');
                    if (wrapperTo) wrapperTo.classList.remove('active-tooltip');
                }
            }, 1000);
        }, duration || 1800);
    });
}
