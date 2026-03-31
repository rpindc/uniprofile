import { useState, useEffect, useRef } from "react";

// ── MOCK DATA ──────────────────────────────────────────────────────────────
const MOCK_UUID = "01926a3f-7c2e-7000-8b1d-4e9f2a0d5c8b";
const MOCK_PASSENGER = {
  uuid: MOCK_UUID,
  firstName: "Rommel",
  lastName: "Santos",
  email: "rommel@uniworld.io",
  phone: "+1 571 555 0192",
  nationality: "PHL",
  passportNo: "P12345678",
  passportExpiry: "2030-04-15",
  dob: "1985-03-22",
  context: "bleisure",
  biometricStatus: { frt: "enrolled", fido2: "enrolled", nfc: "pending" },
  preferences: {
    seat: "Window, front third",
    meal: "Asian vegetarian",
    cabin: "Business",
    lounge: true,
    contactMethod: "App push",
  },
};

const MOCK_ORDERS = [
  { id: "ORD-20240312-001", route: "IAD → DXB → SIN", airline: "Emirates", status: "confirmed", date: "2024-06-15", pnr: "EK7X4M", value: "$3,420", type: "business" },
  { id: "ORD-20240410-002", route: "SIN → NRT", airline: "Singapore Airlines", status: "ticketed", date: "2024-07-01", pnr: "SQ9KL2", value: "$1,180", type: "leisure" },
  { id: "ORD-20240502-003", route: "NRT → IAD", airline: "ANA", status: "pending", date: "2024-07-14", pnr: "NH3PQ7", value: "$2,650", type: "business" },
];

const MOCK_ANCILLARIES = [
  { type: "Seat", detail: "14A Window — Business", order: "ORD-20240312-001", status: "confirmed", price: "Included" },
  { type: "Lounge", detail: "Emirates Business Lounge DXB", order: "ORD-20240312-001", status: "confirmed", price: "$0" },
  { type: "Meal", detail: "Asian Vegetarian (AVML)", order: "ORD-20240312-001", status: "confirmed", price: "$0" },
  { type: "Extra Baggage", detail: "+23kg checked", order: "ORD-20240410-002", status: "confirmed", price: "$85" },
  { type: "Fast Track", detail: "Changi T3 Priority", order: "ORD-20240410-002", status: "available", price: "$24" },
];

const MOCK_DISRUPTIONS = [
  { id: "DIS-20240312-01", orderId: "ORD-20240312-001", type: "Delay", severity: "moderate", original: "EK521 06:20 DXB", new: "EK521 09:45 DXB", action: "Connection protected", compensation: "$150 voucher", resolved: true },
];

const MOCK_LOYALTY = [
  { program: "Emirates Skywards", tier: "Gold", number: "EK-9872341", miles: 124800, expiry: "2025-12-31" },
  { program: "Singapore KrisFlyer", tier: "PPS Club", number: "SQ-4519823", miles: 76200, expiry: "2025-06-30" },
  { program: "ANA Mileage Club", tier: "Platinum", number: "NH-2341097", miles: 34500, expiry: "2025-03-31" },
];

const MOCK_BAGS = [
  { tagId: "AC847291", flight: "EK521", route: "IAD→DXB", status: "In-flight", lastSeen: "DXB Baggage Hall 2", timestamp: "2024-06-15 14:22 GST", resolved: false },
  { tagId: "AC847292", flight: "EK521", route: "IAD→DXB", status: "Delivered", lastSeen: "Belt 7, DXB T3", timestamp: "2024-06-15 15:40 GST", resolved: true },
];

const MOCK_PAYMENT = {
  wallet: [
    { type: "Visa", last4: "4821", expiry: "09/27", default: true, token: "tok_4821_bsp" },
    { type: "Mastercard", last4: "9034", expiry: "03/26", default: false, token: "tok_9034_bsp" },
  ],
  transactions: [
    { ref: "TXN-EK7X4M", desc: "Emirates IAD-DXB-SIN Business", amount: "$3,420.00", date: "2024-05-12", status: "settled" },
    { ref: "TXN-SQ9KL2", desc: "Singapore Airlines SIN-NRT", amount: "$1,180.00", date: "2024-05-28", status: "settled" },
    { ref: "TXN-BGTXN01", desc: "Extra baggage SQ9KL2", amount: "$85.00", date: "2024-05-28", status: "settled" },
  ],
};

const MOCK_CONSENT = [
  { org: "Emirates Airlines", scope: "Profile, loyalty, meal preferences", granted: "2024-01-15", status: "active" },
  { org: "Amex GBT (Corporate)", scope: "Full bleisure profile, trip history", granted: "2024-02-01", status: "active" },
  { org: "Singapore Airlines", scope: "Profile, seat preference", granted: "2024-03-10", status: "active" },
  { org: "Changi Airport", scope: "Biometric (FRT) for border", granted: "2024-05-01", status: "active" },
  { org: "Sabre GDS", scope: "PNR enrichment, preferences", granted: "2023-11-20", status: "revoked" },
];

