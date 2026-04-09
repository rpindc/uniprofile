import { useState, useEffect, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL || "https://0wsxmo9ftg.execute-api.us-east-1.amazonaws.com/prod";
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || "2heljmdli4f9cv2i4m0i020mfc";
const REGION = import.meta.env.VITE_REGION || "us-east-1";
const COGNITO_URL = `https://cognito-idp.${REGION}.amazonaws.com/`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#F7F8FC;--surface:#FFFFFF;--surface2:#F0F2F9;
  --border:#E4E7F0;--border2:#CDD2E6;
  --ink:#0F1523;--ink2:#374151;--muted:#7B8494;--hint:#A8B0C0;
  --indigo:#4F46E5;--indigo-light:#818CF8;--indigo-xlight:#EEF2FF;--indigo-surface:#E0E7FF;
  --emerald:#10B981;--emerald-light:#34D399;--emerald-xlight:#D1FAE5;
  --amber:#F59E0B;--amber-xlight:#FEF3C7;
  --rose:#F43F5E;--rose-xlight:#FFF1F2;
  --purple:#7C3AED;--purple-xlight:#F5F3FF;
  --display:'Nunito',sans-serif;--sans:'Plus Jakarta Sans',sans-serif;--mono:'JetBrains Mono',monospace;
  --r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;--r-pill:50px;
}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.6;min-height:100vh}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp 0.22s ease both}
.app{display:flex;min-height:100vh}
.main{flex:1;overflow-y:auto;padding:32px 36px;height:100vh;max-width:100%}

.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg)}
.auth-box{background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:48px 44px;width:100%;max-width:440px;box-shadow:0 4px 24px rgba(79,70,229,0.06)}
.auth-wordmark{font-family:var(--display);font-size:28px;font-weight:900;color:var(--ink);letter-spacing:-0.5px;margin-bottom:2px}
.auth-wordmark span{color:var(--indigo)}
.auth-tag{font-size:10px;color:var(--muted);font-family:var(--mono);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:32px}
.auth-h{font-family:var(--display);font-size:22px;font-weight:800;color:var(--ink);margin-bottom:24px;letter-spacing:-0.3px}
.field{margin-bottom:14px}
.field label{display:block;font-size:11px;font-weight:600;color:var(--muted);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:6px}
.field input,.field select,.field textarea{width:100%;background:var(--bg);border:1.5px solid var(--border);border-radius:var(--r-md);color:var(--ink);font-family:var(--sans);font-size:14px;padding:11px 14px;outline:none;transition:border-color 0.15s,box-shadow 0.15s}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(79,70,229,0.1)}
.field select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237B8494' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;appearance:none;padding-right:36px}
.field textarea{min-height:90px;resize:vertical}
.g2f{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.btn-full{width:100%;padding:14px;border-radius:var(--r-pill);background:var(--indigo);border:none;color:#fff;font-family:var(--display);font-size:15px;font-weight:700;cursor:pointer;transition:all 0.15s;margin-top:6px}
.btn-full:hover{background:#3730C8;transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,0.3)}
.btn-full:disabled{opacity:0.5;cursor:not-allowed;transform:none;box-shadow:none}
.auth-sw{text-align:center;margin-top:20px;font-size:13px;color:var(--muted)}
.auth-sw a{color:var(--indigo);cursor:pointer;font-weight:600;text-decoration:none}
.auth-sw a:hover{text-decoration:underline}
.err{background:var(--rose-xlight);border:1px solid rgba(244,63,94,0.25);border-radius:var(--r-md);padding:11px 16px;font-size:13px;color:var(--rose);margin-bottom:14px}

.sidebar{width:236px;min-width:236px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;overflow:hidden}
.logo-area{padding:22px 20px 16px;border-bottom:1px solid var(--border)}
.logotype{font-family:var(--display);font-size:22px;font-weight:900;letter-spacing:-0.5px;color:var(--ink)}
.logotype span{color:var(--indigo)}
.logo-sub{font-size:9px;color:var(--muted);font-family:var(--mono);letter-spacing:1.2px;text-transform:uppercase;margin-top:2px}
.uuid-chip{margin:12px 14px;padding:10px 12px;background:var(--indigo-xlight);border:1px solid var(--indigo-surface);border-radius:var(--r-md)}
.uuid-lbl{font-size:8px;letter-spacing:1.2px;text-transform:uppercase;color:var(--indigo-light);font-family:var(--mono);font-weight:500}
.uuid-val{font-family:var(--mono);font-size:8.5px;color:var(--indigo);word-break:break-all;margin-top:3px;line-height:1.6}
.ctx-row{margin:0 14px 12px;display:flex;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-pill);overflow:hidden;padding:3px}
.ctx-btn{flex:1;padding:6px 4px;font-size:10px;font-family:var(--display);font-weight:700;border:none;background:transparent;color:var(--muted);cursor:pointer;text-align:center;transition:all 0.15s;border-radius:var(--r-pill)}
.ctx-btn.on{background:var(--indigo);color:#fff;box-shadow:0 2px 8px rgba(79,70,229,0.25)}
.nav-sec{font-size:9px;text-transform:uppercase;letter-spacing:1.4px;color:var(--hint);font-family:var(--mono);font-weight:500;padding:14px 20px 6px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 14px;margin:1px 8px;cursor:pointer;border-radius:var(--r-md);font-size:13px;font-weight:500;color:var(--muted);transition:all 0.12s}
.nav-item:hover{background:var(--bg);color:var(--ink)}
.nav-item.on{background:var(--indigo-xlight);color:var(--indigo);font-weight:600}
.nav-icon{width:28px;height:28px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;font-size:13px;background:var(--bg);flex-shrink:0;transition:background 0.12s}
.nav-item.on .nav-icon{background:var(--indigo-surface)}
.sidebar-foot{margin-top:auto;padding:14px 16px;border-top:1px solid var(--border)}
.user-pill{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 10px;background:var(--bg);border-radius:var(--r-md)}
.user-avatar{width:28px;height:28px;border-radius:50%;background:var(--indigo);color:#fff;font-family:var(--display);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.user-email{font-size:11px;color:var(--muted);font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.signout-btn{width:100%;padding:8px;border-radius:var(--r-md);background:transparent;border:1px solid var(--border);color:var(--muted);font-family:var(--sans);font-size:12px;font-weight:500;cursor:pointer;transition:all 0.12s}
.signout-btn:hover{border-color:var(--rose);color:var(--rose);background:var(--rose-xlight)}

.ph{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
.ptitle{font-family:var(--display);font-size:26px;font-weight:900;letter-spacing:-0.5px;color:var(--ink)}
.psub{font-size:12px;color:var(--muted);margin-top:3px}

.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:20px 22px;margin-bottom:16px}
.ctitle{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);margin-bottom:16px;font-family:var(--mono)}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}

.stat{border-radius:var(--r-xl);padding:18px 20px}
.stat-indigo{background:var(--indigo-xlight);border:1.5px solid var(--indigo-surface)}
.stat-emerald{background:var(--emerald-xlight);border:1.5px solid #A7F3D0}
.stat-amber{background:var(--amber-xlight);border:1.5px solid #FCD34D}
.stat-gray{background:var(--bg);border:1px solid var(--border)}
.slbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-weight:600;font-family:var(--mono)}
.sval{font-family:var(--display);font-size:24px;font-weight:900;line-height:1.1;margin-top:6px;letter-spacing:-0.5px}
.ssub{font-size:11px;margin-top:3px;font-weight:500}
.stat-indigo .slbl{color:var(--indigo-light)}.stat-indigo .sval{color:var(--indigo)}.stat-indigo .ssub{color:var(--indigo-light)}
.stat-emerald .slbl{color:#059669}.stat-emerald .sval{color:#065F46}.stat-emerald .ssub{color:var(--emerald-light)}
.stat-amber .slbl{color:#D97706}.stat-amber .sval{color:#92400E}.stat-amber .ssub{color:var(--amber)}
.stat-gray .sval{color:var(--ink)}.stat-gray .ssub{color:var(--muted)}

.fr{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)}
.fr:last-child{border-bottom:none}
.fl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted)}
.fv{font-size:13px;color:var(--ink);text-align:right;font-family:var(--mono)}

.badge{display:inline-flex;align-items:center;font-size:11px;font-family:var(--sans);font-weight:600;padding:4px 10px;border-radius:var(--r-pill)}
.bg{background:var(--emerald-xlight);color:#065F46}
.bb{background:var(--indigo-xlight);color:#3730A3}
.bw{background:var(--amber-xlight);color:#92400E}
.bd{background:var(--rose-xlight);color:#BE123C}
.bp{background:var(--purple-xlight);color:#5B21B6}
.bm{background:var(--bg);color:var(--muted);border:1px solid var(--border)}

.tbl{width:100%;border-collapse:collapse}
.tbl th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-family:var(--mono);font-weight:600;text-align:left;padding:8px 12px;border-bottom:1px solid var(--border)}
.tbl td{padding:12px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:var(--bg)}
.mono{font-family:var(--mono)}.acc{color:var(--indigo)}.acc2{color:var(--emerald)}.muted{color:var(--muted)}.warn{color:var(--amber)}.pur{color:var(--purple)}

.loading{display:flex;align-items:center;justify-content:center;padding:56px;color:var(--muted);font-size:13px;gap:10px;font-weight:500}
.spinner{width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--indigo);border-radius:50%;animation:spin 0.7s linear infinite}
.empty{text-align:center;padding:56px 32px}
.empty-icon{font-size:44px;margin-bottom:16px}
.empty-title{font-family:var(--display);font-size:20px;font-weight:800;margin-bottom:8px;color:var(--ink);letter-spacing:-0.3px}
.empty-sub{font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.7;max-width:400px;margin-left:auto;margin-right:auto}

.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:var(--r-pill);border:1.5px solid var(--border);background:var(--surface);color:var(--ink2);font-size:13px;font-family:var(--sans);font-weight:600;cursor:pointer;transition:all 0.12s;white-space:nowrap}
.btn:hover{border-color:var(--indigo);color:var(--indigo);background:var(--indigo-xlight)}
.btn-p{background:var(--indigo);border-color:var(--indigo);color:#fff}
.btn-p:hover{background:#3730C8;border-color:#3730C8;box-shadow:0 4px 14px rgba(79,70,229,0.25)}
.btn-d{border-color:rgba(244,63,94,0.3);color:var(--rose)}
.btn-d:hover{background:var(--rose-xlight);border-color:var(--rose)}
.btn-sm{padding:6px 12px;font-size:11px}

.modal-bg{position:fixed;inset:0;background:rgba(15,21,35,0.5);display:flex;align-items:center;justify-content:center;z-index:200;padding:24px;backdrop-filter:blur(6px)}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:32px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.12)}
.modal-title{font-family:var(--display);font-size:22px;font-weight:800;margin-bottom:24px;letter-spacing:-0.4px;color:var(--ink)}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:24px;padding-top:16px;border-top:1px solid var(--border)}

.prog{height:6px;border-radius:3px;background:var(--bg);overflow:hidden;margin-top:10px;border:1px solid var(--border)}
.pf{height:100%;border-radius:3px;background:var(--indigo);transition:width 0.4s ease}

.toggle{width:38px;height:22px;border-radius:var(--r-pill);border:none;cursor:pointer;position:relative;transition:background 0.2s;flex-shrink:0}
.toggle::after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:white;top:3px;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
.t-on{background:var(--emerald)}.t-on::after{left:19px}
.t-off{background:var(--border2)}.t-off::after{left:3px}

.wizard{max-width:580px;margin:0 auto}
.wstep{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:28px 32px;margin-bottom:16px}
.wnum{font-family:var(--mono);font-size:10px;color:var(--indigo);font-weight:500;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px}
.wtitle{font-family:var(--display);font-size:20px;font-weight:800;margin-bottom:22px;letter-spacing:-0.3px;color:var(--ink)}

.consent-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);gap:16px}
.consent-row:last-child{border-bottom:none}

.info-box{background:var(--indigo-xlight);border:1px solid var(--indigo-surface);border-radius:var(--r-md);padding:12px 16px;font-size:12px;color:#3730A3;margin-top:6px;line-height:1.6}

.loyalty-card-visual{background:var(--indigo);border-radius:var(--r-lg);padding:14px 18px;color:#fff;position:relative;overflow:hidden;flex-shrink:0}
`;

async function cognitoReq(action, body) {
  const r = await fetch(COGNITO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}` },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || d.__type || "Auth error");
  return d;
}
const signUp = (e, p, f, l) => cognitoReq("SignUp", { ClientId: CLIENT_ID, Username: e, Password: p, UserAttributes: [{ Name: "email", Value: e }, { Name: "given_name", Value: f }, { Name: "family_name", Value: l }] });
const confirmSignUp = (e, c) => cognitoReq("ConfirmSignUp", { ClientId: CLIENT_ID, Username: e, ConfirmationCode: c });
const signIn = (e, p) => cognitoReq("InitiateAuth", { AuthFlow: "USER_PASSWORD_AUTH", ClientId: CLIENT_ID, AuthParameters: { USERNAME: e, PASSWORD: p } });

