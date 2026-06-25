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

    /* Modal Detail View */
    #detail-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(11, 11, 18, 0.85);
      backdrop-filter: blur(12px);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.25s ease;
    }

    #detail-modal-overlay.show {
      opacity: 1;
    }

    .modal-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 30px;
      width: 100%;
      max-width: 550px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 50px var(--glow);
      position: relative;
      transform: scale(0.9);
      transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    #detail-modal-overlay.show .modal-card {
      transform: scale(1);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }

    .modal-title {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal-close:hover {
      color: var(--danger);
    }

    .modal-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    .modal-item {
      background: rgba(0,0,0,0.25);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 16px;
      text-align: left;
    }

    .modal-item-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .modal-item-value {
      font-size: 15px;
      font-weight: 500;
      color: #fff;
    }

    .modal-section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      text-align: left;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
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
      <!-- Left column: Generator & Security Alerts -->
      <div style="display: flex; flex-direction: column; gap: 30px;">
        <div class="dashboard-panel">
          <h2 class="panel-title">🛡️ Generate New Key</h2>
          
          <div class="form-row">
            <label for="gen-code">Custom Key Code (Optional)</label>
            <div style="display: flex; gap: 10px;">
              <input type="text" id="gen-code" class="input-field" placeholder="e.g. PREMIUM-30DAY" style="text-transform: uppercase; flex-grow: 1;">
              <button class="btn" style="width: auto; padding: 12px 16px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); box-shadow: none;" onclick="suggestRandomCode()" type="button" title="Generate Random Code">🎲</button>
            </div>
          </div>

          <div class="form-row">
            <label for="gen-buyer">Buyer Name / Notes (Optional)</label>
            <input type="text" id="gen-buyer" class="input-field" placeholder="e.g. John Doe / @username">
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

        <div class="dashboard-panel">
          <div class="panel-title" style="margin-bottom: 15px;">
            <span>🚨 Security Alerts</span>
            <button onclick="clearAlertsList()" style="background: none; border: none; color: var(--danger); font-size: 13px; font-weight: 500; cursor: pointer;">Clear Logs</button>
          </div>
          <div id="alerts-list-body" style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
            <div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 15px;">No security alerts logged.</div>
          </div>
        </div>
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
                <th>Used / Limit</th>
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

  <!-- Key Detail Modal -->
  <div id="detail-modal-overlay" onclick="closeModal(event)">
    <div class="modal-card" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">
          <span>🔑 Key Details</span>
          <span id="modal-key-badge" class="key-badge" style="font-size: 13px;">KEY-CODE</span>
        </div>
        <button class="modal-close" onclick="hideModal()">✕</button>
      </div>

      <div class="modal-grid">
        <div class="modal-item">
          <div class="modal-item-label">Status</div>
          <div class="modal-item-value" id="modal-status">-</div>
        </div>
        <div class="modal-item">
          <div class="modal-item-label">Used / Limit</div>
          <div class="modal-item-value" id="modal-limits">-</div>
        </div>
        <div class="modal-item" style="grid-column: span 2;">
          <div class="modal-item-label">Buyer Name / Notes</div>
          <div class="modal-item-value" id="modal-buyer">-</div>
        </div>
        <div class="modal-item" style="grid-column: span 2;">
          <div class="modal-item-label">Expiration Date</div>
          <div class="modal-item-value" id="modal-expiry">-</div>
        </div>
      </div>

      <div>
        <div class="modal-section-title">
          <span>👥 Bound Accounts</span>
        </div>
        <div id="modal-bound-users-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 150px; overflow-y: auto;">
          <span style="color: var(--text-muted); font-size: 13px;">No active bindings</span>
        </div>
      </div>

      <div class="modal-actions">
        <button id="modal-btn-toggle" class="btn" style="flex-grow: 1; font-size: 14px; padding: 10px;" onclick="modalToggleStatus()">Disable Key</button>
        <button id="modal-btn-delete" class="btn" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--danger); box-shadow: none; flex-grow: 1; font-size: 14px; padding: 10px;" onclick="modalDeleteKey()">Delete Key</button>
      </div>
    </div>
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

    function suggestRandomCode() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let p1 = '';
      let p2 = '';
      for (let i = 0; i < 4; i++) {
        p1 += chars.charAt(Math.floor(Math.random() * chars.length));
        p2 += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      document.getElementById('gen-code').value = "KEY-" + p1 + "-" + p2;
    }

    async function loadDashboard(password) {
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'list', password: password })
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
        const alerts = data.alerts || [];
        
        // Hide login, show dashboard
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('dashboard-view').style.display = 'flex';
        
        renderMetrics(globalKeys);
        renderTable(globalKeys);
        renderAlerts(alerts);
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
        tbody.innerHTML = "<tr><td colspan='6' style='text-align: center; color: var(--text-muted); padding: 30px;'>No keys found. Generate one to begin.</td></tr>";
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
        const isFull = activeUsersCount >= k.max_users;
        const limitColor = isFull ? 'var(--success)' : 'var(--text-muted)';
        const limitDisplay = "<strong style='color: " + limitColor + ";'>" + activeUsersCount + "</strong> / <span style='color: var(--text-muted);'>" + k.max_users + "</span>";

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
            usersHtml += "<div class='bound-user'><span class='bound-user-name'>" + userNameDisplay + "</span><div style='display: flex; align-items: center; gap: 6px;'><span class='bound-user-id'>" + u.user_id + "</span><button onclick='unbindUser(\"" + k.key_code + "\", \"" + u.user_id + "\")' title='Unbind Account' style='background: none; border: none; cursor: pointer; color: var(--danger); font-size: 10px; padding: 0 2px; display: inline-flex; align-items: center;'>❌</button></div></div>";
          });
        } else {
          usersHtml += '<span style="color: var(--text-muted); font-size: 12px;">No active bindings</span>';
        }
        usersHtml += '</div>';

        const toggleIcon = k.status === 'ACTIVE' ? '🔒' : '🔓';
        const toggleTitle = k.status === 'ACTIVE' ? 'Disable Key' : 'Enable Key';
        const toggleStatusVal = k.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
        const toggleClass = k.status === 'ACTIVE' ? 'btn-toggle-deactive' : 'btn-toggle-active';

        const buyerNameDisplay = k.buyer_name ? "<div style='font-size: 12px; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 4px;'>👤 <span>" + k.buyer_name + "</span></div>" : "";
        tr.innerHTML = "<td><div class='key-badge' style='cursor: pointer; padding-right: 28px; position: relative;' onclick='showModal(\"" + k.key_code + "\")' title='View Key Details'><span>" + k.key_code + "</span><button class='btn-copy' onclick='event.stopPropagation(); copyKey(\"" + k.key_code + "\")' title='Copy Key' style='position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: inline-flex;'>📋</button></div>" + buyerNameDisplay + "</td><td style='font-weight: 500;'>" + limitDisplay + "</td><td style='color: var(--text-muted);'>" + expiryText + "</td><td><span class='status-badge " + statusClass + "'>" + statusLabel + "</span></td><td>" + usersHtml + "</td><td><div class='action-icons'><button class='btn-action " + toggleClass + "' onclick='toggleKey(\"" + k.key_code + "\", \"" + toggleStatusVal + "\")' title='" + toggleTitle + "'>" + toggleIcon + "</button><button class='btn-action btn-delete' onclick='deleteKey(\"" + k.key_code + "\")' title='Delete Key'>🗑️</button></div></td>";
        tbody.appendChild(tr);
      });
    }

    function filterKeys() {
      const query = document.getElementById('search-bar').value.toLowerCase().trim();
      const filtered = globalKeys.filter(k => 
        k.key_code.toLowerCase().includes(query) ||
        (k.buyer_name && k.buyer_name.toLowerCase().includes(query))
      );
      renderTable(filtered);
    }

    async function makeApiRequest(payload) {
      const pin = localStorage.getItem('admin_pass');
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ...payload, password: pin })
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
        const alerts = data.alerts || [];
        renderMetrics(globalKeys);
        renderTable(globalKeys);
        renderAlerts(alerts);
        filterKeys(); // preserve search query
        return data;
      } catch (err) {
        showToast('❌ Request failed: ' + err.message);
      }
    }

    async function generateKey() {
      const customCode = document.getElementById('gen-code').value.trim();
      const buyer = document.getElementById('gen-buyer').value.trim();
      const limit = parseInt(document.getElementById('gen-limit').value, 10) || 1;
      const duration = parseInt(document.getElementById('gen-duration').value, 10);
      
      const res = await makeApiRequest({
        action: 'generate',
        keyCode: customCode,
        buyerName: buyer,
        maxUsers: limit,
        durationDays: duration > 0 ? duration : null
      });

      if (res && res.success) {
        showToast('✅ Key generated successfully: ' + res.code);
        document.getElementById('gen-code').value = '';
        document.getElementById('gen-buyer').value = '';
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

    async function unbindUser(code, userId) {
      if (!confirm('Are you sure you want to unbind Telegram user ID ' + userId + ' from key ' + code + '?')) return;
      await makeApiRequest({
        action: 'unbind_user',
        keyCode: code,
        telegramUserId: userId
      });
      showToast('❌ Account unbound successfully!');
    }

    function copyKey(code) {
      navigator.clipboard.writeText(code).then(() => {
        showToast('📋 Copied to clipboard: ' + code);
      });
    }

    function renderAlerts(alerts) {
      const alertBody = document.getElementById('alerts-list-body');
      if (!alertBody) return;
      alertBody.innerHTML = '';
      if (alerts.length === 0) {
        alertBody.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 15px;">No security alerts or abuse attempts logged.</div>';
        return;
      }
      alerts.forEach(a => {
        const date = new Date(a.created_at);
        const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const userNameDisplay = a.username ? '@' + a.username : 'User';
        
        let reasonLabel = 'Attempted Login';
        let reasonClass = 'style="color: var(--warning)"';
        if (a.reason === 'LIMIT_EXCEEDED') {
          reasonLabel = 'Limit Exceeded (Extra Login)';
          reasonClass = 'style="color: var(--danger); font-weight: 600"';
        } else if (a.reason === 'DEACTIVATED_KEY_USED') {
          reasonLabel = 'Deactivated Key Attempt';
          reasonClass = 'style="color: var(--danger)"';
        } else if (a.reason === 'EXPIRED_KEY_USED') {
          reasonLabel = 'Expired Key Attempt';
          reasonClass = 'style="color: var(--warning)"';
        }

        // Look up currently bound users for the alert's key
        const keyInfo = globalKeys.find(k => k.key_code === a.key_code);
        const boundUsers = keyInfo && keyInfo.users ? keyInfo.users : [];
        let boundInfoHtml = '';
        if (boundUsers && boundUsers.length > 0) {
          const maxVal = keyInfo ? keyInfo.max_users : '?';
          const userStrings = boundUsers.map(bu => {
            const name = bu.username ? '@' + bu.username : 'User';
            return name + ' (' + bu.user_id + ')';
          }).join(', ');
          boundInfoHtml = "<div style='margin-top: 6px; font-size: 11px; color: var(--text-muted); background: rgba(0,0,0,0.15); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.03);'>🔒 <strong>Currently Bound (" + boundUsers.length + " / " + maxVal + "):</strong> " + userStrings + "</div>";
        } else {
          boundInfoHtml = "<div style='margin-top: 6px; font-size: 11px; color: var(--text-muted); background: rgba(0,0,0,0.15); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.03);'>🔒 <strong>Currently Bound:</strong> No active bindings</div>";
        }

        const div = document.createElement('div');
        div.style.cssText = 'background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; font-size: 13px; text-align: left;';
        
        const topRowHtml = "<div style='display: flex; justify-content: space-between; align-items: center; width: 100%;'>" +
          "<div>" +
            "<span style='color: var(--text-muted); font-size: 11px; display: block;'>" + timeStr + "</span>" +
            "<span style='font-weight: 500; color: #ef4444;'>" + userNameDisplay + "</span> <span style='font-family: monospace; color: var(--text-muted);'>(" + a.telegram_user_id + ")</span>" +
            "<span style='display: block; margin-top: 2px;'>Key: <span class='key-badge' style='font-size: 11px; padding: 1px 5px;'>" + a.key_code + "</span></span>" +
          "</div>" +
          "<div " + reasonClass + ">" + reasonLabel + "</div>" +
        "</div>";
        
        div.innerHTML = topRowHtml + boundInfoHtml;
        alertBody.appendChild(div);
      });
    }

    async function clearAlertsList() {
      if (!confirm(\'Are you sure you want to clear all security logs and alerts?\')) return;
      await makeApiRequest({ action: \'clear_alerts\' });
      showToast(\'🧹 Security logs cleared!\');
    }

    let currentModalKey = null;

    function showModal(keyCode) {
      const key = globalKeys.find(k => k.key_code === keyCode);
      if (!key) return;
      currentModalKey = keyCode;

      document.getElementById('modal-key-badge').innerHTML = key.key_code + ' <button class="btn-copy" onclick="event.stopPropagation(); copyKey(\'' + key.key_code + '\')" title="Copy Key">📋</button>';
      
      let statusHtml = '';
      if (key.status === 'ACTIVE') {
        statusHtml = '<span class="status-badge status-active">Active</span>';
      } else if (key.status === 'DEACTIVATED') {
        statusHtml = '<span class="status-badge status-deactivated">Disabled</span>';
      } else if (key.status === 'EXPIRED') {
        statusHtml = '<span class="status-badge status-expired">Expired</span>';
      }
      document.getElementById('modal-status').innerHTML = statusHtml;

      let expiryText = 'Lifetime (No Expiry)';
      if (key.expires_at) {
        const date = new Date(key.expires_at);
        expiryText = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }
      document.getElementById('modal-expiry').textContent = expiryText;

      const boundCount = key.users ? key.users.length : 0;
      const isFull = boundCount >= key.max_users;
      const limitColor = isFull ? 'var(--success)' : 'var(--text-muted)';
      document.getElementById('modal-limits').innerHTML = '<strong style="color: ' + limitColor + '">' + boundCount + '</strong> / ' + key.max_users + ' slots used';

      document.getElementById('modal-buyer').textContent = key.buyer_name || 'No buyer name or notes added';

      const userList = document.getElementById('modal-bound-users-list');
      userList.innerHTML = '';
      if (key.users && key.users.length > 0) {
        key.users.forEach(u => {
          const userNameDisplay = u.username ? '@' + u.username : 'User';
          
          const div = document.createElement('div');
          div.className = 'bound-user';
          div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: rgba(255, 255, 255, 0.04); border-radius: 6px;';
          div.innerHTML = '<span class="bound-user-name" style="font-weight: 500;">' + userNameDisplay + '</span>' +
                          '<div style="display: flex; align-items: center; gap: 8px;">' +
                            '<span class="bound-user-id" style="font-family: monospace; color: #818cf8; font-size: 12px;">' + u.user_id + '</span>' +
                            '<button onclick="modalUnbindUser(\'' + key.key_code + '\', \'' + u.user_id + '\')" title="Unbind Account" style="background: none; border: none; cursor: pointer; color: var(--danger); font-size: 11px; padding: 2px; display: inline-flex; align-items: center;">❌</button>' +
                          '</div>';
          userList.appendChild(div);
        });
      } else {
        userList.innerHTML = '<span style="color: var(--text-muted); font-size: 13px; text-align: center; display: block; padding: 10px;">No bound accounts found</span>';
      }

      const toggleBtn = document.getElementById('modal-btn-toggle');
      if (key.status === 'ACTIVE') {
        toggleBtn.textContent = '🔒 Disable Key';
        toggleBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      } else {
        toggleBtn.textContent = '🔓 Enable Key';
        toggleBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      }

      const overlay = document.getElementById('detail-modal-overlay');
      overlay.style.display = 'flex';
      setTimeout(() => overlay.classList.add('show'), 10);
    }

    function hideModal() {
      const overlay = document.getElementById('detail-modal-overlay');
      overlay.classList.remove('show');
      setTimeout(() => overlay.style.display = 'none', 250);
      currentModalKey = null;
    }

    function closeModal(event) {
      if (event.target.id === 'detail-modal-overlay') {
        hideModal();
      }
    }

    async function modalToggleStatus() {
      if (!currentModalKey) return;
      const key = globalKeys.find(k => k.key_code === currentModalKey);
      if (!key) return;
      const newStatus = key.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
      await toggleKey(currentModalKey, newStatus);
      showModal(currentModalKey);
    }

    async function modalDeleteKey() {
      if (!currentModalKey) return;
      const code = currentModalKey;
      hideModal();
      await deleteKey(code);
    }

    async function modalUnbindUser(code, userId) {
      await unbindUser(code, userId);
      showModal(currentModalKey);
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
    return (req.body && req.body.password) || req.headers['authorization'] || '';
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

    const { action, keyCode, maxUsers, durationDays, status, buyerName } = req.body || {};

    try {
      if (action === 'list') {
        const keys = await db.getAdminKeys();
        const alerts = await db.getAlerts();
        return res.status(200).json({ keys, alerts });
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

        await db.createKey(code, max, duration, buyerName);
        const keys = await db.getAdminKeys();
        const alerts = await db.getAlerts();
        return res.status(200).json({ success: true, keys, alerts, code });
      }

      if (action === 'toggle') {
        if (!keyCode || !status) {
          return res.status(400).json({ error: 'Missing keyCode or status' });
        }
        await db.updateKeyStatus(keyCode, status);
        const keys = await db.getAdminKeys();
        const alerts = await db.getAlerts();
        return res.status(200).json({ success: true, keys, alerts });
      }

      if (action === 'delete') {
        if (!keyCode) {
          return res.status(400).json({ error: 'Missing keyCode' });
        }
        await db.deleteKey(keyCode);
        const keys = await db.getAdminKeys();
        const alerts = await db.getAlerts();
        return res.status(200).json({ success: true, keys, alerts });
      }

      if (action === 'unbind_user') {
        const { telegramUserId } = req.body || {};
        if (!keyCode || !telegramUserId) {
          return res.status(400).json({ error: 'Missing keyCode or telegramUserId' });
        }
        await db.unbindUser(keyCode, telegramUserId);
        const keys = await db.getAdminKeys();
        const alerts = await db.getAlerts();
        return res.status(200).json({ success: true, keys, alerts });
      }

      if (action === 'clear_alerts') {
        await db.clearAlerts();
        const keys = await db.getAdminKeys();
        const alerts = await db.getAlerts();
        return res.status(200).json({ success: true, keys, alerts });
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