// ── COLOUR TOKENS ──────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

  :root {
    --ink: #0a0d14;
    --ink2: #141824;
    --ink3: #1e2433;
    --border: rgba(255,255,255,0.08);
    --border2: rgba(255,255,255,0.14);
    --text: #e8eaf0;
    --muted: #7a8099;
    --accent: #5b8dee;
    --accent2: #3dd68c;
    --warn: #f5a623;
    --danger: #e85d5d;
    --purple: #a78bfa;
    --mono: 'DM Mono', monospace;
    --sans: 'DM Sans', sans-serif;
    --display: 'Syne', sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--ink);
    color: var(--text);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.6;
    min-height: 100vh;
  }

  .app {
    display: flex;
    min-height: 100vh;
    background: var(--ink);
  }

  /* ── SIDEBAR ── */
  .sidebar {
    width: 220px;
    min-width: 220px;
    background: var(--ink2);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 0;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow: hidden;
  }

  .sidebar-logo {
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--border);
  }

  .sidebar-logo-mark {
    font-family: var(--display);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: var(--text);
  }

  .sidebar-logo-mark span { color: var(--accent); }

  .sidebar-logo-sub {
    font-size: 10px;
    color: var(--muted);
    font-family: var(--mono);
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-top: 2px;
  }

  .uuid-chip {
    margin: 12px 16px;
    padding: 8px 10px;
    background: var(--ink3);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .uuid-label {
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--muted);
    font-family: var(--mono);
  }

  .uuid-value {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--accent);
    word-break: break-all;
    margin-top: 2px;
    opacity: 0.85;
  }

  .context-toggle {
    margin: 0 16px 12px;
    display: flex;
    background: var(--ink3);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .ctx-btn {
    flex: 1;
    padding: 6px 4px;
    font-size: 11px;
    font-family: var(--mono);
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
  }

  .ctx-btn.active {
    background: var(--ink2);
    color: var(--accent2);
    border-radius: 6px;
  }

  .nav-section-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--muted);
    font-family: var(--mono);
    padding: 12px 20px 6px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 20px;
    cursor: pointer;
    border-left: 2px solid transparent;
    transition: all 0.12s;
    font-size: 13px;
    color: var(--muted);
  }

  .nav-item:hover { background: var(--ink3); color: var(--text); }

  .nav-item.active {
    background: rgba(91,141,238,0.1);
    border-left-color: var(--accent);
    color: var(--text);
  }

  .nav-icon {
    width: 16px;
    height: 16px;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .nav-item.active .nav-icon { opacity: 1; }

  .sidebar-footer {
    margin-top: auto;
    padding: 16px;
    border-top: 1px solid var(--border);
  }

  .biometric-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .bio-badge {
    font-size: 9px;
    font-family: var(--mono);
    padding: 3px 7px;
    border-radius: 4px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .bio-enrolled { background: rgba(61,214,140,0.15); color: var(--accent2); border: 1px solid rgba(61,214,140,0.3); }
  .bio-pending  { background: rgba(245,166,35,0.12); color: var(--warn); border: 1px solid rgba(245,166,35,0.25); }

  /* ── MAIN CONTENT ── */
  .main {
    flex: 1;
    overflow-y: auto;
    padding: 28px 32px;
    max-width: 1100px;
  }

  .page-header {
    margin-bottom: 24px;
  }

  .page-title {
    font-family: var(--display);
    font-size: 26px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: -0.5px;
  }

  .page-sub {
    font-size: 13px;
    color: var(--muted);
    margin-top: 4px;
  }

  /* ── CARDS ── */
  .card {
    background: var(--ink2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }

  .card-sm { padding: 14px 18px; border-radius: 10px; }

  .card-title {
    font-family: var(--display);
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--muted);
    margin-bottom: 14px;
  }

  /* ── GRID ── */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }

  /* ── STAT CARD ── */
  .stat-card {
    background: var(--ink3);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
  }

  .stat-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--muted);
    font-family: var(--mono);
  }

  .stat-value {
    font-family: var(--display);
    font-size: 28px;
    font-weight: 700;
    color: var(--text);
    line-height: 1.1;
    margin-top: 4px;
  }

  .stat-value.accent { color: var(--accent); }
  .stat-value.green  { color: var(--accent2); }
  .stat-value.warn   { color: var(--warn); }

  .stat-sub { font-size: 11px; color: var(--muted); margin-top: 4px; }

  /* ── TABLE ── */
  .table { width: 100%; border-collapse: collapse; }

  .table th {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--muted);
    font-family: var(--mono);
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .table td {
    padding: 11px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-size: 13px;
    vertical-align: middle;
  }

  .table tr:last-child td { border-bottom: none; }

  /* ── BADGE ── */
  .badge {
    display: inline-block;
    font-size: 10px;
    font-family: var(--mono);
    padding: 3px 8px;
    border-radius: 5px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-green  { background: rgba(61,214,140,0.12); color: var(--accent2); border: 1px solid rgba(61,214,140,0.25); }
  .badge-blue   { background: rgba(91,141,238,0.12); color: var(--accent); border: 1px solid rgba(91,141,238,0.25); }
  .badge-warn   { background: rgba(245,166,35,0.12); color: var(--warn); border: 1px solid rgba(245,166,35,0.25); }
  .badge-danger { background: rgba(232,93,93,0.12); color: var(--danger); border: 1px solid rgba(232,93,93,0.25); }
  .badge-purple { background: rgba(167,139,250,0.12); color: var(--purple); border: 1px solid rgba(167,139,250,0.25); }
  .badge-muted  { background: rgba(255,255,255,0.05); color: var(--muted); border: 1px solid var(--border); }

  /* ── BUTTON ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--border2);
    background: transparent;
    color: var(--text);
    font-size: 12px;
    font-family: var(--mono);
    cursor: pointer;
    transition: all 0.12s;
    letter-spacing: 0.5px;
  }

  .btn:hover { background: var(--ink3); border-color: var(--accent); }

  .btn-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    font-weight: 500;
  }

  .btn-primary:hover { background: #4a7de0; }

  .btn-danger { border-color: var(--danger); color: var(--danger); }
  .btn-danger:hover { background: rgba(232,93,93,0.1); }

  /* ── INPUT ── */
  .input {
    background: var(--ink3);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: var(--sans);
    font-size: 13px;
    padding: 8px 12px;
    width: 100%;
    outline: none;
    transition: border-color 0.12s;
  }

  .input:focus { border-color: var(--accent); }

  /* ── FIELD ROW ── */
  .field-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .field-row:last-child { border-bottom: none; }

  .field-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--muted);
    font-family: var(--mono);
  }

  .field-value {
    font-size: 13px;
    color: var(--text);
    text-align: right;
    font-family: var(--mono);
  }

  /* ── PROGRESS BAR ── */
  .progress-bar {
    height: 4px;
    border-radius: 2px;
    background: var(--ink3);
    overflow: hidden;
    margin-top: 6px;
  }

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  /* ── DISRUPTION BANNER ── */
  .disruption-banner {
    background: rgba(232,93,93,0.08);
    border: 1px solid rgba(232,93,93,0.25);
    border-radius: 10px;
    padding: 14px 18px;
    margin-bottom: 16px;
  }

  /* ── CONSENT ROW ── */
  .consent-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    gap: 12px;
  }

  .consent-row:last-child { border-bottom: none; }

  /* ── TOGGLE ── */
  .toggle {
    width: 38px;
    height: 22px;
    border-radius: 11px;
    border: none;
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .toggle::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    top: 3px;
    transition: left 0.2s;
  }

  .toggle.on { background: var(--accent2); }
  .toggle.on::after { left: 18px; }
  .toggle.off { background: var(--muted); }
  .toggle.off::after { left: 3px; }

  /* ── BAG STATUS ── */
  .bag-track {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
  }

  .bag-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── SCANNER MOCK ── */
  .scanner-box {
    background: var(--ink3);
    border: 1px dashed var(--border2);
    border-radius: 12px;
    padding: 32px;
    text-align: center;
  }

  .scanner-icon {
    font-size: 40px;
    margin-bottom: 12px;
    opacity: 0.6;
  }

  .pulse-ring {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 2px solid var(--accent);
    margin: 0 auto 12px;
    animation: pulse 2s ease-in-out infinite;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.8; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(1.08); }
  }