async function api(path, method = "GET", body = null, token = null) {
  const r = await fetch(`${API_URL}/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return r.json();
}

function genUUID() {
  const n = Date.now(), h = n.toString(16).padStart(12, "0");
  const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${h.slice(0, 8)}-${h.slice(8)}-7${r().slice(1)}-${(0x8000 | Math.random() * 0x3fff).toString(16)}-${Math.floor(Math.random() * 0x1000000000000).toString(16).padStart(12, "0")}`;
}

function initials(email) {
  const parts = email.split("@")[0].split(/[._-]/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || email.slice(0, 2).toUpperCase();
}

function Modal({ title, onClose, onSubmit, submitLabel = "Save", loading, children }) {
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-up">
        <div className="modal-title">{title}</div>
        {children}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-p" onClick={onSubmit} disabled={loading}>{loading ? "Saving…" : submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Empty({ icon, title, sub, onAdd, addLabel = "+ Add" }) {
  return (
    <div className="card empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
      {onAdd && <button className="btn btn-p" onClick={onAdd}>{addLabel}</button>}
    </div>
  );
}

function SignUpPage({ onSwitch }) {
  const [step, setStep] = useState("form");
  const [f, setF] = useState({ fn: "", ln: "", email: "", pw: "", pw2: "" });
  const [code, setCode] = useState("");
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const doSignUp = async () => {
    if (!f.fn || !f.ln || !f.email || !f.pw) return setErr("All fields required");
    if (f.pw !== f.pw2) return setErr("Passwords don't match");
    if (f.pw.length < 8) return setErr("Min 8 characters");
    setErr(""); setLoading(true);
    try { await signUp(f.email, f.pw, f.fn, f.ln); setStep("verify"); } catch (e) { setErr(e.message); }
    setLoading(false);
  };
  const doVerify = async () => {
    if (!code) return setErr("Enter code");
    setErr(""); setLoading(true);
    try { await confirmSignUp(f.email, code); onSwitch("login", f.email); } catch (e) { setErr(e.message); }
    setLoading(false);
  };
  if (step === "verify") return (
    <div className="auth-wrap"><div className="auth-box fade-up">
      <div className="auth-wordmark">Uni<span>Profile</span></div>
      <div className="auth-tag">Verify your email</div>
      <div className="auth-h">Check your inbox ✉️</div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.7 }}>We sent a 6-digit code to <strong style={{ color: "var(--ink)" }}>{f.email}</strong></p>
      {err && <div className="err">{err}</div>}
      <div className="field"><label>Verification code</label><input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" maxLength={6} style={{ fontSize: 22, letterSpacing: 8, textAlign: "center", fontFamily: "var(--mono)" }} /></div>
      <button className="btn-full" onClick={doVerify} disabled={loading}>{loading ? "Verifying…" : "Verify & continue →"}</button>
      <div className="auth-sw"><a onClick={() => setStep("form")}>← Back</a></div>
    </div></div>
  );
  return (
    <div className="auth-wrap"><div className="auth-box fade-up">
      <div className="auth-wordmark">Uni<span>Profile</span></div>
      <div className="auth-tag">IATA OneOrder · v2.0</div>
      <div className="auth-h">Create your profile 🚀</div>
      {err && <div className="err">{err}</div>}
      <div className="g2f">
        <div className="field"><label>First name</label><input value={f.fn} onChange={set("fn")} placeholder="Rommel" /></div>
        <div className="field"><label>Last name</label><input value={f.ln} onChange={set("ln")} placeholder="Santos" /></div>
      </div>
      <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set("email")} placeholder="you@example.com" /></div>
      <div className="field"><label>Password</label><input type="password" value={f.pw} onChange={set("pw")} placeholder="Min 8 characters" /></div>
      <div className="field"><label>Confirm password</label><input type="password" value={f.pw2} onChange={set("pw2")} placeholder="Repeat password" /></div>
      <button className="btn-full" onClick={doSignUp} disabled={loading}>{loading ? "Creating account…" : "Create UniProfile →"}</button>
      <div className="auth-sw">Already have an account? <a onClick={() => onSwitch("login")}>Sign in</a></div>
    </div></div>
  );
}

