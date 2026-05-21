const fs = require('fs');
const { execSync } = require('child_process');

const newCSS = `

/* ── Command Dashboard ─────────────────────────────────────── */
.command-nav-tabs {
  display: flex;
  gap: 2px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-1);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.command-nav-tabs::-webkit-scrollbar { display: none; }

/* Tab header used in all command tabs */
.tab-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}
.tab-header h2 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  color: var(--text-0);
  margin-bottom: 2px;
}
.tab-sub {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.4;
}

/* Filter row — used in Incidents, Report, Log */
.filter-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.filter-btn {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1.5px solid var(--border-med);
  background: var(--bg-1);
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.filter-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.filter-btn:hover:not(.active) {
  background: var(--bg-3);
}

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  font-family: var(--font-display);
  letter-spacing: 0.02em;
}
.badge-green { background: var(--green-dim); color: var(--green); }
.badge-red { background: var(--red-dim); color: var(--red); }
.badge-amber { background: var(--amber-dim); color: var(--amber); }
.badge-blue { background: var(--accent-dim); color: var(--accent); }
.badge-grey { background: var(--bg-3); color: var(--text-2); }

/* Stats grid — Live tab and Report tab */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
@media (min-width: 768px) {
  .stats-grid { grid-template-columns: repeat(4, 1fr); }
}
.stat-card {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}
.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  font-family: var(--font-display);
  margin-bottom: 8px;
}
.stat-value {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  color: var(--text-0);
  line-height: 1;
}
.stat-value.green { color: var(--green); }
.stat-red { color: var(--red); }
.stat-amber { color: var(--amber); }
.critical-card { border-color: var(--red); background: var(--red-dim); }

/* Loading and empty states */
.loading-state {
  padding: 40px 16px;
  text-align: center;
  color: var(--text-2);
  font-size: 14px;
}
.empty-state {
  padding: 48px 16px;
  text-align: center;
  color: var(--text-2);
}
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-state p { font-size: 14px; line-height: 1.6; }

/* Error message */
.error-msg {
  background: var(--red-dim);
  color: var(--red);
  border: 1px solid rgba(192,19,42,0.2);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 13px;
  margin-bottom: 12px;
}

/* ── Gates Tab ─────────────────────────────────────────────── */
.gates-list { display: flex; flex-direction: column; gap: 12px; }
.gate-card {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.gate-card.gate-inactive { opacity: 0.6; }
.gate-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.gate-name {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-0);
}
.gate-location {
  font-size: 12px;
  color: var(--text-2);
  display: block;
  margin-bottom: 8px;
}
.gate-url-row { margin-top: 6px; }
.gate-url {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  word-break: break-all;
  background: var(--accent-dim);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  display: block;
}
.gate-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}
.btn-copy {
  padding: 7px 14px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-copy.copied {
  background: var(--green);
  border-color: var(--green);
  color: #fff;
}
.slug-preview {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  display: block;
  margin-top: 4px;
}
.form-card { margin-bottom: 20px; }
.form-card h3 {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 14px;
}
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
@media (max-width: 480px) { .form-row { grid-template-columns: 1fr; } }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
@media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }

/* ── Incidents ─────────────────────────────────────────────── */
.incidents-list { display: flex; flex-direction: column; gap: 12px; }
.incident-card {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}
.incident-card.severity-serious { border-left: 3px solid var(--amber); }
.incident-card.severity-critical { border-left: 3px solid var(--red); background: linear-gradient(to right, var(--red-dim), var(--bg-1) 40%); }
.incident-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.incident-type {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-0);
}
.incident-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 10px;
}
.incident-description {
  font-size: 13px;
  color: var(--text-1);
  line-height: 1.5;
  margin-bottom: 10px;
}
.incident-location { font-size: 12px; color: var(--text-2); margin-bottom: 10px; }
.incident-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-amber {
  padding: 7px 14px; border-radius: var(--radius-md);
  border: none; background: var(--amber-dim); color: var(--amber);
  font-family: var(--font-display); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.btn-green {
  padding: 7px 14px; border-radius: var(--radius-md);
  border: none; background: var(--green-dim); color: var(--green);
  font-family: var(--font-display); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}

/* ── Report Tab ────────────────────────────────────────────── */
.report-content { display: flex; flex-direction: column; gap: 20px; }
.report-section h3 {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-0);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.report-table { background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
.table-header {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  padding: 10px 14px;
  background: var(--bg-3);
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-family: var(--font-display);
}
.table-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-1);
  transition: background 0.1s;
}
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: var(--bg-2); }
.text-red { color: var(--red); font-weight: 600; }
.text-green { color: var(--green); font-weight: 600; }
.dest-list { display: flex; flex-direction: column; gap: 8px; }
.dest-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.dest-name { min-width: 120px; color: var(--text-1); font-weight: 500; }
.dest-bar-wrap { flex: 1; height: 6px; background: var(--bg-3); border-radius: 3px; overflow: hidden; }
.dest-bar { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.3s; }
.dest-count { min-width: 30px; text-align: right; color: var(--text-2); font-weight: 600; }

/* ── Tenants Tab ───────────────────────────────────────────── */
.tenants-list { display: flex; flex-direction: column; gap: 10px; }
.tenant-card {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-shadow: var(--shadow-sm);
}
.tenant-card.inactive { opacity: 0.6; }
.tenant-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.tenant-name { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-0); }
.tenant-meta { font-size: 12px; color: var(--text-2); }
.tenant-actions { display: flex; gap: 6px; flex-shrink: 0; }

/* ── Officers Tab ──────────────────────────────────────────── */
.action-btns { display: flex; gap: 6px; }
.btn-xs {
  padding: 4px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-med); background: var(--bg-2);
  color: var(--text-1); font-family: var(--font-display);
  font-size: 11px; font-weight: 600; cursor: pointer;
  transition: all 0.15s;
}
.btn-xs:hover { background: var(--bg-3); }
.tenant-filter {
  padding: 7px 12px; border-radius: var(--radius-md);
  border: 1.5px solid var(--border-med); background: var(--bg-1);
  color: var(--text-0); font-family: var(--font-body);
  font-size: 13px; cursor: pointer;
}

/* ── Admin App ─────────────────────────────────────────────── */
.admin-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #0f1923 0%, #1a2940 100%);
  padding: 24px;
}
.admin-login-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-lg);
  padding: 40px 32px;
  width: 100%;
  max-width: 380px;
  text-align: center;
  backdrop-filter: blur(10px);
}
.admin-login-card h1 {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  margin-bottom: 4px;
}
.admin-login-card p {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 24px;
}
.admin-login-card input {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: var(--radius-md);
  color: #fff;
  font-size: 14px;
  font-family: var(--font-body);
  margin-bottom: 12px;
  text-align: center;
  letter-spacing: 0.1em;
}
.admin-login-card input::placeholder { color: rgba(255,255,255,0.3); }
.admin-login-card input:focus { outline: none; border-color: var(--accent); }
.admin-app {
  min-height: 100vh;
  background: var(--bg-0);
  display: flex;
  flex-direction: column;
}
.admin-header {
  background: #0f1923;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.admin-title { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: #fff; }
.admin-sub { font-size: 12px; color: rgba(255,255,255,0.4); }
.admin-nav {
  display: flex;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  padding: 0 16px;
  gap: 2px;
}
.admin-main { flex: 1; padding: 20px; overflow-y: auto; }
.overview-tab h2, .tenants-tab h2, .officers-tab h2, .incidents-tab h2, .settings-tab h2 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 16px;
}
.overview-tab h3, .settings-tab h3 {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  margin: 16px 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-2);
}
.settings-tab .card { margin-bottom: 12px; }
.settings-tab .card h3 { color: var(--text-0); text-transform: none; letter-spacing: 0; margin-top: 0; }
.settings-tab .card p { font-size: 13px; color: var(--text-2); margin-top: 6px; }

/* ── Gate PWA Bottom Nav ────────────────────────────────────── */
.gate-nav {
  display: flex;
  background: var(--bg-1);
  border-top: 1px solid var(--border);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 50;
  box-shadow: 0 -2px 12px rgba(0,0,0,0.06);
}
.gate-nav-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 4px 8px;
  background: none;
  border: none;
  border-top: 2px solid transparent;
  cursor: pointer;
  color: var(--text-2);
  font-family: var(--font-display);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: color 0.15s;
}
.gate-nav-btn.active {
  color: var(--accent);
  border-top-color: var(--accent);
}
.gate-nav-btn.incident-tab.active {
  color: var(--red);
  border-top-color: var(--red);
}
.nav-icon { font-size: 16px; line-height: 1; }
.gate-header {
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 40;
  box-shadow: var(--shadow-sm);
}
.gate-tenant-name { font-family: var(--font-display); font-size: 14px; font-weight: 700; color: var(--text-0); }
.gate-name-display { font-size: 12px; color: var(--text-2); }
.gate-main { flex: 1; overflow-y: auto; padding-bottom: 70px; }
.gate-loading, .gate-error {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-0);
  gap: 8px;
}
.gate-loading p { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--text-2); }
.gate-error h2 { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--red); }
.gate-error p { font-size: 14px; color: var(--text-2); }

/* ── Gate Log Page ─────────────────────────────────────────── */
.gate-log-page { padding: 16px; padding-bottom: 80px; }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.page-header h2 { font-family: var(--font-display); font-size: 18px; font-weight: 700; flex: 1; }
.page-header p { font-size: 12px; color: var(--text-2); }
.btn-back {
  background: none; border: none; color: var(--accent);
  font-family: var(--font-display); font-size: 13px; font-weight: 600;
  cursor: pointer; padding: 4px 0; flex-shrink: 0;
}
.period-toggle { display: flex; gap: 6px; margin-bottom: 14px; }
.period-btn {
  padding: 7px 16px; border-radius: 20px;
  border: 1.5px solid var(--border-med); background: var(--bg-1);
  color: var(--text-2); font-family: var(--font-display);
  font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.period-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.log-summary {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 8px; margin-bottom: 14px;
}
.log-stat {
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: 12px; text-align: center;
}
.log-stat-value { display: block; font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--text-0); }
.log-stat-value.green { color: var(--green); }
.log-stat-value.red { color: var(--red); }
.log-stat-label { display: block; font-size: 10px; font-weight: 600; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
.log-list { display: flex; flex-direction: column; gap: 8px; }
.log-entry {
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: 12px;
}
.log-entry.flagged { border-left: 3px solid var(--red); background: linear-gradient(to right, var(--red-dim), var(--bg-1) 30%); }
.log-entry.inside { border-left: 3px solid var(--green); }
.log-entry-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
.log-entry-id { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--text-0); }
.flag-indicator { color: var(--red); font-size: 11px; font-weight: 700; }
.log-entry-time { font-size: 12px; color: var(--text-2); }
.log-date { color: var(--text-2); }
.log-entry-details { font-size: 12px; color: var(--text-2); margin-bottom: 6px; }
.log-entry-footer { display: flex; justify-content: space-between; font-size: 11px; }
.log-status { font-weight: 600; }
.log-status.inside { color: var(--green); }
.log-status.exited { color: var(--text-2); }
.log-officer { color: var(--text-2); }

/* ── Report Incident Page ──────────────────────────────────── */
.report-incident-page { padding: 16px; padding-bottom: 100px; }
.form-section { margin-bottom: 20px; }
.form-section label {
  display: block; font-size: 11px; font-weight: 600;
  color: var(--text-2); text-transform: uppercase;
  letter-spacing: 0.07em; font-family: var(--font-display);
  margin-bottom: 10px;
}
.type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.type-btn {
  padding: 12px; border-radius: var(--radius-md);
  border: 1.5px solid var(--border-med); background: var(--bg-1);
  color: var(--text-1); font-family: var(--font-display);
  font-size: 12px; font-weight: 600; cursor: pointer;
  text-align: left; transition: all 0.15s; line-height: 1.3;
}
.type-btn.selected { border-color: var(--accent); background: var(--accent-dim); color: var(--accent); }
.type-btn:hover:not(.selected) { background: var(--bg-2); }
.severity-grid { display: flex; flex-direction: column; gap: 8px; }
.severity-btn {
  padding: 14px; border-radius: var(--radius-md);
  border: 1.5px solid var(--border-med); background: var(--bg-1);
  cursor: pointer; text-align: left; transition: all 0.15s;
  display: flex; flex-direction: column; gap: 2px;
}
.severity-btn .severity-label { font-family: var(--font-display); font-size: 14px; font-weight: 700; }
.severity-btn .severity-desc { font-size: 12px; color: var(--text-2); }
.btn-submit-incident {
  width: 100%; padding: 16px; border-radius: var(--radius-lg);
  border: none; background: var(--accent); color: #fff;
  font-family: var(--font-display); font-size: 15px; font-weight: 700;
  cursor: pointer; transition: all 0.15s;
  box-shadow: 0 4px 12px rgba(26,86,219,0.3);
}
.btn-submit-incident.critical {
  background: var(--red);
  box-shadow: 0 4px 12px rgba(192,19,42,0.3);
  animation: pulse-red 2s infinite;
}
.incident-submitted {
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
}
.incident-submitted h2 { font-family: var(--font-display); font-size: 22px; font-weight: 700; }
.incident-submitted p { font-size: 14px; color: var(--text-2); }
.submitted-icon {
  width: 72px; height: 72px; border-radius: 50%;
  background: var(--green); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 32px; font-weight: 700;
  box-shadow: 0 4px 20px rgba(14,124,58,0.3);
}
.critical-notice {
  background: var(--red-dim); color: var(--red);
  border: 1px solid rgba(192,19,42,0.2);
  border-radius: var(--radius-md);
  padding: 12px 16px; font-size: 13px; font-weight: 600;
  width: 100%;
}
.full-width { width: 100%; }

/* ── Nav badge ─────────────────────────────────────────────── */
.nav-badge {
  position: absolute; top: -4px; right: -4px;
  background: var(--red); color: #fff;
  border-radius: 10px; font-size: 10px;
  padding: 1px 5px; font-weight: 700;
  font-family: var(--font-display);
}
.nav-badge-red { background: var(--red); }
`;

// Append to existing CSS
const existing = fs.readFileSync('src/index.css', 'utf8');
fs.writeFileSync('src/index.css', existing + newCSS, 'utf8');
console.log('CSS added — ' + newCSS.length + ' characters');

execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -m "Add complete CSS for all new components - premium styling"', { stdio: 'inherit' });
execSync('git push origin main', { stdio: 'inherit' });
console.log('Done. Netlify deploying...');
