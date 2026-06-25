const db = require('../src/db');

function getAdminPortalHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bot License Control Panel</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0b12;
      --card-bg: rgba(20, 20, 35, 0.6);
      --border: rgba(255, 255, 255, 0.08);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --glow: rgba(99, 102, 241, 0.15);
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Outfit', sans-serif;
    }
    
    body {
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background-image: 
        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.12) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(239, 68, 68, 0.05) 0px, transparent 50%);
      background-attachment: fixed;
    }

    /* Glassmorphism Login Container */
    #login-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(11, 11, 18, 0.85);
      backdrop-filter: blur(12px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      transition: opacity 0.3s ease;
    }

    .login-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 50px var(--glow);
      text-align: center;
    }

    .login-card h2 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #a5b4fc, #6366f1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .login-card p {
      color: var(--text-muted);
      font-size: 14px;
      margin-bottom: 30px;
    }

    .input-group {
      margin-bottom: 20px;
      text-align: left;
    }

    .input-group label {
      display: block;
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .input-field {
      width: 100%;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 16px;
      color: var(--text);
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .input-field:focus {
      border-color: var(--primary);
      box-shadow: 0 0 10px var(--glow);
    }

    .btn {
      width: 100%;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border: none;
      border-radius: 10px;
      padding: 14px;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .btn:hover {
      opacity: 0.95;
    }

    .btn:active {
      transform: scale(0.98);
    }

    .login-error {
      color: var(--danger);
      font-size: 13px;
      margin-top: 15px;
      display: none;
    }

    /* Main Dashboard View */
    #dashboard-view {
      display: none;
      flex-direction: column;
      flex-grow: 1;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 30px 20px;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-badge {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 20px;
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
    }

    .logo-text h1 {
      font-size: 22px;
      font-weight: 600;
    }

    .logo-text span {
      font-size: 12px;
      color: var(--text-muted);
      display: block;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .db-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--success);
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
      padding: 6px 12px;
      border-radius: 20px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 1.5s infinite;
    }

    .btn-logout {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: var(--danger);
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }

    .btn-logout:hover {
      background: var(--danger);
      color: #fff;
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .metric-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 20px rgba(0,0,0,0.2);
    }

    .metric-label {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-value {
      font-size: 32px;
      font-weight: 700;
      color: #fff;
    }

    /* Core Section Layout */
    .main-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 30px;
    }

    @media (min-width: 900px) {
      .main-grid {
        grid-template-columns: 350px 1fr;
      }
    }

    .dashboard-panel {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 15px 30px rgba(0,0,0,0.25);
    }

    .panel-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Form Styles */
    .form-row {
      margin-bottom: 18px;
    }

    .form-row label {
      display: block;
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    /* Table Styles */
    .table-container {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: rgba(0, 0, 0, 0.2);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      background: rgba(255, 255, 255, 0.02);
      padding: 14px 18px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 16px 18px;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
      vertical-align: middle;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .key-badge {
      font-family: monospace;
      font-size: 14px;
      background: rgba(255,255,255,0.06);
      padding: 4px 8px;
      border-radius: 6px;
      color: #a5b4fc;
      border: 1px solid rgba(255,255,255,0.04);
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-copy {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 2px;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
    }

    .btn-copy:hover {
      color: var(--primary);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 20px;
    }

    .status-active {
      background: rgba(16, 185, 129, 0.1);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .status-deactivated {
      background: rgba(239, 68, 68, 0.1);
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .status-expired {
      background: rgba(245, 158, 11, 0.1);
      color: var(--warning);
      border: 1px solid rgba(245, 158, 11, 0.2);
    }

    .user-bindings {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 80px;
      overflow-y: auto;
    }

    .bound-user {
      font-size: 12px;
      background: rgba(255, 255, 255, 0.04);
      padding: 2px 6px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }

    .bound-user-name {
      color: var(--text-muted);
      font-weight: 500;
    }

    .bound-user-id {
      font-family: monospace;
      color: #818cf8;
    }

    .action-icons {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .btn-action {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 15px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: color 0.1s;
    }

    .btn-toggle-active {
      color: var(--success);
    }
    
    .btn-toggle-deactive {
      color: var(--danger);
    }

    .btn-delete {
      color: var(--text-muted);
    }

    .btn-delete:hover {
      color: var(--danger);
    }

    .search-row {
      margin-bottom: 20px;
      display: flex;
      gap: 15px;
    }

    .search-input {
      flex-grow: 1;
    }

    @keyframes pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }

    .notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(20, 20, 35, 0.95);
      border: 1px solid var(--primary);
      box-shadow: 0 10px 30px rgba(99, 102, 241, 0.25);
      color: #fff;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 10000;
      transform: translateY(100px);
      opacity: 0;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s;
    }

    .notification.show {
      transform: translateY(0);
      opacity: 1;
    }
  </style>
</head>
<body>

  <!-- Login overlay -->
  <div id="login-overlay">
    <div class="login-card">
      <h2>Access Control</h2>
      <p>Secure Administrative Dashboard</p>
      
      <div class="input-group">
        <label for="admin-pin">Admin Password</label>
        <input type="password" id="admin-pin" class="input-field" placeholder="••••••••" onkeydown="if(event.key === 'Enter') login()">
      </div>
      
      <button class="btn" onclick="login()">Enter Dashboard</button>
      <div id="login-err" class="login-error">Invalid admin password. Please try again.</div>
    </div>
  </div>

  <!-- Dashboard view -->
  <div id="dashboard-view">
    <header>
      <div class="logo-container">
        <div class="logo-badge">🔑</div>
        <div class="logo-text">
          <h1>License Dashboard</h1>
          <span>Telegram Bot Manager</span>
        </div>
      </div>
      <div class="header-actions">
        <div class="db-status">
          <div class="status-dot"></div>
          <span>Database Linked</span>
        </div>
        <button class="btn-logout" onclick="logout()">Logout</button>
      </div>
    </header>

    <!-- Metrics row -->
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">Total Generated Keys</span>
        <span class="metric-value" id="metric-total">0</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Active Licenses</span>
        <span class="metric-value" id="metric-active" style="color: var(--success)">0</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Bound Accounts</span>
        <span class="metric-value" id="metric-bound" style="color: #818cf8">0</span>
      </div>
    </div>

    <div class="main-grid">
      <!-- Left column: Generator -->
      <div class="dashboard-panel">
        <h2 class="panel-title">🛡️ Generate New Key</h2>
        
        <div class="form-row">
          <label for="gen-code">Custom Key Code (Optional)</label>
          <input type="text" id="gen-code" class="input-field" placeholder="e.g. PREMIUM-30DAY" style="text-transform: uppercase;">
        </div>

        <div class="form-row">
          <label for="gen-limit">Account (Device) Limit</label>
          <input type="number" id="gen-limit" class="input-field" min="1" max="100" value="1">
        </div>

        <div class="form-row">
          <label for="gen-duration">Key Expiration Duration</label>
          <select id="gen-duration" class="input-field" style="background: rgba(0,0,0,0.3)">
            <option value="1">1 Day</option>
            <option value="7">7 Days</option>
            <option value="30" selected>30 Days</option>
            <option value="90">90 Days</option>
            <option value="365">1 Year</option>
            <option value="0">Lifetime (No Expiry)</option>
          </select>
        </div>

        <button class="btn" style="margin-top: 10px;" onclick="generateKey()">⚡ Generate Key</button>
      </div>

      <!-- Right column: Keys Database -->
      <div class="dashboard-panel">
        <div class="panel-title">
          <span>📋 Active License Keys</span>
        </div>

        <div class="search-row">
          <input type="text" id="search-bar" class="input-field search-input" placeholder="🔍 Search by key code..." oninput="filterKeys()">
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Key Code</th>
                <th>Limits</th>
                <th>Expiration</th>
                <th>Status</th>
                <th>Bound Accounts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="keys-table-body">
              <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">Loading keys database...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Popup Notification -->
  <div id="toast" class="notification">
    <span id="toast-text">Success message goes here</span>
  </div>

  <script>
    let globalKeys = [];

    // On page load, verify credentials
    window.addEventListener('DOMContentLoaded', () => {
      const pin = localStorage.getItem('admin_pass');
      if (pin) {
        loadDashboard(pin);
      }
    });

    async function loadDashboard(password) {
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': password
          },
          body: JSON.stringify({ action: 'list' })
        });

        if (res.status === 401) {
          localStorage.removeItem('admin_pass');
          document.getElementById('login-overlay').style.display = 'flex';
          document.getElementById('dashboard-view').style.display = 'none';
          document.getElementById('login-err').style.display = 'block';
          return;
        }

        const data = await res.json();
        globalKeys = data.keys || [];
        
        // Hide login, show dashboard
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('dashboard-view').style.display = 'flex';
        
        renderMetrics(globalKeys);
        renderTable(globalKeys);
      } catch (err) {
        showToast('❌ Connection error: ' + err.message);
      }
    }

    function login() {
      const pin = document.getElementById('admin-pin').value;
      if (!pin) return;
      localStorage.setItem('admin_pass', pin);
      loadDashboard(pin);
    }

    function logout() {
      localStorage.removeItem('admin_pass');
      document.getElementById('admin-pin').value = '';
      document.getElementById('login-overlay').style.display = 'flex';
      document.getElementById('dashboard-view').style.display = 'none';
      document.getElementById('login-err').style.display = 'none';
    }

    function renderMetrics(keys) {
      document.getElementById('metric-total').textContent = keys.length;
      const activeCount = keys.filter(k => k.status === 'ACTIVE').length;
      document.getElementById('metric-active').textContent = activeCount;
      
      let boundCount = 0;
      keys.forEach(k => {
        if (k.users) boundCount += k.users.length;
      });
      document.getElementById('metric-bound').textContent = boundCount;
    }

    function renderTable(keys) {
      const tbody = document.getElementById('keys-table-body');
      tbody.innerHTML = '';

      if (keys.length === 0) {
        tbody.innerHTML = \`<tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">No keys found. Generate one to begin.</td>
        </tr>\`;
        return;
      }

      keys.forEach(k => {
        const tr = document.createElement('tr');
        
        // Expiry display formatting
        let expiryText = 'Lifetime';
        if (k.expires_at) {
          const date = new Date(k.expires_at);
          expiryText = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }

        // Limit display
        const activeUsersCount = k.users ? k.users.length : 0;
        const limitDisplay = \`\${activeUsersCount} / \${k.max_users}\`;

        // Status badge
        let statusClass = 'status-active';
        let statusLabel = 'Active';
        if (k.status === 'DEACTIVATED') {
          statusClass = 'status-deactivated';
          statusLabel = 'Disabled';
        } else if (k.status === 'EXPIRED') {
          statusClass = 'status-expired';
          statusLabel = 'Expired';
        }

        // Users mapping
        let usersHtml = '<div class="user-bindings">';
        if (k.users && k.users.length > 0) {
          k.users.forEach(u => {
            const userNameDisplay = u.username ? '@' + u.username : 'User';
            usersHtml += \`<div class="bound-user">
              <span class="bound-user-name">\${userNameDisplay}</span>
              <span class="bound-user-id">\${u.user_id}</span>
            </div>\`;
          });
        } else {
          usersHtml += '<span style="color: var(--text-muted); font-size: 12px;">No active bindings</span>';
        }
        usersHtml += '</div>';

        tr.innerHTML = \`
          <td>
            <div class="key-badge">
              <span>\${k.key_code}</span>
              <button class="btn-copy" onclick="copyKey('\${k.key_code}')" title="Copy Key">📋</button>
            </div>
          </td>
          <td style="font-weight: 500;">\${limitDisplay}</td>
          <td style="color: var(--text-muted);">\${expiryText}</td>
          <td>
            <span class="status-badge \${statusClass}">\${statusLabel}</span>
          </td>
          <td>\${usersHtml}</td>
          <td>
            <div class="action-icons">
              <button class="btn-action \${k.status === 'ACTIVE' ? 'btn-toggle-deactive' : 'btn-toggle-active'}" 
                      onclick="toggleKey('\${k.key_code}', '\${k.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE'}')" 
                      title="\${k.status === 'ACTIVE' ? 'Disable Key' : 'Enable Key'}">
                \${k.status === 'ACTIVE' ? '🔒' : '🔓'}
              </button>
              <button class="btn-action btn-delete" onclick="deleteKey('\${k.key_code}')" title="Delete Key">🗑️</button>
            </div>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function filterKeys() {
      const query = document.getElementById('search-bar').value.toLowerCase().trim();
      const filtered = globalKeys.filter(k => k.key_code.toLowerCase().includes(query));
      renderTable(filtered);
    }

    async function makeApiRequest(payload) {
      const pin = localStorage.getItem('admin_pass');
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': pin
          },
          body: JSON.stringify(payload)
        });

        if (res.status === 401) {
          logout();
          return;
        }

        const data = await res.json();
        if (data.error) {
          showToast('❌ Error: ' + data.error);
          return;
        }

        globalKeys = data.keys || [];
        renderMetrics(globalKeys);
        renderTable(globalKeys);
        filterKeys(); // preserve search query
        return data;
      } catch (err) {
        showToast('❌ Request failed: ' + err.message);
      }
    }

    async function generateKey() {
      const customCode = document.getElementById('gen-code').value.trim();
      const limit = parseInt(document.getElementById('gen-limit').value, 10) || 1;
      const duration = parseInt(document.getElementById('gen-duration').value, 10);
      
      const res = await makeApiRequest({
        action: 'generate',
        keyCode: customCode,
        maxUsers: limit,
        durationDays: duration > 0 ? duration : null
      });

      if (res && res.success) {
        showToast('✅ Key generated successfully: ' + res.code);
        document.getElementById('gen-code').value = '';
      }
    }

    async function toggleKey(code, newStatus) {
      await makeApiRequest({
        action: 'toggle',
        keyCode: code,
        status: newStatus
      });
      showToast('✅ Key status updated!');
    }

    async function deleteKey(code) {
      if (!confirm('Are you sure you want to delete license key ' + code + '? This will revoke access for all bound accounts.')) return;
      await makeApiRequest({
        action: 'delete',
        keyCode: code
      });
      showToast('🗑️ Key deleted!');
    }

    function copyKey(code) {
      navigator.clipboard.writeText(code).then(() => {
        showToast('📋 Copied to clipboard: ' + code);
      });
    }

    function showToast(message) {
      const toast = document.getElementById('toast');
      document.getElementById('toast-text').textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  </script>
</body>
</html>`;
}

module.exports = async (req, res) => {
  // Always initialize db
  try {
    await db.initDb();
  } catch (dbErr) {
    console.error('Database initialization in admin endpoint failed:', dbErr);
  }

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  const getAuthPass = (req) => {
    return req.headers['authorization'] || '';
  };

  const isAuthorized = (req) => {
    return getAuthPass(req) === ADMIN_PASSWORD;
  };

  // 1. GET requests serve the interactive web panel HTML
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(getAdminPortalHtml());
  }

  // 2. POST requests handle administrative actions (API endpoints)
  if (req.method === 'POST') {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized. Invalid admin password.' });
    }

    const { action, keyCode, maxUsers, durationDays, status } = req.body || {};

    try {
      if (action === 'list') {
        const keys = await db.getAdminKeys();
        return res.status(200).json({ keys });
      }

      if (action === 'generate') {
        let code = keyCode ? String(keyCode).trim().toUpperCase() : '';
        
        // Auto-generate key code if none is provided
        if (!code) {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let p1 = '';
          let p2 = '';
          for (let i = 0; i < 4; i++) {
            p1 += chars.charAt(Math.floor(Math.random() * chars.length));
            p2 += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          code = `KEY-${p1}-${p2}`;
        }

        const max = parseInt(maxUsers, 10) || 1;
        const duration = durationDays ? parseFloat(durationDays) : null;

        await db.createKey(code, max, duration);
        const keys = await db.getAdminKeys();
        return res.status(200).json({ success: true, keys, code });
      }

      if (action === 'toggle') {
        if (!keyCode || !status) {
          return res.status(400).json({ error: 'Missing keyCode or status' });
        }
        await db.updateKeyStatus(keyCode, status);
        const keys = await db.getAdminKeys();
        return res.status(200).json({ success: true, keys });
      }

      if (action === 'delete') {
        if (!keyCode) {
          return res.status(400).json({ error: 'Missing keyCode' });
        }
        await db.deleteKey(keyCode);
        const keys = await db.getAdminKeys();
        return res.status(200).json({ success: true, keys });
      }

      return res.status(400).json({ error: 'Invalid action specified.' });
    } catch (err) {
      console.error('Admin endpoint database error:', err);
      return res.status(500).json({ error: err.message || 'Database error occurred' });
    }
  }

  // Method Not Allowed
  return res.status(405).json({ error: 'Method Not Allowed' });
};