function LoginPage({ onLogin, onSwitch, prefill = "" }) {
  const [f, setF] = useState({ email: prefill, pw: "" });
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const doLogin = async () => {
    if (!f.email || !f.pw) return setErr("Email and password required");
    setErr(""); setLoading(true);
    try { const d = await signIn(f.email, f.pw); onLogin({ email: f.email, token: d.AuthenticationResult.IdToken }); } catch (e) { setErr(e.message); }
    setLoading(false);
  };
  return (
    <div className="auth-wrap"><div className="auth-box fade-up">
      <div className="auth-wordmark">Uni<span>Profile</span></div>
      <div className="auth-tag">IATA OneOrder · v2.0</div>
      <div className="auth-h">Welcome back 👋</div>
      {err && <div className="err">{err}</div>}
      <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set("email")} placeholder="you@example.com" /></div>
      <div className="field"><label>Password</label><input type="password" value={f.pw} onChange={set("pw")} placeholder="Your password" onKeyDown={e => e.key === "Enter" && doLogin()} /></div>
      <button className="btn-full" onClick={doLogin} disabled={loading}>{loading ? "Signing in…" : "Sign in →"}</button>
      <div className="auth-sw">No account yet? <a onClick={() => onSwitch("signup")}>Create one</a></div>
    </div></div>
  );
}

function SetupWizard({ user, onComplete }) {
  const [f, setF] = useState({ phone: "", nat: "", passport: "", exp: "", dob: "", seat: "Window", meal: "AVML", cabin: "Economy", ctx: "leisure" });
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const submit = async () => {
    setLoading(true); setErr("");
    try {
      const uuid = genUUID();
      const np = user.email.split("@")[0].split(".");
      const d = await api("/passengers", "POST", { uuid, firstName: np[0] || "Passenger", lastName: np[1] || "User", email: user.email, phone: f.phone, nationality: f.nat, passportNo: f.passport, passportExpiry: f.exp || null, dateOfBirth: f.dob || null, context: f.ctx, seatPreference: f.seat, mealPreference: f.meal, cabinPreference: f.cabin }, user.token);
      if (d.passenger) onComplete(d.passenger.uuid, d.passenger);
      else setErr("Could not create profile. Please try again.");
    } catch (e) { setErr(e.message || "Error creating profile"); }
    setLoading(false);
  };
  return (
    <div className="main"><div className="wizard fade-up">
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "var(--display)", fontSize: 30, fontWeight: 900, letterSpacing: "-0.5px", color: "var(--ink)", marginBottom: 8 }}>Welcome to UniProfile 🛫</div>
        <div style={{ fontSize: 14, color: "var(--muted)" }}>Set up your passenger identity — takes 2 minutes</div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="wstep">
        <div className="wnum">Step 1 of 2</div>
        <div className="wtitle">Travel documents</div>
        <div className="g2f">
          <div className="field"><label>Phone number</label><input value={f.phone} onChange={set("phone")} placeholder="+1 571 555 0192" /></div>
          <div className="field"><label>Nationality (ISO 3)</label><input value={f.nat} onChange={set("nat")} placeholder="PHL" maxLength={3} /></div>
        </div>
        <div className="g2f">
          <div className="field"><label>Passport number</label><input value={f.passport} onChange={set("passport")} placeholder="P12345678" /></div>
          <div className="field"><label>Passport expiry</label><input type="date" value={f.exp} onChange={set("exp")} /></div>
        </div>
        <div className="field"><label>Date of birth</label><input type="date" value={f.dob} onChange={set("dob")} /></div>
      </div>
      <div className="wstep">
        <div className="wnum">Step 2 of 2</div>
        <div className="wtitle">Travel preferences</div>
        <div className="g2f">
          <div className="field"><label>Preferred seat</label><select value={f.seat} onChange={set("seat")}><option>Window</option><option>Aisle</option><option>Middle</option></select></div>
          <div className="field"><label>Preferred cabin</label><select value={f.cabin} onChange={set("cabin")}><option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option></select></div>
        </div>
        <div className="g2f">
          <div className="field"><label>Meal preference</label><select value={f.meal} onChange={set("meal")}><option value="AVML">Asian Vegetarian</option><option value="VGML">Vegan</option><option value="HNML">Hindu</option><option value="MOML">Muslim</option><option value="KSML">Kosher</option><option value="GFML">Gluten Free</option><option value="NLML">No Preference</option></select></div>
          <div className="field"><label>Travel context</label><select value={f.ctx} onChange={set("ctx")}><option value="leisure">Leisure</option><option value="business">Business</option><option value="bleisure">Bleisure</option></select></div>
        </div>
      </div>
      <button className="btn-full" onClick={submit} disabled={loading}>{loading ? "Creating your UniProfile…" : "Complete setup →"}</button>
    </div></div>
  );
}

