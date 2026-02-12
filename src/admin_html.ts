export const adminHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telegram Simulator Admin</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --text: #f1f5f9; --accent: #3b82f6; --success: #22c55e; --danger: #ef4444; }
        body { background: var(--bg); color: var(--text); font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 350px; gap: 20px; }
        .card { background: var(--card); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        h1, h2 { margin-top: 0; }
        .screen-container { position: relative; width: 100%; aspect-ratio: 16/10; background: #000; border-radius: 8px; overflow: hidden; }
        #live-screen { width: 100%; height: 100%; object-fit: contain; }
        .controls { display: grid; gap: 10px; margin-top: 20px; }
        button { background: var(--accent); color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-weight: 500; transition: opacity 0.2s; }
        button:hover { opacity: 0.9; }
        button.danger { background: var(--danger); }
        button.success { background: var(--success); }
        input, textarea { width: 100%; padding: 8px; margin-bottom: 10px; background: #334155; border: 1px solid #475569; color: white; border-radius: 6px; box-sizing: border-box; }
        .log-list { max-height: 500px; overflow-y: auto; font-family: monospace; font-size: 13px; }
        .log-item { padding: 8px; border-bottom: 1px solid #334155; }
        .log-item:last-child { border-bottom: none; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 5px; }
        .badge.out { background: var(--accent); }
        .badge.in { background: var(--success); }
        .status-bar { display: flex; gap: 15px; margin-bottom: 20px; align-items: center; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
        .status-online { background: var(--success); box-shadow: 0 0 8px var(--success); }
        @media (max-width: 900px) { .container { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="status-bar">
        <h1>🤖 AI Ass Admin</h1>
        <div><span class="status-dot status-online"></span> System Online</div>
        <div id="browser-status">Browser: Checking...</div>
    </div>

    <div class="container">
        <!-- Main Column: Screen & Logs -->
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2>Live View</h2>
                    <button onclick="refreshScreen()">🔄 Refresh</button>
                </div>
                <div class="screen-container">
                    <img id="live-screen" src="/screen" alt="Loading screen...">
                </div>
                <p style="font-size: 12px; color: #94a3b8; margin-top: 5px;">Auto-refreshes every 5s. If white/stuck, try Reload Browser.</p>
            </div>

            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h2>Last 50 Messages</h2>
                    <button onclick="loadMessages()">🔄 Reload</button>
                </div>
                <div id="message-log" class="log-list">Loading logs...</div>
            </div>
        </div>

        <!-- Sidebar: Controls -->
        <div>
            <div class="card">
                <h2>Controls</h2>
                <div class="controls">
                    <button class="danger" onclick="reloadBrowser()">⚠️ Reload Browser Page</button>
                    <a href="/login-qr" target="_blank"><button style="width: 100%">📱 Open QR Login</button></a>
                </div>
            </div>

            <div class="card" style="margin-top: 20px;">
                <h2>Send Message</h2>
                <form id="send-form" onsubmit="sendMessage(event)">
                    <label>Username (without @)</label>
                    <input type="text" id="username" placeholder="durov" required>
                    
                    <label>Message</label>
                    <textarea id="message" rows="3" placeholder="Hello there!" required></textarea>
                    
                    <button type="submit" class="success" style="width: 100%">Send Message</button>
                </form>
                <div id="send-status" style="margin-top: 10px; font-size: 13px;"></div>
            </div>
        </div>
    </div>

    <script>
        // Auto-refresh screen
        setInterval(refreshScreen, 5000);

        function refreshScreen() {
            const img = document.getElementById('live-screen');
            img.src = '/screen?t=' + new Date().getTime();
        }

        async function reloadBrowser() {
            if(!confirm('Are you sure you want to reload the browser page?')) return;
            try {
                const res = await fetch('/reload');
                const data = await res.json();
                alert(data.message || 'Reload command sent');
                setTimeout(refreshScreen, 2000);
            } catch(e) { alert('Error reloading: ' + e); }
        }

        async function sendMessage(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const status = document.getElementById('send-status');
            const username = document.getElementById('username').value;
            const message = document.getElementById('message').value;

            btn.disabled = true;
            btn.textContent = 'Sending...';
            status.textContent = '';
            status.style.color = '#94a3b8';

            try {
                const res = await fetch('/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, message })
                });
                const data = await res.json();
                
                if(data.success) {
                    status.textContent = '✅ Sent!';
                    status.style.color = 'var(--success)';
                    document.getElementById('message').value = '';
                    loadMessages();
                } else {
                    status.textContent = '❌ Error: ' + (data.details || data.error);
                    status.style.color = 'var(--danger)';
                }
            } catch(e) {
                status.textContent = '❌ Network Error';
                status.style.color = 'var(--danger)';
            } finally {
                btn.disabled = false;
                btn.textContent = 'Send Message';
            }
        }

        async function loadMessages() {
            const log = document.getElementById('message-log');
            try {
                const res = await fetch('/messages');
                const data = await res.json();
                
                if(data.messages && data.messages.length > 0) {
                    log.innerHTML = data.messages.map(m => {
                        const isOut = m.sender === 'SIMULATOR';
                        const badgeClass = isOut ? 'out' : 'in';
                        const badgeText = isOut ? 'OUT' : 'IN';
                        const user = m.dialogue?.user?.username || m.dialogue?.user?.firstName || 'Unknown';
                        const time = new Date(m.createdAt).toLocaleTimeString();
                        return \`
                            <div class="log-item">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span><span class="badge \${badgeClass}">\${badgeText}</span> <strong>@\${user}</strong></span>
                                    <span style="color: #94a3b8">\${time}</span>
                                </div>
                                <div style="color: #cbd5e1">\${m.text}</div>
                            </div>
                        \`;
                    }).join('');
                } else {
                    log.innerHTML = '<div style="padding: 10px; color: #94a3b8">No messages found</div>';
                }
            } catch(e) {
                log.innerHTML = '<div style="padding: 10px; color: var(--danger)">Failed to load messages</div>';
            }
        }

        // Initial load
        loadMessages();
        
        // Check server status
        fetch('/').then(r => r.json()).then(d => {
            if(d.browserStatus) document.getElementById('browser-status').textContent = 'Browser: ' + d.browserStatus;
        }).catch(() => {});
    </script>
</body>
</html>
`;