`;

// ── ICONS (SVG inline) ────────────────────────────────────────────────────
const Icon = ({ name }) => {
  const icons = {
    home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>,
    order: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h7M7 16h5"/></svg>,
    seat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 2v10a2 2 0 002 2h8a2 2 0 002-2V2"/><path d="M4 22h16M8 12v5M16 12v5"/></svg>,
    disruption: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2L2 19h20L12 2z"/><path d="M12 9v5M12 17v1"/></svg>,
    loyalty: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>,
    payment: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
    bag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73L13 2.27a2 2 0 00-2 0L4 6.27A2 2 0 003 8v8a2 2 0 001 1.73L11 21.73a2 2 0 002 0L20 17.73a2 2 0 001-1.73z"/></svg>,
    bio: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20v-1a4 4 0 014-4h8a4 4 0 014 4v1"/><path d="M17 3.34A10 10 0 019.37 21"/></svg>,
    consent: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  };
  return <span className="nav-icon" style={{ display:"inline-flex", alignItems:"center" }}>{icons[name] || null}</span>;
};

// ── DASHBOARD ─────────────────────────────────────────────────────────────
function Dashboard({ passenger }) {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Welcome, {passenger.firstName}</div>
        <div className="page-sub">Passenger Identity Dashboard · IATA OneOrder Active</div>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Active Orders</div>
          <div className="stat-value accent">3</div>
          <div className="stat-sub">2 business · 1 leisure</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Miles</div>
          <div className="stat-value green">235K</div>
          <div className="stat-sub">Across 3 programs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Disruptions</div>
          <div className="stat-value warn">1</div>
          <div className="stat-sub">Resolved · EK521</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Consent Grants</div>
          <div className="stat-value">4</div>
          <div className="stat-sub">1 revoked</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Traveller Identity</div>
          <div className="field-row"><span className="field-label">UUID v7</span><span className="field-value" style={{ fontSize:10, color:"var(--accent)", maxWidth:180, wordBreak:"break-all" }}>{MOCK_UUID}</span></div>
          <div className="field-row"><span className="field-label">Context</span><span><span className="badge badge-purple">Bleisure</span></span></div>
          <div className="field-row"><span className="field-label">Passport</span><span className="field-value">P12345678 · PHL</span></div>
          <div className="field-row"><span className="field-label">Expiry</span><span className="field-value">15 Apr 2030</span></div>
          <div className="field-row"><span className="field-label">Biometrics</span>
            <span style={{ display:"flex", gap:4 }}>
              <span className="badge badge-green">FRT</span>
              <span className="badge badge-green">FIDO2</span>
              <span className="badge badge-warn">NFC</span>
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Travel Preferences</div>
          <div className="field-row"><span className="field-label">Seat</span><span className="field-value">Window, front third</span></div>
          <div className="field-row"><span className="field-label">Meal</span><span className="field-value">AVML</span></div>
          <div className="field-row"><span className="field-label">Cabin</span><span className="field-value">Business</span></div>
          <div className="field-row"><span className="field-label">Lounge Access</span><span className="field-value">Yes</span></div>
          <div className="field-row"><span className="field-label">Contact</span><span className="field-value">App push</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Upcoming Itinerary</div>
        <table className="table">
          <thead><tr><th>Order ID</th><th>Route</th><th>Date</th><th>PNR</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            {MOCK_ORDERS.map(o => (
              <tr key={o.id}>
                <td style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--accent)" }}>{o.id}</td>
                <td>{o.route}</td>
                <td style={{ fontFamily:"var(--mono)", fontSize:11 }}>{o.date}</td>
                <td style={{ fontFamily:"var(--mono)", color:"var(--purple)" }}>{o.pnr}</td>
                <td><span className={`badge ${o.type==="business" ? "badge-blue" : "badge-green"}`}>{o.type}</span></td>
                <td><span className={`badge ${o.status==="confirmed"?"badge-green":o.status==="ticketed"?"badge-blue":"badge-warn"}`}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── OFFER & ORDER ─────────────────────────────────────────────────────────
function OfferOrder() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Offer &amp; Order Management</div>
        <div className="page-sub">IATA OneOrder · NDC-compatible · UUID-linked orders</div>
      </div>
      <div className="grid-4" style={{ marginBottom:16 }}>
        <div className="stat-card"><div className="stat-label">Orders</div><div className="stat-value accent">3</div></div>
        <div className="stat-card"><div className="stat-label">Total Value</div><div className="stat-value green">$7,250</div></div>
        <div className="stat-card"><div className="stat-label">Segments</div><div className="stat-value">6</div></div>
        <div className="stat-card"><div className="stat-label">NDC Level</div><div className="stat-value" style={{ fontSize:18 }}>4</div></div>
      </div>
      <div className="card">
        <div className="card-title">Active OneOrders</div>
        <table className="table">
          <thead><tr><th>Order ID</th><th>Airline</th><th>Route</th><th>Date</th><th>PNR</th><th>Value</th><th>Status</th><th>Context</th></tr></thead>
          <tbody>
            {MOCK_ORDERS.map(o => (
              <tr key={o.id}>
                <td style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--accent)" }}>{o.id}</td>
                <td>{o.airline}</td>
                <td style={{ fontSize:12 }}>{o.route}</td>
                <td style={{ fontFamily:"var(--mono)", fontSize:11 }}>{o.date}</td>
                <td style={{ fontFamily:"var(--mono)", color:"var(--purple)" }}>{o.pnr}</td>
                <td style={{ fontFamily:"var(--mono)" }}>{o.value}</td>
                <td><span className={`badge ${o.status==="confirmed"?"badge-green":o.status==="ticketed"?"badge-blue":"badge-warn"}`}>{o.status}</span></td>
                <td><span className={`badge ${o.type==="business"?"badge-blue":"badge-green"}`}>{o.type}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title">NDC Offer Schema Preview</div>
        <pre style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--accent2)", background:"var(--ink3)", padding:16, borderRadius:8, overflow:"auto", lineHeight:1.6 }}>
{`{
  "offerId": "NDC-EK-${MOCK_UUID.slice(0,8)}",
  "passengerUUID": "${MOCK_UUID}",
  "context": "bleisure",
  "offers": [{
    "offerItemId": "OI-001",
    "serviceDefinitionId": "EK521-BUS",
    "cabin": "BUSINESS",
    "price": { "total": "3420.00", "currency": "USD" },
    "fareRules": "SEMI_FLEX",
    "ancillaries": ["SEAT_14A", "AVML", "LOUNGE_DXB"]
  }]
}`}
        </pre>
      </div>
    </div>
  );
}

// ── SEAT & ANCILLARY ──────────────────────────────────────────────────────
function SeatAncillary() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Seat &amp; Ancillary Services</div>
        <div className="page-sub">EMD-S · IATA PADIS · Personalised upsell engine</div>
      </div>
      <div className="card">
        <div className="card-title">Ancillary Services</div>
        <table className="table">
          <thead><tr><th>Type</th><th>Detail</th><th>Order</th><th>Price</th><th>Status</th></tr></thead>
          <tbody>
            {MOCK_ANCILLARIES.map((a, i) => (
              <tr key={i}>
                <td><span className="badge badge-purple">{a.type}</span></td>
                <td style={{ fontSize:12 }}>{a.detail}</td>
                <td style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--accent)" }}>{a.order}</td>
                <td style={{ fontFamily:"var(--mono)" }}>{a.price}</td>
                <td><span className={`badge ${a.status==="confirmed"?"badge-green":"badge-warn"}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title">Seat Map — EK521 Business (A380 Upper Deck)</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8, maxWidth:400 }}>
          {["12A","12C","12D","12F","13A","13C","13D","13F","14A","14C","14D","14F","15A","15C","15D","15F"].map(s => (
            <div key={s} style={{
              background: s==="14A" ? "var(--accent)" : s==="15A"||s==="15C" ? "rgba(232,93,93,0.2)" : "var(--ink3)",
              border: `1px solid ${s==="14A"?"var(--accent)":"var(--border)"}`,
              borderRadius:6, padding:"8px 4px", textAlign:"center",
              fontFamily:"var(--mono)", fontSize:11,
              color: s==="14A" ? "#fff" : s==="15A"||s==="15C" ? "var(--danger)" : "var(--muted)"
            }}>
              {s}
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:12, marginTop:12, fontSize:11, color:"var(--muted)" }}>
          <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:"var(--accent)", display:"inline-block" }}></span> Your seat</span>
          <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:"rgba(232,93,93,0.2)", display:"inline-block" }}></span> Occupied</span>
          <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:"var(--ink3)", display:"inline-block" }}></span> Available</span>
        </div>
      </div>
    </div>
  );
}