function Dashboard({ passenger, uuid, onRefresh }) {
  if (!passenger) return (
    <div className="card" style={{ textAlign: "center", padding: "48px 32px" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>👤</div>
      <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 20, marginBottom: 8, color: "var(--ink)" }}>Profile loading…</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>If this persists, try signing out and back in.</div>
      <button className="btn btn-p" onClick={onRefresh}>Refresh profile</button>
    </div>
  );
  return (
    <div className="fade-up">
      <div className="ph">
        <div>
          <div className="ptitle">Hey, {passenger.first_name} 👋</div>
          <div className="psub">Your UniProfile identity dashboard · IATA OneOrder active</div>
        </div>
      </div>
      <div className="g4" style={{ marginBottom: 20 }}>
        <div className="stat stat-indigo">
          <div className="slbl">Travel context</div>
          <div className="sval" style={{ fontSize: 18, marginTop: 8 }}>{passenger.bleisure_context || "Leisure"}</div>
          <div className="ssub">Active mode</div>
        </div>
        <div className="stat stat-gray">
          <div className="slbl">Preferred cabin</div>
          <div className="sval" style={{ fontSize: 18 }}>{passenger.cabin_preference || "—"}</div>
          <div className="ssub">Default class</div>
        </div>
        <div className="stat stat-gray">
          <div className="slbl">Meal code</div>
          <div className="sval" style={{ fontSize: 18 }}>{passenger.meal_preference || "—"}</div>
          <div className="ssub">Auto-applied to offers</div>
        </div>
        <div className="stat stat-gray">
          <div className="slbl">Seat preference</div>
          <div className="sval" style={{ fontSize: 18 }}>{passenger.seat_preference || "—"}</div>
          <div className="ssub">NDC enrichment</div>
        </div>
      </div>
      <div className="g2">
        <div className="card">
          <div className="ctitle">Passenger identity</div>
          <div className="fr"><span className="fl">Full name</span><span className="fv">{passenger.first_name} {passenger.last_name}</span></div>
          <div className="fr"><span className="fl">Email</span><span className="fv" style={{ fontSize: 11 }}>{passenger.email}</span></div>
          <div className="fr"><span className="fl">Phone</span><span className="fv">{passenger.phone || "—"}</span></div>
          <div className="fr"><span className="fl">Nationality</span><span className="fv">{passenger.nationality || "—"}</span></div>
          <div className="fr"><span className="fl">Passport</span><span className="fv">{passenger.passport_number || "—"}</span></div>
          <div className="fr"><span className="fl">Member since</span><span className="fv">{new Date(passenger.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span></div>
        </div>
        <div>
          <div className="card">
            <div className="ctitle">UUID v7 — passenger key</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--indigo)", wordBreak: "break-all", lineHeight: 2, background: "var(--indigo-xlight)", padding: "12px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--indigo-surface)" }}>{uuid}</div>
          </div>
          <div className="card">
            <div className="ctitle">Biometric enrollment</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className={`badge ${passenger.frt_enrolled ? "bg" : "bw"}`}>👁 FRT {passenger.frt_enrolled ? "Enrolled" : "Pending"}</span>
              <span className={`badge ${passenger.fido2_enrolled ? "bg" : "bw"}`}>🔑 FIDO2 {passenger.fido2_enrolled ? "Enrolled" : "Pending"}</span>
              <span className={`badge ${passenger.nfc_enrolled ? "bg" : "bw"}`}>📘 NFC {passenger.nfc_enrolled ? "Enrolled" : "Pending"}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, lineHeight: 1.6 }}>Enroll at partner airports or via the UniProfile mobile app.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Orders({ uuid, token }) {
  const [orders, setOrders] = useState(null); const [modal, setModal] = useState(false);
  const [f, setF] = useState({ airline: "", pnr: "", route: "", origin: "", destination: "", date: "", cabin: "Economy", amount: "", currency: "USD", status: "confirmed", context: "business" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const load = useCallback(async () => { const d = await api(`/orders?uuid=${uuid}`, "GET", null, token); setOrders(d.orders || []); }, [uuid, token]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setLoading(true);
    await api("/orders", "POST", { passengerUuid: uuid, orderReference: `ORD-${Date.now()}`, airlineCode: f.airline, pnr: f.pnr, route: f.route, origin: f.origin, destination: f.destination, departureDate: f.date || null, cabin: f.cabin, totalAmount: f.amount || null, currency: f.currency, status: f.status, tripContext: f.context }, token);
    setModal(false); setF({ airline: "", pnr: "", route: "", origin: "", destination: "", date: "", cabin: "Economy", amount: "", currency: "USD", status: "confirmed", context: "business" }); await load(); setLoading(false);
  };
  return (
    <div className="fade-up">
      <div className="ph">
        <div><div className="ptitle">Offer & Order</div><div className="psub">IATA OneOrder · NDC Level 4 · UUID-linked bookings</div></div>
        <button className="btn btn-p" onClick={() => setModal(true)}>+ Add order</button>
      </div>
      {!orders ? <div className="loading"><div className="spinner"></div>Loading orders…</div> : orders.length === 0 ?
        <Empty icon="✈️" title="No orders yet" sub="Add your first IATA OneOrder booking. Every order is linked to your passenger UUID and enriched with your travel preferences automatically." onAdd={() => setModal(true)} addLabel="+ Add first order" /> : (
          <div className="card"><table className="tbl">
            <thead><tr><th>Order ref</th><th>Airline</th><th>Route</th><th>PNR</th><th>Departure</th><th>Cabin</th><th>Amount</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>{orders.map(o => (
              <tr key={o.id}>
                <td><span className="mono acc" style={{ fontSize: 11 }}>{o.order_reference}</span></td>
                <td><span className="badge bb">{o.airline_code || "—"}</span></td>
                <td>
                  {o.origin && o.destination ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)" }}>{o.origin}</span>
                      <span style={{ color: "var(--indigo)", fontSize: 13 }}>→</span>
                      <span style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)" }}>{o.destination}</span>
                    </div>
                  ) : <span style={{ fontSize: 12 }}>{o.route || "—"}</span>}
                </td>
                <td><span className="mono pur" style={{ fontSize: 12 }}>{o.pnr || "—"}</span></td>
                <td className="mono" style={{ fontSize: 11 }}>{o.departure_date ? new Date(o.departure_date).toLocaleDateString() : "—"}</td>
                <td style={{ fontSize: 12 }}>{o.cabin || "—"}</td>
                <td><span className="acc2 mono" style={{ fontWeight: 700 }}>{o.total_amount ? `$${parseFloat(o.total_amount).toLocaleString()}` : "—"}</span></td>
                <td><span className={`badge ${o.trip_context === "business" ? "bb" : "bg"}`}>{o.trip_context || "—"}</span></td>
                <td><span className={`badge ${o.status === "confirmed" ? "bg" : o.status === "ticketed" ? "bb" : "bw"}`}>{o.status}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      {modal && <Modal title="Add OneOrder booking" onClose={() => setModal(false)} onSubmit={save} loading={loading}>
        <div className="g2f">
          <div className="field"><label>Airline code</label><input value={f.airline} onChange={set("airline")} placeholder="EK" maxLength={2} /></div>
          <div className="field"><label>PNR reference</label><input value={f.pnr} onChange={set("pnr")} placeholder="EK7X4M" /></div>
        </div>
        <div className="field"><label>Route</label><input value={f.route} onChange={set("route")} placeholder="IAD → DXB → SIN" /></div>
        <div className="g2f">
          <div className="field"><label>Origin</label><input value={f.origin} onChange={set("origin")} placeholder="IAD" maxLength={3} /></div>
          <div className="field"><label>Destination</label><input value={f.destination} onChange={set("destination")} placeholder="SIN" maxLength={3} /></div>
        </div>
        <div className="g2f">
          <div className="field"><label>Departure date</label><input type="date" value={f.date} onChange={set("date")} /></div>
          <div className="field"><label>Cabin class</label><select value={f.cabin} onChange={set("cabin")}><option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option></select></div>
        </div>
        <div className="g2f">
          <div className="field"><label>Total amount</label><input value={f.amount} onChange={set("amount")} placeholder="3420.00" /></div>
          <div className="field"><label>Currency</label><select value={f.currency} onChange={set("currency")}><option>USD</option><option>EUR</option><option>GBP</option><option>SGD</option><option>AED</option><option>JPY</option></select></div>
        </div>
        <div className="g2f">
          <div className="field"><label>Booking status</label><select value={f.status} onChange={set("status")}><option value="confirmed">Confirmed</option><option value="ticketed">Ticketed</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option></select></div>
          <div className="field"><label>Trip type</label><select value={f.context} onChange={set("context")}><option value="business">Business</option><option value="leisure">Leisure</option></select></div>
        </div>
      </Modal>}
    </div>
  );
}

function Loyalty({ uuid, token }) {
  const [programs, setPrograms] = useState(null); const [modal, setModal] = useState(false); const [editModal, setEditModal] = useState(null);
  const [f, setF] = useState({ program: "Emirates Skywards", airline: "EK", number: "", tier: "Gold", miles: "0", expiry: "" });
  const [ef, setEf] = useState({});
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const eSet = k => e => setEf(p => ({ ...p, [k]: e.target.value }));
  const load = useCallback(async () => { const d = await api(`/loyalty?uuid=${uuid}`, "GET", null, token); setPrograms(d.programs || []); }, [uuid, token]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setLoading(true);
    await api("/loyalty", "POST", { passengerUuid: uuid, programName: f.program, airlineCode: f.airline, membershipNumber: f.number, tier: f.tier, milesBalance: parseInt(f.miles) || 0, expiryDate: f.expiry || null }, token);
    setModal(false); setF({ program: "Emirates Skywards", airline: "EK", number: "", tier: "Gold", miles: "0", expiry: "" }); await load(); setLoading(false);
  };
  const saveEdit = async () => {
    setLoading(true);
    await api(`/loyalty/${editModal.id}`, "PUT", { programName: ef.program, tier: ef.tier, milesBalance: parseInt(ef.miles) || 0, expiryDate: ef.expiry || null }, token);
    setEditModal(null); await load(); setLoading(false);
  };
  const del = async (id) => { if (!confirm("Delete this loyalty program?")) return; await api(`/loyalty/${id}`, "DELETE", null, token); await load(); };
  const openEdit = p => { setEf({ program: p.program_name, tier: p.tier || "", miles: String(p.miles_balance || 0), expiry: p.expiry_date ? p.expiry_date.split("T")[0] : "" }); setEditModal(p); };
  const total = programs?.reduce((a, p) => a + (p.miles_balance || 0), 0) || 0;
  return (
    <div className="fade-up">
      <div className="ph">
        <div><div className="ptitle">Loyalty & recognition</div><div className="psub">FFP aggregation · Real-time tier status · UUID-linked rewards</div></div>
        <button className="btn btn-p" onClick={() => setModal(true)}>+ Add program</button>
      </div>
      {programs && programs.length > 0 && <div className="g3" style={{ marginBottom: 20 }}>
        <div className="stat stat-emerald"><div className="slbl">Total miles</div><div className="sval">{total.toLocaleString()}</div><div className="ssub">Across {programs.length} program{programs.length > 1 ? "s" : ""}</div></div>
        <div className="stat stat-indigo"><div className="slbl">Estimated value</div><div className="sval">${Math.round(total * 0.015).toLocaleString()}</div><div className="ssub">At $0.015 per mile</div></div>
        <div className="stat stat-gray"><div className="slbl">Programs</div><div className="sval">{programs.length}</div><div className="ssub">Active FFP memberships</div></div>
      </div>}
      {!programs ? <div className="loading"><div className="spinner"></div>Loading loyalty programs…</div> : programs.length === 0 ?
        <Empty icon="⭐" title="No loyalty programs" sub="Add your frequent flyer numbers to consolidate miles across all airlines in one place." onAdd={() => setModal(true)} addLabel="+ Add first program" /> :
        programs.map(p => (
          <div key={p.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div className="loyalty-card-visual">
                  <div style={{ fontSize: 9, opacity: 0.7, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{p.airline_code}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, fontFamily: "var(--display)" }}>{p.tier || "Member"}</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 17, color: "var(--ink)", marginBottom: 3 }}>{p.program_name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>{p.membership_number}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm" onClick={() => openEdit(p)}>Edit</button>
                <button className="btn btn-sm btn-d" onClick={() => del(p.id)}>Delete</button>
              </div>
            </div>
            <div className="g2f">
              <div><div className="fl" style={{ marginBottom: 4 }}>Miles balance</div><div style={{ fontFamily: "var(--display)", fontSize: 26, fontWeight: 900, color: "var(--emerald)" }}>{(p.miles_balance || 0).toLocaleString()}</div></div>
              <div><div className="fl" style={{ marginBottom: 4 }}>Expiry</div><div style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{p.expiry_date ? new Date(p.expiry_date).toLocaleDateString() : "—"}</div></div>
            </div>
            <div className="prog"><div className="pf" style={{ width: `${Math.min(100, ((p.miles_balance || 0) / 150000) * 100).toFixed(0)}%` }}></div></div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, fontFamily: "var(--mono)" }}>{Math.min(100, ((p.miles_balance || 0) / 150000) * 100).toFixed(0)}% to next tier threshold</div>
          </div>
        ))}
      {modal && <Modal title="Add loyalty program" onClose={() => setModal(false)} onSubmit={save} loading={loading}>
        <div className="field"><label>Program name</label><input value={f.program} onChange={set("program")} placeholder="Emirates Skywards" /></div>
        <div className="g2f">
          <div className="field"><label>Airline code</label><input value={f.airline} onChange={set("airline")} placeholder="EK" maxLength={2} /></div>
          <div className="field"><label>Membership tier</label><select value={f.tier} onChange={set("tier")}><option>Member</option><option>Silver</option><option>Gold</option><option>Platinum</option><option>PPS Club</option><option>Million Miler</option></select></div>
        </div>
        <div className="field"><label>Membership number</label><input value={f.number} onChange={set("number")} placeholder="EK-9872341" /></div>
        <div className="g2f">
          <div className="field"><label>Current miles balance</label><input type="number" value={f.miles} onChange={set("miles")} placeholder="0" /></div>
          <div className="field"><label>Miles expiry date</label><input type="date" value={f.expiry} onChange={set("expiry")} /></div>
        </div>
      </Modal>}
      {editModal && <Modal title={`Edit — ${editModal.program_name}`} onClose={() => setEditModal(null)} onSubmit={saveEdit} loading={loading} submitLabel="Save changes">
        <div className="field"><label>Program name</label><input value={ef.program} onChange={eSet("program")} /></div>
        <div className="field"><label>Tier</label><select value={ef.tier} onChange={eSet("tier")}><option>Member</option><option>Silver</option><option>Gold</option><option>Platinum</option><option>PPS Club</option><option>Million Miler</option></select></div>
        <div className="g2f">
          <div className="field"><label>Miles balance</label><input type="number" value={ef.miles} onChange={eSet("miles")} /></div>
          <div className="field"><label>Expiry date</label><input type="date" value={ef.expiry} onChange={eSet("expiry")} /></div>
        </div>
      </Modal>}
    </div>
  );
}

function Payment({ uuid, token }) {
  const [methods, setMethods] = useState(null); const [modal, setModal] = useState(false);
  const [f, setF] = useState({ type: "Visa", last4: "", month: "", year: "", isDefault: false });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const load = useCallback(async () => { const d = await api(`/payment?uuid=${uuid}`, "GET", null, token); setMethods(d.methods || []); }, [uuid, token]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setLoading(true);
    await api("/payment", "POST", { passengerUuid: uuid, cardType: f.type, lastFour: f.last4, expiryMonth: parseInt(f.month) || null, expiryYear: parseInt(f.year) || null, isDefault: f.isDefault }, token);
    setModal(false); setF({ type: "Visa", last4: "", month: "", year: "", isDefault: false }); await load(); setLoading(false);
  };
  const cardGradient = type => {
    if (type === "Amex") return "linear-gradient(135deg,#0C6E4E,#1A9E75)";
    if (type === "Mastercard") return "linear-gradient(135deg,#EB5757,#B33A3A)";
    return "linear-gradient(135deg,#4F46E5,#7C3AED)";
  };
  return (
    <div className="fade-up">
      <div className="ph">
        <div><div className="ptitle">Payment & settlement</div><div className="psub">IATA PAX · BSP tokenisation · PCI-DSS Level 1 compliant</div></div>
        <button className="btn btn-p" onClick={() => setModal(true)}>+ Add card</button>
      </div>
      {!methods ? <div className="loading"><div className="spinner"></div>Loading payment methods…</div> : methods.length === 0 ?
        <Empty icon="💳" title="No payment methods" sub="Add a BSP-tokenised payment card. Your card details are never stored — only secure tokens are used for airline settlement." onAdd={() => setModal(true)} addLabel="+ Add card" /> : (
          <div className="g2">{methods.map(m => (
            <div key={m.id} style={{ background: cardGradient(m.card_type), borderRadius: "var(--r-xl)", padding: 24, color: "#fff", position: "relative", overflow: "hidden" }}>
              {m.is_default && <div style={{ position: "absolute", top: 14, right: 14 }}><span style={{ background: "rgba(255,255,255,0.2)", borderRadius: "var(--r-pill)", padding: "3px 10px", fontSize: 10, fontWeight: 700 }}>DEFAULT</span></div>}
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 20, fontFamily: "var(--mono)" }}>{m.card_type}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 20, letterSpacing: 5, marginBottom: 20 }}>•••• •••• •••• {m.last_four}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.85 }}>
                <div><div style={{ opacity: 0.6, marginBottom: 2, fontSize: 10 }}>Expires</div>{m.expiry_month}/{m.expiry_year}</div>
                <div style={{ textAlign: "right" }}><div style={{ opacity: 0.6, marginBottom: 2, fontSize: 10 }}>BSP token</div><div style={{ fontSize: 9, fontFamily: "var(--mono)", opacity: 0.7, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{m.bsp_token}</div></div>
              </div>
            </div>
          ))}</div>
        )}
      {modal && <Modal title="Add payment card" onClose={() => setModal(false)} onSubmit={save} loading={loading}>
        <div className="field"><label>Card type</label><select value={f.type} onChange={set("type")}><option>Visa</option><option>Mastercard</option><option>Amex</option><option>Diners Club</option><option>UnionPay</option></select></div>
        <div className="field"><label>Last 4 digits</label><input value={f.last4} onChange={set("last4")} placeholder="4821" maxLength={4} /></div>
        <div className="g2f">
          <div className="field"><label>Expiry month</label><input type="number" value={f.month} onChange={set("month")} placeholder="09" min={1} max={12} /></div>
          <div className="field"><label>Expiry year</label><input type="number" value={f.year} onChange={set("year")} placeholder="2027" min={2024} max={2040} /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, padding: "12px 0", borderTop: "1px solid var(--border)" }}>
          <button className={`toggle ${f.isDefault ? "t-on" : "t-off"}`} onClick={() => setF(p => ({ ...p, isDefault: !p.isDefault }))}></button>
          <div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Set as default payment method</div><div style={{ fontSize: 11, color: "var(--muted)" }}>Used for all BSP settlements</div></div>
        </div>
      </Modal>}
    </div>
  );
}