// ── DISRUPTION ────────────────────────────────────────────────────────────
function Disruption() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Disruption &amp; Reprotection</div>
        <div className="page-sub">Chaos recovery · EU261 · DOT 14 CFR 250 · Compensation engine</div>
      </div>
      {MOCK_DISRUPTIONS.map(d => (
        <div key={d.id} className="disruption-banner">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontFamily:"var(--display)", fontWeight:600, marginBottom:6 }}>
                <span style={{ color:"var(--danger)" }}>⚠ </span>{d.type} — {d.orderId}
              </div>
              <div style={{ fontSize:12, color:"var(--muted)", marginBottom:6 }}>
                Original: <span style={{ color:"var(--text)", fontFamily:"var(--mono)" }}>{d.original}</span>
                &nbsp;→ New: <span style={{ color:"var(--warn)", fontFamily:"var(--mono)" }}>{d.new}</span>
              </div>
              <div style={{ fontSize:12, color:"var(--muted)" }}>
                Action: <span style={{ color:"var(--accent2)" }}>{d.action}</span>
                &nbsp;· Compensation: <span style={{ color:"var(--accent)" }}>{d.compensation}</span>
              </div>
            </div>
            <span className="badge badge-green">Resolved</span>
          </div>
        </div>
      ))}
      <div className="card">
        <div className="card-title">Reprotection Logic</div>
        <div style={{ display:"flex", gap:0, alignItems:"stretch" }}>
          {["Detect disruption","Assess rebooking options","Apply passenger prefs","Execute reprotection","Notify + compensate"].map((s, i) => (
            <div key={i} style={{ flex:1, textAlign:"center", position:"relative" }}>
              <div style={{
                background: i < 4 ? "rgba(91,141,238,0.15)" : "rgba(61,214,140,0.15)",
                border: `1px solid ${i < 4 ? "rgba(91,141,238,0.3)" : "rgba(61,214,140,0.3)"}`,
                borderRadius:8, padding:"12px 8px", margin:"0 4px", fontSize:11,
                color: i < 4 ? "var(--accent)" : "var(--accent2)"
              }}>
                <div style={{ fontFamily:"var(--mono)", fontSize:9, opacity:0.6, marginBottom:4 }}>STEP {i+1}</div>
                {s}
              </div>
              {i < 4 && <div style={{ position:"absolute", right:-4, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", fontSize:14, zIndex:1 }}>›</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── LOYALTY ───────────────────────────────────────────────────────────────
function Loyalty() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Loyalty &amp; Recognition</div>
        <div className="page-sub">FFP aggregation · Real-time status · UUID-linked rewards</div>
      </div>
      <div className="grid-3" style={{ marginBottom:16 }}>
        {MOCK_LOYALTY.map((l, i) => (
          <div key={i} className="card card-sm">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div style={{ fontFamily:"var(--display)", fontWeight:600, fontSize:14 }}>{l.program}</div>
              <span className={`badge ${l.tier==="PPS Club"?"badge-purple":l.tier==="Gold"?"badge-warn":"badge-blue"}`}>{l.tier}</span>
            </div>
            <div className="field-row"><span className="field-label">Number</span><span className="field-value" style={{ fontSize:11 }}>{l.number}</span></div>
            <div className="field-row"><span className="field-label">Miles</span><span className="field-value" style={{ color:"var(--accent2)" }}>{l.miles.toLocaleString()}</span></div>
            <div className="field-row"><span className="field-label">Expiry</span><span className="field-value">{l.expiry}</span></div>
            <div className="progress-bar" style={{ marginTop:10 }}>
              <div className="progress-fill" style={{ width:`${Math.min(100,(l.miles/150000)*100).toFixed(0)}%`, background:"var(--accent)" }}></div>
            </div>
            <div style={{ fontSize:10, color:"var(--muted)", marginTop:4, fontFamily:"var(--mono)" }}>
              {Math.min(100,(l.miles/150000)*100).toFixed(0)}% to next tier
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-title">Total Miles Summary</div>
        <div className="grid-3">
          <div className="stat-card"><div className="stat-label">Total Miles</div><div className="stat-value green" style={{ fontSize:22 }}>235,500</div></div>
          <div className="stat-card"><div className="stat-label">Est. Value</div><div className="stat-value accent" style={{ fontSize:22 }}>$3,532</div></div>
          <div className="stat-card"><div className="stat-label">Programs</div><div className="stat-value" style={{ fontSize:22 }}>3</div></div>
        </div>
      </div>
    </div>
  );
}

// ── PAYMENT ───────────────────────────────────────────────────────────────
function Payment() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Payment &amp; Settlement</div>
        <div className="page-sub">IATA PAX · BSP tokenisation · PCI-DSS compliant</div>
      </div>
      <div className="grid-2" style={{ marginBottom:16 }}>
        {MOCK_PAYMENT.wallet.map((c, i) => (
          <div key={i} className="card" style={{ background:"var(--ink3)", border:`1px solid ${c.default?"var(--accent)":"var(--border)"}`, position:"relative" }}>
            {c.default && <span className="badge badge-blue" style={{ position:"absolute", top:14, right:14 }}>Default</span>}
            <div style={{ fontFamily:"var(--display)", fontWeight:700, fontSize:18, marginBottom:12 }}>{c.type}</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:20, letterSpacing:4, color:"var(--text)", marginBottom:10 }}>
              •••• •••• •••• {c.last4}
            </div>
            <div className="field-row">
              <span className="field-label">Expiry</span>
              <span className="field-value">{c.expiry}</span>
            </div>
            <div className="field-row">
              <span className="field-label">BSP Token</span>
              <span className="field-value" style={{ fontSize:10, color:"var(--muted)" }}>{c.token}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-title">Transaction History</div>
        <table className="table">
          <thead><tr><th>Ref</th><th>Description</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            {MOCK_PAYMENT.transactions.map((t, i) => (
              <tr key={i}>
                <td style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--accent)" }}>{t.ref}</td>
                <td style={{ fontSize:12 }}>{t.desc}</td>
                <td style={{ fontFamily:"var(--mono)", color:"var(--accent2)" }}>{t.amount}</td>
                <td style={{ fontFamily:"var(--mono)", fontSize:11 }}>{t.date}</td>
                <td><span className="badge badge-green">{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── BAGGAGE ───────────────────────────────────────────────────────────────
function Baggage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">BagJourney Tracking</div>
        <div className="page-sub">IATA Resolution 753 · RFID real-time · WorldTracer linked</div>
      </div>
      {MOCK_BAGS.map((b, i) => (
        <div key={i} className="card">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div>
              <div style={{ fontFamily:"var(--display)", fontWeight:600 }}>Tag #{b.tagId}</div>
              <div style={{ fontSize:12, color:"var(--muted)" }}>{b.flight} · {b.route}</div>
            </div>
            <span className={`badge ${b.resolved?"badge-green":"badge-blue"}`}>{b.status}</span>
          </div>
          <div className="bag-track">
            <div className="bag-dot" style={{ background: b.resolved ? "var(--accent2)" : "var(--accent)" }}></div>
            <div>
              <div style={{ fontSize:13 }}>{b.lastSeen}</div>
              <div style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--mono)" }}>{b.timestamp}</div>
            </div>
          </div>
        </div>
      ))}
      <div className="card">
        <div className="card-title">RFID Journey Timeline</div>
        <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
          {["Check-in IAD T2 — Bag tagged & inducted","TSA Security scan — Cleared","Loaded onto EK521 at Gate B32","Offloaded DXB T3 — Baggage Hall 2","Belt 7 delivery — Collected"].map((s, i) => (
            <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", paddingBottom:16, position:"relative" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background: i < 4 ? "var(--accent2)" : "var(--ink3)", border:`2px solid ${i < 4 ? "var(--accent2)" : "var(--border)"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {i < 4 && <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--ink)" }}></div>}
                </div>
                {i < 4 && <div style={{ width:1, flex:1, background:"var(--border)", marginTop:4, minHeight:20 }}></div>}
              </div>
              <div style={{ paddingTop:2, fontSize:12 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── BIOMETRICS ────────────────────────────────────────────────────────────
function Biometrics() {
  const [scanning, setScanning] = useState(null);
  const [enrolled, setEnrolled] = useState({ frt: true, fido2: true, nfc: false });

  const startScan = (type) => {
    setScanning(type);
    setTimeout(() => { setScanning(null); setEnrolled(e => ({ ...e, [type]: true })); }, 2400);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Profile &amp; Biometrics</div>
        <div className="page-sub">FRT · FIDO2/WebAuthn · NFC ePassport · ICAO 9303</div>
      </div>

      <div className="grid-3" style={{ marginBottom:16 }}>
        {[
          { key:"frt", label:"Face Recognition", sub:"ICAO 9303 · Airport biometrics", icon:"👁" },
          { key:"fido2", label:"Fingerprint / FIDO2", sub:"WebAuthn · W3C standard", icon:"🔑" },
          { key:"nfc", label:"ePassport NFC", sub:"ISO 14443 · BAC / PACE", icon:"📘" },
        ].map(b => (
          <div key={b.key} className="card" style={{ textAlign:"center" }}>
            {scanning === b.key
              ? <div className="pulse-ring">{b.icon}</div>
              : <div style={{ fontSize:36, marginBottom:12 }}>{b.icon}</div>
            }
            <div style={{ fontFamily:"var(--display)", fontWeight:600, marginBottom:4 }}>{b.label}</div>
            <div style={{ fontSize:11, color:"var(--muted)", marginBottom:14 }}>{b.sub}</div>
            <div style={{ marginBottom:14 }}>
              <span className={`badge ${enrolled[b.key] ? "badge-green" : "badge-warn"}`}>
                {enrolled[b.key] ? "Enrolled" : "Pending"}
              </span>
            </div>
            {!enrolled[b.key] && (
              <button className="btn btn-primary" style={{ width:"100%" }} onClick={() => startScan(b.key)}>
                {scanning === b.key ? "Scanning…" : "Enroll Now"}
              </button>
            )}
            {enrolled[b.key] && (
              <button className="btn" style={{ width:"100%", color:"var(--danger)", borderColor:"rgba(232,93,93,0.3)" }}>
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Biometric Consent &amp; Usage Log</div>
        <table className="table">
          <thead><tr><th>Type</th><th>Used At</th><th>Purpose</th><th>Timestamp</th><th>Status</th></tr></thead>
          <tbody>
            {[
              { type:"FRT", where:"DXB Terminal 3 Gate B32", purpose:"Boarding verification", ts:"2024-06-15 04:12 GST", ok:true },
              { type:"FIDO2", where:"UniProfile Mobile App", purpose:"Profile unlock", ts:"2024-06-14 18:30 EDT", ok:true },
              { type:"FRT", where:"IAD Customs & Border", purpose:"Entry biometric", ts:"2024-07-14 17:45 EDT", ok:true },
            ].map((r, i) => (
              <tr key={i}>
                <td><span className="badge badge-purple">{r.type}</span></td>
                <td style={{ fontSize:12 }}>{r.where}</td>
                <td style={{ fontSize:12 }}>{r.purpose}</td>
                <td style={{ fontFamily:"var(--mono)", fontSize:11 }}>{r.ts}</td>
                <td><span className="badge badge-green">Verified</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CONSENT ───────────────────────────────────────────────────────────────
function ConsentEngine() {
  const [consents, setConsents] = useState(MOCK_CONSENT.map(c => ({ ...c, active: c.status === "active" })));

  const toggle = (i) => setConsents(cs => cs.map((c, j) => j === i ? { ...c, active: !c.active, status: !c.active ? "active" : "revoked" } : c));

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Consent Engine</div>
        <div className="page-sub">GDPR Art. 7 · CCPA · IATA Resolution 787 · Granular data control</div>
      </div>
      <div className="card">
        <div className="card-title">Data Sharing Consents</div>
        {consents.map((c, i) => (
          <div key={i} className="consent-row">
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:500, marginBottom:2 }}>{c.org}</div>
              <div style={{ fontSize:11, color:"var(--muted)" }}>{c.scope}</div>
              <div style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--mono)", marginTop:2 }}>Granted: {c.granted}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span className={`badge ${c.active ? "badge-green" : "badge-muted"}`}>{c.active ? "active" : "revoked"}</span>
              <button className={`toggle ${c.active ? "on" : "off"}`} onClick={() => toggle(i)}></button>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-title">Consent Audit Log</div>
        <div style={{ fontSize:12, color:"var(--muted)", fontFamily:"var(--mono)", lineHeight:2 }}>
          <div><span style={{ color:"var(--accent2)" }}>GRANT</span> · Changi Airport · FRT biometric · 2024-05-01 08:00 SGT</div>
          <div><span style={{ color:"var(--accent2)" }}>GRANT</span> · Singapore Airlines · Profile+seat · 2024-03-10 14:20 SGT</div>
          <div><span style={{ color:"var(--danger)" }}>REVOKE</span> · Sabre GDS · PNR enrichment · 2024-01-05 09:44 EDT</div>
          <div><span style={{ color:"var(--accent2)" }}>GRANT</span> · Amex GBT · Full bleisure profile · 2024-02-01 11:00 EDT</div>
          <div><span style={{ color:"var(--accent2)" }}>GRANT</span> · Emirates Airlines · Profile+loyalty · 2024-01-15 15:30 DXB</div>
        </div>
      </div>
    </div>
  );
}

// ── NAV CONFIG ─────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard", label:"Dashboard", icon:"home", section:"overview" },
  { id:"order", label:"Offer & Order", icon:"order", section:"oneorder" },
  { id:"seat", label:"Seat & Ancillary", icon:"seat", section:"oneorder" },
  { id:"disruption", label:"Disruption", icon:"disruption", section:"oneorder" },
  { id:"loyalty", label:"Loyalty", icon:"loyalty", section:"oneorder" },
  { id:"payment", label:"Payment", icon:"payment", section:"oneorder" },
  { id:"baggage", label:"BagJourney", icon:"bag", section:"oneorder" },
  { id:"biometrics", label:"Biometrics", icon:"bio", section:"identity" },
  { id:"consent", label:"Consent Engine", icon:"consent", section:"identity" },
];

// ── APP ROOT ──────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [context, setContext] = useState("bleisure");

  const PAGES = {
    dashboard: <Dashboard passenger={MOCK_PASSENGER} />,
    order: <OfferOrder />,
    seat: <SeatAncillary />,
    disruption: <Disruption />,
    loyalty: <Loyalty />,
    payment: <Payment />,
    baggage: <Baggage />,
    biometrics: <Biometrics />,
    consent: <ConsentEngine />,
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-mark">Uni<span>Profile</span></div>
            <div className="sidebar-logo-sub">IATA OneOrder · v2.0</div>
          </div>

          <div className="uuid-chip">
            <div className="uuid-label">Passenger UUID</div>
            <div className="uuid-value">{MOCK_UUID}</div>
          </div>

          <div className="context-toggle">
            <button className={`ctx-btn ${context==="business"?"active":""}`} onClick={()=>setContext("business")}>Business</button>
            <button className={`ctx-btn ${context==="bleisure"?"active":""}`} onClick={()=>setContext("bleisure")}>Bleisure</button>
            <button className={`ctx-btn ${context==="leisure"?"active":""}`} onClick={()=>setContext("leisure")}>Leisure</button>
          </div>

          {["overview","oneorder","identity"].map(section => (
            <div key={section}>
              <div className="nav-section-label">
                {section==="overview"?"Overview":section==="oneorder"?"OneOrder Modules":"Identity"}
              </div>
              {NAV.filter(n => n.section===section).map(n => (
                <div key={n.id} className={`nav-item ${active===n.id?"active":""}`} onClick={()=>setActive(n.id)}>
                  <Icon name={n.icon} />
                  {n.label}
                </div>
              ))}
            </div>
          ))}

          <div className="sidebar-footer">
            <div style={{ fontSize:10, color:"var(--muted)", fontFamily:"var(--mono)", marginBottom:8, textTransform:"uppercase", letterSpacing:"1px" }}>Biometric Status</div>
            <div className="biometric-badges">
              <span className="bio-badge bio-enrolled">FRT</span>
              <span className="bio-badge bio-enrolled">FIDO2</span>
              <span className="bio-badge bio-pending">NFC</span>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          {PAGES[active]}
        </main>
      </div>
    </>
  );
}