function Baggage({ uuid, token }) {
  const [events, setEvents] = useState(null); const [modal, setModal] = useState(false);
  const [f, setF] = useState({ tagId: "", flight: "", type: "CHECK_IN", location: "", status: "checked-in" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const load = useCallback(async () => { const d = await api(`/baggage?uuid=${uuid}`, "GET", null, token); setEvents(d.events || []); }, [uuid, token]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setLoading(true);
    await api("/baggage", "POST", { passengerUuid: uuid, tagId: f.tagId, flightNumber: f.flight, eventType: f.type, location: f.location, status: f.status }, token);
    setModal(false); setF({ tagId: "", flight: "", type: "CHECK_IN", location: "", status: "checked-in" }); await load(); setLoading(false);
  };
  return (
    <div className="fade-up">
      <div className="ph">
        <div><div className="ptitle">BagJourney tracking</div><div className="psub">IATA Resolution 753 · RFID real-time · WorldTracer integrated</div></div>
        <button className="btn btn-p" onClick={() => setModal(true)}>+ Track bag</button>
      </div>
      {!events ? <div className="loading"><div className="spinner"></div>Loading baggage events…</div> : events.length === 0 ?
        <Empty icon="🧳" title="No baggage tracked" sub="Add a bag tag number to start real-time RFID tracking. IATA Resolution 753 compliant across all partner airlines." onAdd={() => setModal(true)} addLabel="+ Track first bag" /> : (
          <div className="card"><table className="tbl">
            <thead><tr><th>Tag ID</th><th>Flight</th><th>Event</th><th>Location</th><th>Status</th><th>Timestamp</th></tr></thead>
            <tbody>{events.map(e => (
              <tr key={e.id}>
                <td><span className="mono acc" style={{ fontSize: 11 }}>{e.tag_id}</span></td>
                <td><span className="badge bb">{e.flight_number || "—"}</span></td>
                <td><span className="badge bp">{e.event_type}</span></td>
                <td style={{ fontSize: 12 }}>{e.location || "—"}</td>
                <td><span className={`badge ${e.status === "Delivered" ? "bg" : e.status === "In-flight" ? "bb" : "bw"}`}>{e.status}</span></td>
                <td className="mono" style={{ fontSize: 10 }}>{new Date(e.event_timestamp).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      {modal && <Modal title="Track baggage" onClose={() => setModal(false)} onSubmit={save} loading={loading}>
        <div className="g2f">
          <div className="field"><label>Bag tag ID</label><input value={f.tagId} onChange={set("tagId")} placeholder="AC847291" /></div>
          <div className="field"><label>Flight number</label><input value={f.flight} onChange={set("flight")} placeholder="EK521" /></div>
        </div>
        <div className="field"><label>Event type</label><select value={f.type} onChange={set("type")}><option value="CHECK_IN">Check-in</option><option value="LOAD">Loaded onto aircraft</option><option value="TRANSFER">Transfer</option><option value="DELIVER">Delivered to belt</option></select></div>
        <div className="field"><label>Location</label><input value={f.location} onChange={set("location")} placeholder="IAD T2 Belt 7" /></div>
        <div className="field"><label>Status</label><select value={f.status} onChange={set("status")}><option value="checked-in">Checked in</option><option value="In-flight">In-flight</option><option value="Transferred">Transferred</option><option value="Delivered">Delivered</option></select></div>
      </Modal>}
    </div>
  );
}

function Consent({ uuid, token }) {
  const [grants, setGrants] = useState(null); const [modal, setModal] = useState(false);
  const [f, setF] = useState({ org: "", type: "AIRLINE", scope: "" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const load = useCallback(async () => { const d = await api(`/consent?uuid=${uuid}`, "GET", null, token); setGrants(d.grants || []); }, [uuid, token]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    if (!f.org || !f.scope) return;
    setLoading(true);
    await api("/consent", "POST", { passengerUuid: uuid, organisation: f.org, organisationType: f.type, dataScope: f.scope }, token);
    setModal(false); setF({ org: "", type: "AIRLINE", scope: "" }); await load(); setLoading(false);
  };
  const revoke = async (id) => { await api(`/consent/${id}`, "DELETE", null, token); await load(); };
  const orgPresets = ["Emirates Airlines", "Amex GBT", "Singapore Airlines", "Changi Airport", "Sabre GDS", "Amadeus", "BCD Travel", "Navan", "CWT"];
  const active = grants?.filter(g => g.status === "active") || [];
  const revoked = grants?.filter(g => g.status === "revoked") || [];
  return (
    <div className="fade-up">
      <div className="ph">
        <div><div className="ptitle">Consent engine</div><div className="psub">GDPR Art. 7 · CCPA · IATA Resolution 787 · Granular data control</div></div>
        <button className="btn btn-p" onClick={() => setModal(true)}>+ Grant consent</button>
      </div>
      {grants && grants.length > 0 && (
        <div className="g3" style={{ marginBottom: 20 }}>
          <div className="stat stat-emerald"><div className="slbl">Active consents</div><div className="sval">{active.length}</div><div className="ssub">Live data sharing</div></div>
          <div className="stat stat-gray"><div className="slbl">Revoked</div><div className="sval">{revoked.length}</div><div className="ssub">Access terminated</div></div>
          <div className="stat stat-indigo"><div className="slbl">Total grants</div><div className="sval">{grants.length}</div><div className="ssub">Across all providers</div></div>
        </div>
      )}
      {!grants ? <div className="loading"><div className="spinner"></div>Loading consent grants…</div> : grants.length === 0 ?
        <Empty icon="🔒" title="No consent grants" sub="Grant data sharing consent to airlines, TMCs, and airports. Every consent is GDPR-compliant, granular, and revocable at any time." onAdd={() => setModal(true)} addLabel="+ Grant first consent" /> : (
          <div className="card">
            <div className="ctitle">Active data sharing consents</div>
            {grants.map(g => (
              <div key={g.id} className="consent-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, color: "var(--ink)" }}>{g.organisation}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{g.data_scope}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="badge bm" style={{ fontSize: 10 }}>{g.organisation_type}</span>
                    <span style={{ fontSize: 11, color: "var(--hint)", fontFamily: "var(--mono)" }}>Granted {new Date(g.granted_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span className={`badge ${g.status === "active" ? "bg" : "bm"}`}>{g.status}</span>
                  {g.status === "active" && <button className="btn btn-sm btn-d" onClick={() => revoke(g.id)}>Revoke</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="ctitle">Consent audit trail</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 2.2 }}>
          {grants?.filter(g => g.status === "active").map(g => <div key={g.id} style={{ color: "var(--muted)" }}><span style={{ color: "var(--emerald)", fontWeight: 600 }}>GRANT</span> · {g.organisation} · {g.organisation_type} · {new Date(g.granted_at).toLocaleDateString()}</div>)}
          {grants?.filter(g => g.status === "revoked").map(g => <div key={g.id} style={{ color: "var(--muted)" }}><span style={{ color: "var(--rose)", fontWeight: 600 }}>REVOKE</span> · {g.organisation} · {new Date(g.revoked_at || g.granted_at).toLocaleDateString()}</div>)}
          {(!grants || grants.length === 0) && <div style={{ color: "var(--hint)" }}>No consent events yet</div>}
        </div>
      </div>
      {modal && <Modal title="Grant data consent" onClose={() => setModal(false)} onSubmit={save} loading={loading} submitLabel="Grant consent">
        <div className="field"><label>Organisation</label>
          <input value={f.org} onChange={set("org")} placeholder="Emirates Airlines" list="org-list" />
          <datalist id="org-list">{orgPresets.map(o => <option key={o} value={o} />)}</datalist>
        </div>
        <div className="field"><label>Organisation type</label><select value={f.type} onChange={set("type")}><option value="AIRLINE">Airline</option><option value="TMC">TMC</option><option value="AIRPORT">Airport</option><option value="GDS">GDS</option><option value="HOTEL">Hotel</option></select></div>
        <div className="field"><label>Data scope</label><textarea value={f.scope} onChange={set("scope")} placeholder="e.g. Profile, loyalty status, meal preferences, seat preferences, travel history" /></div>
        <div className="info-box">This consent is GDPR Article 7 compliant. You can revoke it at any time from this screen.</div>
      </Modal>}
    </div>
  );
}

function SeatAncillary({ passenger }) {
  return (
    <div className="fade-up">
      <div className="ph"><div><div className="ptitle">Seat & ancillary</div><div className="psub">EMD-S · IATA PADIS · Personalised upsell engine</div></div></div>
      <div className="card">
        <div className="ctitle">Your preferences — auto-applied to NDC offers</div>
        <div className="g2">
          <div>
            <div className="fr"><span className="fl">Seat preference</span><span className="fv">{passenger?.seat_preference || "Not set"}</span></div>
            <div className="fr"><span className="fl">Cabin class</span><span className="fv">{passenger?.cabin_preference || "Not set"}</span></div>
          </div>
          <div>
            <div className="fr"><span className="fl">Meal code</span><span className="fv">{passenger?.meal_preference || "Not set"}</span></div>
            <div className="fr"><span className="fl">Lounge access</span><span className="fv">{passenger?.lounge_access ? "Yes" : "No"}</span></div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="ctitle">How ancillary services work</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[["1","Profile enrichment","Your UniProfile UUID is sent with the NDC offer request when booking via a connected airline or TMC."],["2","Automatic preference injection","Your seat, meal, and cabin preferences are automatically applied to the offer — no re-entry needed."],["3","EMD-S issuance","Ancillary services (upgrades, extra bags, lounge passes) are issued as Electronic Miscellaneous Documents."],["4","OneOrder consolidation","All ancillaries are consolidated into your OneOrder record, linked to your UUID."]].map(([num, title, desc]) => (
            <div key={num} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ background: "var(--indigo)", color: "#fff", borderRadius: "var(--r-md)", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--display)", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{num}</div>
              <div><div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", marginBottom: 2 }}>{title}</div><div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{desc}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Disruption() {
  return (
    <div className="fade-up">
      <div className="ph"><div><div className="ptitle">Disruption & reprotection</div><div className="psub">EU261 · DOT 14 CFR 250 · Montreal Convention</div></div></div>
      <Empty icon="⚡" title="No disruptions" sub="When a connected airline detects a disruption affecting your booking, the UniProfile reprotection engine automatically assesses rebooking options using your preferences and triggers compensation where applicable." />
      <div className="card">
        <div className="ctitle">Regulatory coverage</div>
        <div className="g3">
          {[["EU 261/2004","Europe · Delay, cancellation & denied boarding compensation up to €600","var(--indigo-xlight)","var(--indigo)"],["DOT 14 CFR 250","United States · Involuntary denied boarding compensation","var(--emerald-xlight)","var(--emerald)"],["Montreal Convention","International · Liability for delay, baggage loss, and personal injury","var(--amber-xlight)","var(--amber)"]].map(([t,d,bg,col]) => (
            <div key={t} style={{ background: bg, borderRadius: "var(--r-xl)", padding: 18, border: `1px solid ${col}33` }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: col, marginBottom: 8, fontWeight: 600 }}>{t}</div>
              <div style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.6 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="ctitle">Reprotection pipeline</div>
        <div style={{ display: "flex", gap: 0 }}>
          {["Detect disruption","Assess options","Apply prefs","Execute","Notify + compensate"].map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", position: "relative" }}>
              <div style={{ background: i < 4 ? "var(--indigo-xlight)" : "var(--emerald-xlight)", border: `1px solid ${i < 4 ? "var(--indigo-surface)" : "#A7F3D0"}`, borderRadius: "var(--r-lg)", padding: "14px 8px", margin: "0 3px", fontSize: 11, fontWeight: 600, color: i < 4 ? "var(--indigo)" : "var(--emerald)" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 8, opacity: 0.6, marginBottom: 4, letterSpacing: 1 }}>STEP {i + 1}</div>{s}
              </div>
              {i < 4 && <div style={{ position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 18, zIndex: 1 }}>›</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Biometrics({ passenger }) {
  return (
    <div className="fade-up">
      <div className="ph"><div><div className="ptitle">Profile & biometrics</div><div className="psub">FRT · FIDO2/WebAuthn · NFC ePassport · ICAO 9303</div></div></div>
      <div className="g3" style={{ marginBottom: 18 }}>
        {[{ key: "frt_enrolled", label: "Face recognition", sub: "ICAO 9303 · ISO/IEC 19794-5", icon: "👁" },{ key: "fido2_enrolled", label: "Fingerprint / FIDO2", sub: "W3C WebAuthn · FIDO Alliance", icon: "🔑" },{ key: "nfc_enrolled", label: "ePassport NFC", sub: "ISO 14443 · ICAO Doc 9303", icon: "📘" }].map(b => (
          <div key={b.key} className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: passenger?.[b.key] ? "var(--emerald-xlight)" : "var(--bg)", border: `2px solid ${passenger?.[b.key] ? "var(--emerald)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 14px" }}>{b.icon}</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 15, marginBottom: 5, color: "var(--ink)" }}>{b.label}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>{b.sub}</div>
            <span className={`badge ${passenger?.[b.key] ? "bg" : "bw"}`}>{passenger?.[b.key] ? "✓ Enrolled" : "Pending enrollment"}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="ctitle">Enrollment & privacy</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>Biometric enrollment is available at partner airports (SITA, NEC, Vision-Box) and via the UniProfile mobile app. Your biometric data is never stored in raw form — only encrypted cryptographic tokens are retained, compliant with ICAO 9303 and GDPR Article 9.</div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "⬡", section: "overview" },
  { id: "order", label: "Offer & Order", icon: "✈", section: "oneorder" },
  { id: "seat", label: "Seat & Ancillary", icon: "💺", section: "oneorder" },
  { id: "disruption", label: "Disruption", icon: "⚡", section: "oneorder" },
  { id: "loyalty", label: "Loyalty", icon: "⭐", section: "oneorder" },
  { id: "payment", label: "Payment", icon: "💳", section: "oneorder" },
  { id: "baggage", label: "BagJourney", icon: "🧳", section: "oneorder" },
  { id: "biometrics", label: "Biometrics", icon: "👁", section: "identity" },
  { id: "consent", label: "Consent engine", icon: "🔒", section: "identity" },
];

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(null);
  const [uuid, setUuid] = useState(null);
  const [passenger, setPassenger] = useState(null);
  const [setupDone, setSetupDone] = useState(false);
  const [active, setActive] = useState("dashboard");
  const [context, setContext] = useState("bleisure");
  const [prefill, setPrefill] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingProfile(true);
    api(`/passengers/by-email?email=${encodeURIComponent(user.email)}`, "GET", null, user.token)
      .then(d => { if (d.passenger) { setPassenger(d.passenger); setUuid(d.passenger.uuid); setSetupDone(true); } })
      .catch(() => {}).finally(() => setLoadingProfile(false));
  }, [user]);

  const handleLogin = u => setUser(u);
  const handleSwitch = (mode, email = "") => { setAuthMode(mode); if (email) setPrefill(email); };
  const handleSetupComplete = (newUuid, passengerData) => { setUuid(newUuid); setSetupDone(true); if (passengerData) setPassenger(passengerData); };
  const handleSignOut = () => { setUser(null); setUuid(null); setPassenger(null); setSetupDone(false); setActive("dashboard"); };
  const handleRefresh = () => {
    if (!user) return;
    api(`/passengers/by-email?email=${encodeURIComponent(user.email)}`, "GET", null, user.token)
      .then(d => { if (d.passenger) { setPassenger(d.passenger); setUuid(d.passenger.uuid); } });
  };

  if (!user) {
    if (authMode === "signup") return <><style>{CSS}</style><SignUpPage onSwitch={handleSwitch} /></>;
    return <><style>{CSS}</style><LoginPage onLogin={handleLogin} onSwitch={handleSwitch} prefill={prefill} /></>;
  }
  if (loadingProfile) return (
    <><style>{CSS}</style>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="loading"><div className="spinner"></div>Loading your UniProfile…</div>
      </div>
    </>
  );
  if (!setupDone) return <><style>{CSS}</style><SetupWizard user={user} onComplete={handleSetupComplete} /></>;

  const PAGES = {
    dashboard: <Dashboard passenger={passenger} uuid={uuid} onRefresh={handleRefresh} />,
    order: <Orders uuid={uuid} token={user.token} />,
    seat: <SeatAncillary passenger={passenger} />,
    disruption: <Disruption />,
    loyalty: <Loyalty uuid={uuid} token={user.token} />,
    payment: <Payment uuid={uuid} token={user.token} />,
    baggage: <Baggage uuid={uuid} token={user.token} />,
    biometrics: <Biometrics passenger={passenger} />,
    consent: <Consent uuid={uuid} token={user.token} />,
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="logo-area">
            <div className="logotype">Uni<span>Profile</span></div>
            <div className="logo-sub">IATA OneOrder · v2.0</div>
          </div>
          {uuid && (
            <div className="uuid-chip">
              <div className="uuid-lbl">Passenger UUID v7</div>
              <div className="uuid-val">{uuid}</div>
            </div>
          )}
          <div className="ctx-row">
            {["business", "bleisure", "leisure"].map(c => (
              <button key={c} className={`ctx-btn ${context === c ? "on" : ""}`} onClick={() => setContext(c)}>
                {c.charAt(0).toUpperCase() + c.slice(1, 4)}
              </button>
            ))}
          </div>
          {[{ id: "overview", label: "Overview" }, { id: "oneorder", label: "OneOrder modules" }, { id: "identity", label: "Identity" }].map(section => (
            <div key={section.id}>
              <div className="nav-sec">{section.label}</div>
              {NAV_ITEMS.filter(n => n.section === section.id).map(n => (
                <div key={n.id} className={`nav-item ${active === n.id ? "on" : ""}`} onClick={() => setActive(n.id)}>
                  <div className="nav-icon">{n.icon}</div>
                  {n.label}
                </div>
              ))}
            </div>
          ))}
          <div className="sidebar-foot">
            <div className="user-pill">
              <div className="user-avatar">{initials(user.email)}</div>
              <div className="user-email">{user.email}</div>
            </div>
            <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
          </div>
        </aside>
        <main className="main">{PAGES[active]}</main>
      </div>
    </>
  );
}
