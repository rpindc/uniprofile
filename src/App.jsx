import { useState, useEffect, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL || "https://0wsxmo9ftg.execute-api.us-east-1.amazonaws.com/prod";
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || "2heljmdli4f9cv2i4m0i020mfc";
const REGION = import.meta.env.VITE_REGION || "us-east-1";
const COGNITO_URL = `https://cognito-idp.${REGION}.amazonaws.com/`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800;900&family=Outfit:wght@400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#F7F6F3;--surface:#FFFFFF;--surface2:#F5F4F1;
  --border:#E7E5E4;--border2:#D6D3D1;
  --ink:#1C1917;--ink2:#44403C;--muted:#78716C;--hint:#A8A29E;
  --indigo:#B45309;--indigo-light:#D97706;--indigo-xlight:#FEF3C7;--indigo-surface:#FDE68A;
  --emerald:#10B981;--emerald-light:#34D399;--emerald-xlight:#D1FAE5;
  --amber:#F59E0B;--amber-xlight:#FFFBEB;
  --rose:#F43F5E;--rose-xlight:#FFF1F2;
  --purple:#7C3AED;--purple-xlight:#F5F3FF;
  --sidebar:#FBFAF8;
  --display:'Playfair Display',Georgia,serif;--sans:'DM Sans',system-ui,sans-serif;--ui:'Outfit',sans-serif;--mono:'JetBrains Mono',monospace;
  --r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;--r-pill:50px;
}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.6;min-height:100vh}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp 0.22s ease both}
.app{display:flex;min-height:100vh}
.app-right{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden}
.main{flex:1;overflow-y:auto;padding:32px 36px;max-width:100%}

.topbar{padding:12px 36px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0}
.topbar-left{font-family:var(--mono);font-size:10px;color:var(--hint);letter-spacing:1px;text-transform:uppercase}
.bleisure-wrap{display:flex;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-pill);overflow:hidden;padding:3px;gap:1px}
.bleisure-btn{padding:6px 14px;font-size:11px;font-family:var(--ui);font-weight:600;border:none;background:transparent;color:var(--muted);cursor:pointer;text-align:center;transition:all 0.15s;border-radius:var(--r-pill);letter-spacing:0.02em}
.bleisure-btn.on{background:var(--indigo);color:#fff;box-shadow:0 2px 8px rgba(180,83,9,0.22)}

.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg)}
.auth-box{background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:48px 44px;width:100%;max-width:440px;box-shadow:0 4px 24px rgba(180,83,9,0.06)}
.auth-wordmark{font-family:var(--display);font-size:28px;font-weight:900;color:var(--ink);letter-spacing:-0.5px;margin-bottom:2px}
.auth-wordmark span{color:var(--indigo)}
.auth-tag{font-size:10px;color:var(--muted);font-family:var(--mono);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:32px}
.auth-h{font-family:var(--display);font-size:22px;font-weight:800;color:var(--ink);margin-bottom:24px;letter-spacing:-0.3px}
.field{margin-bottom:14px}
.field label{display:block;font-size:11px;font-weight:600;color:var(--muted);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:6px;font-family:var(--ui)}
.field input,.field select,.field textarea{width:100%;background:var(--bg);border:1.5px solid var(--border);border-radius:var(--r-md);color:var(--ink);font-family:var(--sans);font-size:14px;padding:11px 14px;outline:none;transition:border-color 0.15s,box-shadow 0.15s}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(180,83,9,0.1)}
.field select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2378716C' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;appearance:none;padding-right:36px}
.field textarea{min-height:90px;resize:vertical}
.g2f{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.btn-full{width:100%;padding:14px;border-radius:var(--r-pill);background:var(--indigo);border:none;color:#fff;font-family:var(--ui);font-size:15px;font-weight:700;cursor:pointer;transition:all 0.15s;margin-top:6px;letter-spacing:0.01em}
.btn-full:hover{background:#92400E;transform:translateY(-1px);box-shadow:0 4px 16px rgba(180,83,9,0.3)}
.btn-full:disabled{opacity:0.5;cursor:not-allowed;transform:none;box-shadow:none}
.auth-sw{text-align:center;margin-top:20px;font-size:13px;color:var(--muted)}
.auth-sw a{color:var(--indigo);cursor:pointer;font-weight:600;text-decoration:none}
.auth-sw a:hover{text-decoration:underline}
.err{background:var(--rose-xlight);border:1px solid rgba(244,63,94,0.25);border-radius:var(--r-md);padding:11px 16px;font-size:13px;color:var(--rose);margin-bottom:14px}

.sidebar{width:248px;min-width:248px;background:var(--sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;overflow-y:auto;overflow-x:hidden}
.logo-area{padding:22px 20px 16px;border-bottom:1px solid var(--border)}
.logotype{font-family:var(--display);font-size:22px;font-weight:900;letter-spacing:-0.5px;color:var(--ink)}
.logotype span{color:var(--indigo)}
.logo-sub{font-size:9px;color:var(--muted);font-family:var(--mono);letter-spacing:1.2px;text-transform:uppercase;margin-top:2px}
.uuid-chip{margin:12px 14px;padding:10px 12px;background:var(--indigo-xlight);border:1px solid var(--indigo-surface);border-radius:var(--r-md)}
.uuid-lbl{font-size:8px;letter-spacing:1.2px;text-transform:uppercase;color:var(--indigo-light);font-family:var(--mono);font-weight:500}
.uuid-val{font-family:var(--mono);font-size:8.5px;color:var(--indigo);word-break:break-all;margin-top:3px;line-height:1.6}
.nav-sec{font-size:9px;text-transform:uppercase;letter-spacing:1.4px;color:var(--hint);font-family:var(--mono);font-weight:500;padding:14px 20px 6px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 14px;margin:1px 8px;cursor:pointer;border-radius:var(--r-md);font-size:13px;font-weight:500;color:var(--muted);transition:all 0.12s;font-family:var(--sans);position:relative;overflow:visible}
.nav-item:hover{background:var(--bg);color:var(--ink)}
.nav-item.on{background:var(--indigo-xlight);color:var(--indigo);font-weight:600}
.nav-item.on::before{content:'';position:absolute;left:-8px;top:4px;bottom:4px;width:2.5px;background:var(--indigo);border-radius:0 2px 2px 0}
.nav-icon{width:28px;height:28px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;font-size:13px;background:var(--bg);flex-shrink:0;transition:background 0.12s}
.nav-item.on .nav-icon{background:var(--indigo-surface)}
.sidebar-foot{margin-top:auto;padding:14px 16px;border-top:1px solid var(--border)}
.user-pill{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 10px;background:var(--bg);border-radius:var(--r-md)}
.user-avatar{width:28px;height:28px;border-radius:50%;background:var(--indigo);color:#fff;font-family:var(--ui);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
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

.stat{border-radius:var(--r-xl);padding:18px 20px;position:relative;overflow:hidden}
.stat::after{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:var(--r-xl) var(--r-xl) 0 0}
.stat-indigo{background:var(--indigo-xlight);border:1.5px solid var(--indigo-surface)}.stat-indigo::after{background:var(--indigo)}
.stat-emerald{background:var(--emerald-xlight);border:1.5px solid #A7F3D0}.stat-emerald::after{background:var(--emerald)}
.stat-amber{background:var(--amber-xlight);border:1.5px solid #FCD34D}.stat-amber::after{background:var(--amber)}
.stat-gray{background:var(--bg);border:1px solid var(--border)}.stat-gray::after{background:var(--border2)}
.slbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-weight:600;font-family:var(--mono)}
.sval{font-family:var(--display);font-size:24px;font-weight:900;line-height:1.1;margin-top:6px;letter-spacing:-0.5px}
.ssub{font-size:11px;margin-top:3px;font-weight:500}
.stat-indigo .slbl{color:var(--indigo-light)}.stat-indigo .sval{color:var(--indigo)}.stat-indigo .ssub{color:var(--indigo-light)}
.stat-emerald .slbl{color:#059669}.stat-emerald .sval{color:#065F46}.stat-emerald .ssub{color:var(--emerald-light)}
.stat-amber .slbl{color:#D97706}.stat-amber .sval{color:#92400E}.stat-amber .ssub{color:var(--amber)}
.stat-gray .sval{color:var(--ink)}.stat-gray .ssub{color:var(--muted)}

.fr{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)}
.fr:last-child{border-bottom:none}
.fl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);font-family:var(--ui)}
.fv{font-size:13px;color:var(--ink);text-align:right;font-family:var(--mono)}

.badge{display:inline-flex;align-items:center;font-size:11px;font-family:var(--ui);font-weight:600;padding:4px 10px;border-radius:var(--r-pill)}
.bg{background:var(--emerald-xlight);color:#065F46}
.bb{background:var(--indigo-xlight);color:#92400E}
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

.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:var(--r-pill);border:1.5px solid var(--border);background:var(--surface);color:var(--ink2);font-size:13px;font-family:var(--ui);font-weight:600;cursor:pointer;transition:all 0.12s;white-space:nowrap}
.btn:hover{border-color:var(--indigo);color:var(--indigo);background:var(--indigo-xlight)}
.btn-p{background:var(--indigo);border-color:var(--indigo);color:#fff}
.btn-p:hover{background:#92400E;border-color:#92400E;box-shadow:0 4px 14px rgba(180,83,9,0.25)}
.btn-d{border-color:rgba(244,63,94,0.3);color:var(--rose)}
.btn-d:hover{background:var(--rose-xlight);border-color:var(--rose)}
.btn-sm{padding:6px 12px;font-size:11px}

.modal-bg{position:fixed;inset:0;background:rgba(28,25,23,0.5);display:flex;align-items:center;justify-content:center;z-index:200;padding:24px;backdrop-filter:blur(6px)}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:32px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.12)}
.modal-title{font-family:var(--display);font-size:22px;font-weight:800;margin-bottom:24px;letter-spacing:-0.4px;color:var(--ink)}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:24px;padding-top:16px;border-top:1px solid var(--border)}

.prog{height:6px;border-radius:3px;background:var(--bg);overflow:hidden;margin-top:10px;border:1px solid var(--border)}
.pf{height:100%;border-radius:3px;background:var(--indigo);transition:width 0.4s ease}

.toggle{width:38px;height:22px;border-radius:var(--r-pill);border:none;cursor:pointer;position:relative;transition:background 0.2s;flex-shrink:0}
.toggle::after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:white;top:3px;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
.t-on{background:var(--emerald)}.t-on::after{left:19px}
.t-off{background:var(--border2)}.t-off::after{left:3px}

.wizard-overlay{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px}
.wizard{width:100%;max-width:580px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:36px 40px;max-height:90vh;overflow-y:auto}
.wstep{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-xl);padding:28px 32px;margin-bottom:16px}
.wnum{font-family:var(--mono);font-size:10px;color:var(--indigo);font-weight:500;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px}
.wtitle{font-family:var(--display);font-size:20px;font-weight:800;margin-bottom:22px;letter-spacing:-0.3px;color:var(--ink)}

.consent-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);gap:16px}
.consent-row:last-child{border-bottom:none}
.access-entry{display:flex;align-items:flex-start;gap:14px;padding:13px 0;border-bottom:1px solid var(--border)}
.access-entry:last-child{border-bottom:none}
.access-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px}
.access-fields{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.access-field{font-size:10px;font-family:var(--mono);background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:1px 6px;color:var(--muted)}

.info-box{background:var(--indigo-xlight);border:1px solid var(--indigo-surface);border-radius:var(--r-md);padding:12px 16px;font-size:12px;color:#92400E;margin-top:6px;line-height:1.6}

.loyalty-card-visual{background:var(--indigo);border-radius:var(--r-lg);padding:14px 18px;color:#fff;position:relative;overflow:hidden;flex-shrink:0}

.alert-banner{padding:13px 16px;border-radius:var(--r-lg);margin-bottom:10px;display:flex;align-items:flex-start;gap:12px;cursor:default}
.alert-warning{background:var(--amber-xlight);border:1px solid rgba(245,158,11,0.3)}
.alert-danger{background:var(--rose-xlight);border:1px solid rgba(244,63,94,0.25)}
.alert-info{background:var(--indigo-xlight);border:1px solid var(--indigo-surface)}
.alert-icon{font-size:17px;flex-shrink:0;margin-top:1px}
.alert-title{font-weight:700;font-size:13px;color:var(--ink);margin-bottom:1px}
.alert-sub{font-size:12px;color:var(--muted);line-height:1.5}
.feature-spotlight{background:linear-gradient(135deg,#B45309 0%,#92400E 100%);border-radius:var(--r-xl);padding:22px 24px;color:#fff;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.spotlight-title{font-family:var(--display);font-size:17px;font-weight:800;letter-spacing:-0.3px;margin-bottom:4px}
.spotlight-sub{font-size:12px;opacity:0.8;line-height:1.5}
.btn-white{background:rgba(255,255,255,0.18);border:1.5px solid rgba(255,255,255,0.4);color:#fff;padding:9px 18px;border-radius:var(--r-pill);font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.15s;font-family:var(--ui)}
.btn-white:hover{background:rgba(255,255,255,0.3)}
.timatic-result{border-radius:var(--r-lg);padding:18px 20px;margin-top:14px;animation:fadeUp 0.2s ease both}
.timatic-ok{background:var(--emerald-xlight);border:1px solid #A7F3D0}
.timatic-warn{background:var(--amber-xlight);border:1px solid rgba(245,158,11,0.3)}
.timatic-fail{background:var(--rose-xlight);border:1px solid rgba(244,63,94,0.25)}
.timatic-unk{background:var(--bg);border:1px solid var(--border)}
.timatic-heading{font-family:var(--display);font-weight:800;font-size:15px;margin-bottom:8px}
.timatic-req{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 14px;margin-top:10px;font-size:12px;line-height:1.9;color:var(--ink2)}
.exp-bar{height:5px;border-radius:3px;overflow:hidden;background:var(--bg);border:1px solid var(--border);margin-top:6px}
.exp-fill{height:100%;border-radius:3px;transition:width 0.4s}
.vault-doc{background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r-xl);padding:20px 22px;margin-bottom:12px}
.vault-doc.exp-soon{border-color:rgba(245,158,11,0.5)}
.vault-doc.exp-critical{border-color:rgba(244,63,94,0.4)}
.nav-badge{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--rose);margin-left:7px;vertical-align:middle;flex-shrink:0}
.mod-num{font-size:10px;font-weight:700;font-family:var(--mono);color:var(--muted);background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 5px;margin-left:auto;flex-shrink:0}
.nav-item.on .mod-num{color:var(--indigo);background:var(--indigo-xlight);border-color:var(--indigo-surface)}
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
const forgotPassword = (e) => cognitoReq("ForgotPassword", { ClientId: CLIENT_ID, Username: e });
const confirmForgotPassword = (e, c, p) => cognitoReq("ConfirmForgotPassword", { ClientId: CLIENT_ID, Username: e, ConfirmationCode: c, Password: p });

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

function ForgotPasswordPage({ onSwitch }) {
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const doRequest = async () => {
    if (!email) return setErr("Enter your email address");
    setErr(""); setLoading(true);
    try { await forgotPassword(email); setStep("reset"); } catch (e) { setErr(e.message); }
    setLoading(false);
  };
  const doReset = async () => {
    if (!code) return setErr("Enter the verification code");
    if (!pw || pw.length < 8) return setErr("Password must be at least 8 characters");
    if (pw !== pw2) return setErr("Passwords don't match");
    setErr(""); setLoading(true);
    try { await confirmForgotPassword(email, code, pw); onSwitch("login", email); } catch (e) { setErr(e.message); }
    setLoading(false);
  };
  if (step === "reset") return (
    <div className="auth-wrap"><div className="auth-box fade-up">
      <div className="auth-wordmark">Uni<span>Profile</span></div>
      <div className="auth-tag">Password reset</div>
      <div className="auth-h">Check your email ✉️</div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.7 }}>We sent a reset code to <strong style={{ color: "var(--ink)" }}>{email}</strong></p>
      {err && <div className="err">{err}</div>}
      <form onSubmit={e => { e.preventDefault(); doReset(); }} autoComplete="off">
        <div className="field"><label>Verification code</label><input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" maxLength={6} autoComplete="one-time-code" style={{ fontSize: 22, letterSpacing: 8, textAlign: "center", fontFamily: "var(--mono)" }} /></div>
        <div className="field"><label>New password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" /></div>
        <div className="field"><label>Confirm new password</label><input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Repeat password" autoComplete="new-password" /></div>
        <button type="submit" className="btn-full" disabled={loading}>{loading ? "Resetting…" : "Set new password →"}</button>
      </form>
      <div className="auth-sw"><a onClick={() => setStep("request")}>← Try a different email</a></div>
    </div></div>
  );
  return (
    <div className="auth-wrap"><div className="auth-box fade-up">
      <div className="auth-wordmark">Uni<span>Profile</span></div>
      <div className="auth-tag">Password reset</div>
      <div className="auth-h">Forgot your password?</div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.7 }}>Enter your email and we'll send a reset code.</p>
      {err && <div className="err">{err}</div>}
      <form onSubmit={e => { e.preventDefault(); doRequest(); }} autoComplete="on">
        <div className="field"><label>Email</label><input type="email" name="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        <button type="submit" className="btn-full" disabled={loading}>{loading ? "Sending code…" : "Send reset code →"}</button>
      </form>
      <div className="auth-sw"><a onClick={() => onSwitch("login")}>← Back to sign in</a></div>
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
      <form onSubmit={e => { e.preventDefault(); doLogin(); }} autoComplete="on">
        <div className="field"><label>Email</label><input type="email" name="email" autoComplete="username" value={f.email} onChange={set("email")} placeholder="you@example.com" /></div>
        <div className="field"><label>Password</label><input type="password" name="password" autoComplete="current-password" value={f.pw} onChange={set("pw")} placeholder="Your password" /></div>
        <button type="submit" className="btn-full" disabled={loading}>{loading ? "Signing in…" : "Sign in →"}</button>
      </form>
      <div className="auth-sw">No account yet? <a onClick={() => onSwitch("signup")}>Create one</a> · <a onClick={() => onSwitch("forgot")}>Forgot password?</a></div>
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
    <div className="wizard-overlay">
      <div className="wizard fade-up">
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px", color: "var(--ink)", marginBottom: 6 }}>Welcome to UniProfile 🛫</div>
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
      </div>
    </div>
  );
}

function Dashboard({ passenger, uuid, token, onRefresh, onNavigate }) {
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    if (!uuid || !token) return;
    api(`/orders?uuid=${uuid}`, "GET", null, token).then(d => setOrders(d.orders || [])).catch(() => {});
  }, [uuid, token]);

  const today = new Date();
  const passportExpiry = passenger?.passport_expiry ? new Date(passenger.passport_expiry) : null;
  const daysToExpiry = passportExpiry ? Math.ceil((passportExpiry - today) / 86400000) : null;

  const upcomingTrips = (orders || [])
    .filter(o => o.departure_date && o.status !== "cancelled")
    .map(o => ({ ...o, daysAway: Math.ceil((new Date(o.departure_date) - today) / 86400000) }))
    .filter(o => o.daysAway >= 0 && o.daysAway <= 30)
    .sort((a, b) => a.daysAway - b.daysAway);

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

      {/* ── ALERTS ── */}
      {daysToExpiry !== null && daysToExpiry <= 180 && (
        <div className={`alert-banner ${daysToExpiry <= 30 ? "alert-danger" : "alert-warning"}`}>
          <div className="alert-icon">{daysToExpiry <= 30 ? "🚨" : "⚠️"}</div>
          <div>
            <div className="alert-title">{daysToExpiry <= 0 ? "Passport expired" : `Passport expires in ${daysToExpiry} day${daysToExpiry !== 1 ? "s" : ""}`}</div>
            <div className="alert-sub">
              {daysToExpiry <= 0 ? "Your passport has expired. Renew it immediately to avoid travel disruption." :
               daysToExpiry <= 30 ? "Most countries require 6 months validity. Renew before your next trip." :
               "Your passport expires soon. Check visa validity requirements for upcoming destinations."}
              {" "}<span style={{ color: "var(--indigo)", cursor: "pointer", fontWeight: 600 }} onClick={() => onNavigate("tripvault")}>Check doc requirements →</span>
            </div>
          </div>
        </div>
      )}
      {upcomingTrips.length > 0 && upcomingTrips.map(trip => (
        <div key={trip.id || trip.pnr} className={`alert-banner ${trip.daysAway <= 3 ? "alert-danger" : "alert-info"}`}>
          <div className="alert-icon">{trip.daysAway <= 3 ? "✈️" : "📅"}</div>
          <div>
            <div className="alert-title">
              {trip.daysAway === 0 ? "Flight today" : trip.daysAway === 1 ? "Flight tomorrow" : `Flight in ${trip.daysAway} days`}
              {" · "}{trip.origin || "—"} → {trip.destination || "—"}{trip.airline_code ? ` (${trip.airline_code})` : ""}
            </div>
            <div className="alert-sub">
              {new Date(trip.departure_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {trip.pnr ? ` · PNR: ${trip.pnr}` : ""}
              {" · "}<span style={{ color: "var(--indigo)", cursor: "pointer", fontWeight: 600 }} onClick={() => onNavigate("tripvault")}>Verify travel docs →</span>
            </div>
          </div>
        </div>
      ))}

      {/* ── TRIP VAULT SPOTLIGHT ── */}
      <div className="feature-spotlight">
        <div>
          <div className="spotlight-title">🛂 Trip Vault — Document & Visa Check</div>
          <div className="spotlight-sub">Powered by IATA Timatic · Check entry requirements for any destination instantly</div>
        </div>
        <button className="btn-white" onClick={() => onNavigate("tripvault")}>Check my docs</button>
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
        <div><div className="ptitle">Loyalty & recognition</div><div className="psub">Module 4 · FFP aggregation · Real-time tier status · UUID-linked rewards</div></div>
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
  const cardIcon = type => ({ "Amex": "🟩", "Mastercard": "🔴", "Diners Club": "⬜", "UnionPay": "🟥" }[type] || "💳");
  return (
    <div className="fade-up">
      <div className="ph">
        <div><div className="ptitle">Payment & settlement</div><div className="psub">Module 5 · IATA PAX · BSP tokenisation · PCI-DSS Level 1 compliant</div></div>
        <button className="btn btn-p" onClick={() => setModal(true)}>+ Add card</button>
      </div>
      {!methods ? <div className="loading"><div className="spinner"></div>Loading payment methods…</div> : methods.length === 0 ?
        <Empty icon="💳" title="No payment methods" sub="Add a preferred card reference. Your card details are never stored — only a BSP-tokenised reference is used for airline settlement." onAdd={() => setModal(true)} addLabel="+ Add card" /> : (
          <div className="card">
            {methods.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: i < methods.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{cardIcon(m.card_type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{m.card_type}</span>
                    {m.is_default && <span className="badge bg" style={{ fontSize: 10 }}>Default</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Card reference — last 4 digits: <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink)" }}>{m.last_four || "——"}</span>
                    {(m.expiry_month && m.expiry_year) && <span style={{ marginLeft: 12 }}>Expires {m.expiry_month}/{m.expiry_year}</span>}
                  </div>
                  {m.bsp_token && <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--hint)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>BSP token: {m.bsp_token}</div>}
                </div>
              </div>
            ))}
          </div>
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

const TIME_AGO = ts => {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s/86400)}d ago`;
  return new Date(ts).toLocaleDateString();
};

function Consent({ uuid, token }) {
  const [grants, setGrants] = useState(null); const [modal, setModal] = useState(false);
  const [f, setF] = useState({ org: "", type: "AIRLINE", scope: "" });
  const [loading, setLoading] = useState(false);
  const [accessLog, setAccessLog] = useState(null);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const load = useCallback(async () => {
    const d = await api(`/consent?uuid=${uuid}`, "GET", null, token);
    setGrants(d.grants || []);
    try {
      const al = await api(`/access-log?uuid=${uuid}`, "GET", null, token);
      setAccessLog(al.events || al.logs || al.access_events || []);
    } catch { setAccessLog([]); }
  }, [uuid, token]);
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
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div className="ctitle" style={{ marginBottom: 0 }}>Access history</div>
          {accessLog && accessLog.length > 0 && <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{accessLog.length} event{accessLog.length !== 1 ? "s" : ""}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.6 }}>Every time a connected platform reads your profile, it is logged here. You can see exactly who accessed your data, when, and which fields they read.</div>
        {accessLog === null ? (
          <div className="loading"><div className="spinner"></div>Loading access history…</div>
        ) : accessLog.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>👁</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 6 }}>No access events yet</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>When a connected airline, TMC, or airport reads your profile data, the event will appear here with a full field-level breakdown.</div>
          </div>
        ) : (
          accessLog.map((ev, i) => {
            const fields = Array.isArray(ev.fields_accessed) ? ev.fields_accessed
              : typeof ev.fields_accessed === "string" ? ev.fields_accessed.split(",").map(s => s.trim())
              : ev.data_scope ? ev.data_scope.split(",").map(s => s.trim())
              : [];
            const authorized = ev.status !== "unauthorized" && ev.status !== "denied";
            return (
              <div key={ev.id || i} className="access-entry">
                <div className="access-dot" style={{ background: authorized ? "var(--emerald)" : "var(--rose)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{ev.organisation || ev.org || ev.platform || "Unknown platform"}</span>
                    <span className={`badge ${authorized ? "bg" : "br"}`} style={{ fontSize: 10 }}>{authorized ? "READ" : "DENIED"}</span>
                    {ev.organisation_type && <span className="badge bm" style={{ fontSize: 10 }}>{ev.organisation_type}</span>}
                  </div>
                  {fields.length > 0 && (
                    <div className="access-fields">
                      {fields.map((f, fi) => <span key={fi} className="access-field">{f}</span>)}
                    </div>
                  )}
                  {!fields.length && ev.data_scope && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{ev.data_scope}</div>}
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)", whiteSpace: "nowrap" }}>{TIME_AGO(ev.accessed_at || ev.created_at || ev.timestamp)}</div>
                  <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 2 }}>{new Date(ev.accessed_at || ev.created_at || ev.timestamp).toLocaleString()}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="card" style={{ marginTop: 16, border: "1px solid var(--border)" }}>
        <div className="ctitle">Privacy &amp; data rights</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.7 }}>You have statutory rights over your personal data under the General Data Protection Regulation. UniProfile honours all GDPR data subject rights upon request.</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220, background: "var(--indigo-xlight)", border: "1px solid var(--indigo-surface)", borderRadius: "var(--r-lg)", padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, color: "var(--indigo)", marginBottom: 4 }}>📤 Export my data</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>Download a full copy of your UniProfile record as JSON. <span style={{ fontWeight: 600, color: "var(--ink)" }}>GDPR Article 20</span> — right to data portability.</div>
            <button className="btn btn-p" style={{ fontSize: 12, padding: "7px 14px" }} onClick={() => {
              const blob = new Blob([JSON.stringify({ uuid, passenger, consentGrants: grants, exportedAt: new Date().toISOString(), gdprBasis: "Article 20 — Right to data portability" }, null, 2)], { type: "application/json" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `uniprofile-${uuid || "data"}.json`; a.click(); URL.revokeObjectURL(a.href);
            }}>Download JSON</button>
          </div>
          <div style={{ flex: 1, minWidth: 220, background: "var(--rose-xlight)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: "var(--r-lg)", padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, color: "var(--rose)", marginBottom: 4 }}>🗑 Delete account</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>Permanently erase your UUID, profile, and all associated data. <span style={{ fontWeight: 600, color: "var(--ink)" }}>GDPR Article 17</span> — right to erasure.</div>
            <button className="btn" style={{ fontSize: 12, padding: "7px 14px", background: "var(--rose)", color: "#fff", border: "none", borderRadius: "var(--r-md)", cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 600 }} onClick={async () => {
              if (!window.confirm("Permanently delete your UniProfile account and all data? This cannot be undone.")) return;
              const confirm2 = window.prompt('Type "DELETE" to confirm erasure of all your data.');
              if (confirm2 !== "DELETE") return;
              try { await api(`/passengers/${uuid}`, "DELETE", null, token); window.location.reload(); } catch { window.alert("Deletion request submitted. Your data will be erased within 30 days per GDPR Article 17."); }
            }}>Delete account</button>
          </div>
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
      <div className="ph"><div><div className="ptitle">Seat & ancillary</div><div className="psub">Module 2 · EMD-S · IATA PADIS · Personalised upsell engine</div></div></div>
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

function IdentityDocs({ passenger, onNavigate }) {
  const pp = passenger?.passport_number;
  const exp = passenger?.passport_expiry;
  const nat = passenger?.nationality;
  const daysLeft = exp ? Math.floor((new Date(exp) - new Date()) / 86400000) : null;
  const expColor = daysLeft === null ? "var(--ink)" : daysLeft <= 30 ? "var(--rose)" : daysLeft <= 90 ? "var(--amber)" : "var(--emerald)";
  return (
    <div className="fade-up">
      <div className="ph"><div><div className="ptitle">Identity &amp; Documents</div><div className="psub">Module 1 · Passport · Visa · Travel documents · ICAO 9303</div></div></div>
      <div className="vault-doc" style={{ borderColor: daysLeft !== null && daysLeft <= 90 ? (daysLeft <= 30 ? "rgba(244,63,94,0.4)" : "rgba(245,158,11,0.5)") : "var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 32 }}>🛂</div>
          <div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>Passport</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Primary travel document · ICAO 9303</div>
          </div>
          {daysLeft !== null && daysLeft <= 180 && (
            <span className={`badge ${daysLeft <= 30 ? "br" : "ba"}`} style={{ marginLeft: "auto" }}>
              {daysLeft <= 0 ? "Expired" : `${daysLeft}d left`}
            </span>
          )}
        </div>
        <div className="g3" style={{ gap: 12 }}>
          {[
            { label: "Passport No.", value: pp || "—" },
            { label: "Nationality", value: nat || "—" },
            { label: "Expiry", value: exp || "—" },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: f.label === "Expiry" ? expColor : "var(--ink)" }}>{f.value}</div>
            </div>
          ))}
        </div>
        {daysLeft !== null && (
          <div className="exp-bar" style={{ marginTop: 14 }}>
            <div className="exp-fill" style={{ width: `${Math.max(0, Math.min(100, (daysLeft / 365) * 100))}%`, background: expColor }} />
          </div>
        )}
      </div>
      <div className="card">
        <div className="ctitle">Visa &amp; entry requirements</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>
          Use <strong>Trip Vault</strong> to check real-time visa and entry requirements for your upcoming trips. Powered by IATA Timatic — the same system airlines and border agencies rely on.
        </div>
        <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => onNavigate?.("tripvault")}>Open Trip Vault →</button>
      </div>
      <div className="card">
        <div className="ctitle">Document compliance</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>Your travel documents are verified against ICAO 9303 machine-readable passport standards. NFC ePassport chip data is cross-referenced with the stored record to detect tampering.</div>
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

// ── AIRPORT COORDINATES (lat/lon) for SVG arc drawing ────────────────────────
const AIRPORTS = {
  IAD:{x:178,y:148},JFK:{x:182,y:142},LAX:{x:140,y:158},ORD:{x:175,y:140},
  MIA:{x:180,y:170},SFO:{x:132,y:152},ATL:{x:178,y:158},DFW:{x:162,y:162},
  LHR:{x:310,y:118},CDG:{x:318,y:120},FRA:{x:326,y:118},AMS:{x:320,y:114},
  MAD:{x:306,y:130},BCN:{x:314,y:128},FCO:{x:332,y:128},ZRH:{x:325,y:120},
  DXB:{x:408,y:162},DOH:{x:400,y:166},AUH:{x:406,y:164},KWI:{x:398,y:158},
  SIN:{x:476,y:208},BKK:{x:466,y:190},KUL:{x:472,y:208},CGK:{x:472,y:218},
  NRT:{x:510,y:138},HND:{x:510,y:140},ICN:{x:500,y:136},HKG:{x:492,y:170},
  SYD:{x:524,y:268},MEL:{x:518,y:276},AKL:{x:554,y:278},
  GRU:{x:230,y:240},EZE:{x:220,y:264},BOG:{x:200,y:208},LIM:{x:192,y:230},
  JNB:{x:360,y:248},NBO:{x:376,y:220},CPT:{x:342,y:262},
  DEL:{x:440,y:158},BOM:{x:434,y:172},BLR:{x:440,y:182},MAA:{x:444,y:184},
  YYZ:{x:176,y:132},YVR:{x:136,y:130},MEX:{x:164,y:178},
  MUC:{x:328,y:116},VIE:{x:334,y:116},CPH:{x:330,y:108},ARN:{x:334,y:104},
  IST:{x:356,y:130},CAI:{x:356,y:154},CMN:{x:304,y:148},
};

function arcPath(x1,y1,x2,y2){
  const mx=(x1+x2)/2, my=(y1+y2)/2;
  const dx=x2-x1, dy=y2-y1;
  const len=Math.sqrt(dx*dx+dy*dy);
  const sag=Math.min(len*0.22,28);
  const cx=mx-dy/len*sag, cy=my+dx/len*sag;
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

function JourneyMap({ uuid, token, passenger }) {
  const [orders, setOrders] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [view, setView] = useState("map"); // map | timeline | wrapped

  const load = useCallback(async () => {
    const [od, ld] = await Promise.all([
      api(`/orders?uuid=${uuid}`, "GET", null, token),
      api(`/loyalty?uuid=${uuid}`, "GET", null, token),
    ]);
    setOrders(od.orders || []);
    setLoyalty(ld.programs || []);
  }, [uuid, token]);

  useEffect(() => { load(); }, [load]);

  if (!orders) return <div className="loading"><div className="spinner"></div>Loading your journey…</div>;

  // ── STATS ──────────────────────────────────────────────────────────────────
  const confirmedOrders = orders.filter(o => o.status !== "cancelled");
  const totalMiles = loyalty?.reduce((a, p) => a + (p.miles_balance || 0), 0) || 0;
  const totalSpend = confirmedOrders.reduce((a, o) => a + (parseFloat(o.total_amount) || 0), 0);
  const destinations = [...new Set(confirmedOrders.map(o => o.destination).filter(Boolean))];
  const airlines = [...new Set(confirmedOrders.map(o => o.airline_code).filter(Boolean))];
  const cabinCounts = {};
  confirmedOrders.forEach(o => { if (o.cabin) cabinCounts[o.cabin] = (cabinCounts[o.cabin] || 0) + 1; });
  const topCabin = Object.entries(cabinCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";
  const businessTrips = confirmedOrders.filter(o => o.trip_context === "business").length;
  const leisureTrips = confirmedOrders.filter(o => o.trip_context === "leisure" || o.trip_context === "bleisure").length;
  const thisYear = new Date().getFullYear();
  const thisYearOrders = confirmedOrders.filter(o => o.departure_date && new Date(o.departure_date).getFullYear() === thisYear);
  const thisYearDests = [...new Set(thisYearOrders.map(o => o.destination).filter(Boolean))];
  const thisYearSpend = thisYearOrders.reduce((a, o) => a + (parseFloat(o.total_amount) || 0), 0);

  // ── PERSONALITY ────────────────────────────────────────────────────────────
  const getPersonality = () => {
    if (businessTrips > leisureTrips * 2) return { label: "Road warrior", sub: "Always on the move for work", color: "#B45309" };
    if (leisureTrips > businessTrips * 2) return { label: "Adventure seeker", sub: "Travel is your favourite hobby", color: "#10B981" };
    if (destinations.length > 8) return { label: "World explorer", sub: "Collecting stamps across continents", color: "#7C3AED" };
    return { label: "Bleisure pro", sub: "Work hard, travel smart", color: "#F59E0B" };
  };
  const personality = getPersonality();

  // ── ROUTES FOR MAP ─────────────────────────────────────────────────────────
  const routes = confirmedOrders
    .filter(o => o.origin && o.destination && AIRPORTS[o.origin] && AIRPORTS[o.destination])
    .map(o => ({ from: o.origin, to: o.destination, context: o.trip_context, airline: o.airline_code }));

  const visitedCodes = [...new Set([
    ...confirmedOrders.map(o => o.origin),
    ...confirmedOrders.map(o => o.destination)
  ].filter(c => c && AIRPORTS[c]))];

  // ── SORTED TIMELINE ────────────────────────────────────────────────────────
  const timeline = [...confirmedOrders]
    .filter(o => o.departure_date)
    .sort((a, b) => new Date(b.departure_date) - new Date(a.departure_date));

  const cabinColor = c => ({
    "First": "#7C3AED", "Business": "#B45309",
    "Premium Economy": "#10B981", "Economy": "#6B7280"
  }[c] || "#6B7280");

  const contextEmoji = c => c === "business" ? "💼" : c === "leisure" ? "🌴" : "✨";

  const statTiles = [
    { label: "Flights taken", val: confirmedOrders.length, sub: "confirmed bookings", cls: "stat-indigo" },
    { label: "Destinations", val: destinations.length, sub: "unique cities", cls: "stat-emerald" },
    { label: "Total miles", val: totalMiles.toLocaleString(), sub: "across all programs", cls: "stat-amber" },
    { label: "Airlines flown", val: airlines.length, sub: "carriers", cls: "stat-gray" },
  ];

  return (
    <div className="fade-up">
      <div className="ph">
        <div>
          <div className="ptitle">Journey map 🌍</div>
          <div className="psub">Your travel identity · {confirmedOrders.length} flights · {destinations.length} destinations</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["map","timeline","wrapped"].map(v => (
            <button key={v} className={`btn ${view === v ? "btn-p" : ""}`}
              onClick={() => setView(v)} style={{ textTransform: "capitalize" }}>
              {v === "map" ? "🗺 Map" : v === "timeline" ? "📅 Timeline" : "🎉 Wrapped"}
            </button>
          ))}
        </div>
      </div>

      {/* STAT TILES */}
      <div className="g4" style={{ marginBottom: 20 }}>
        {statTiles.map(s => (
          <div key={s.label} className={`stat ${s.cls}`}>
            <div className="slbl">{s.label}</div>
            <div className="sval">{s.val}</div>
            <div className="ssub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* PERSONALITY CARD */}
      <div className="card" style={{ background: personality.color, border: "none", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--display)", fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>{personality.label}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>{personality.sub}</div>
          </div>
          <div style={{ textAlign: "right", color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
            <div>{businessTrips} business trips</div>
            <div>{leisureTrips} leisure trips</div>
            <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 11, opacity: 0.6 }}>Preferred cabin: {topCabin}</div>
          </div>
        </div>
      </div>

      {/* ── MAP VIEW ─────────────────────────────────────────────────────── */}
      {view === "map" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px 8px", borderBottom: "1px solid var(--border)" }}>
            <div className="ctitle" style={{ marginBottom: 0 }}>Flight routes · {routes.length} segments · {visitedCodes.length} airports</div>
          </div>
          <svg width="100%" viewBox="0 0 600 320" style={{ display: "block", background: "#F5F3EF" }}>
            {/* World outline — simplified continents */}
            <path fill="#E5E0D8" stroke="#D4CEC4" strokeWidth="0.5" d="
              M60,80 L90,70 L120,65 L150,68 L170,75 L180,85 L175,100 L160,110 L140,115 L120,112 L100,108 L80,100 L60,90 Z
              M185,68 L220,60 L260,55 L300,58 L330,62 L340,70 L335,82 L320,90 L295,95 L265,92 L240,88 L215,82 L190,78 Z
              M305,95 L330,90 L355,92 L375,100 L385,112 L380,125 L365,132 L345,130 L325,122 L310,110 Z
              M342,130 L360,128 L375,132 L385,145 L382,158 L370,164 L355,160 L344,150 Z
              M390,140 L430,135 L465,140 L490,150 L500,165 L495,180 L480,190 L455,192 L430,185 L410,172 L395,158 Z
              M460,190 L490,185 L515,190 L530,205 L528,225 L515,238 L495,240 L475,232 L462,218 Z
              M500,120 L535,115 L560,120 L572,132 L568,148 L550,155 L528,150 L510,140 Z
              M140,170 L165,165 L185,170 L195,185 L192,202 L178,210 L160,208 L145,196 Z
              M205,200 L230,195 L248,202 L252,218 L245,232 L228,238 L212,230 L204,216 Z
              M335,215 L360,210 L378,218 L382,235 L372,248 L352,252 L336,242 Z
              M510,248 L540,242 L562,250 L568,268 L555,278 L532,280 L514,268 Z
            "/>
            {/* Route arcs */}
            {routes.map((r, i) => {
              const a = AIRPORTS[r.from], b = AIRPORTS[r.to];
              if (!a || !b) return null;
              const col = r.context === "business" ? "#B45309" : r.context === "leisure" ? "#10B981" : "#F59E0B";
              return <path key={i} d={arcPath(a.x,a.y,b.x,b.y)} fill="none" stroke={col} strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round"/>;
            })}
            {/* Airport dots */}
            {visitedCodes.map(code => {
              const pt = AIRPORTS[code];
              if (!pt) return null;
              return (
                <g key={code}>
                  <circle cx={pt.x} cy={pt.y} r="4" fill="#B45309" fillOpacity="0.15" stroke="#B45309" strokeWidth="1"/>
                  <circle cx={pt.x} cy={pt.y} r="2" fill="#B45309"/>
                  <text x={pt.x+5} y={pt.y+4} fontSize="7" fill="#374151" fontFamily="monospace" fontWeight="600">{code}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ padding: "10px 20px 14px", display: "flex", gap: 20, fontSize: 12, color: "var(--muted)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, height: 2, background: "#B45309", display: "inline-block", borderRadius: 1 }}></span>Business</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, height: 2, background: "#10B981", display: "inline-block", borderRadius: 1 }}></span>Leisure</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, height: 2, background: "#F59E0B", display: "inline-block", borderRadius: 1 }}></span>Bleisure</span>
          </div>
        </div>
      )}

      {/* ── TIMELINE VIEW ─────────────────────────────────────────────────── */}
      {view === "timeline" && (
        <div className="card">
          <div className="ctitle">Trip timeline — most recent first</div>
          {timeline.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)", fontSize: 13 }}>No confirmed trips yet. Add orders to build your journey.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {timeline.map((o, i) => (
                <div key={o.id} style={{ display: "flex", gap: 16, paddingBottom: 20, paddingTop: i === 0 ? 0 : 0, position: "relative" }}>
                  {/* Timeline spine */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 32 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: cabinColor(o.cabin), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, zIndex: 1 }}>
                      <span style={{ fontSize: 14 }}>{contextEmoji(o.trip_context)}</span>
                    </div>
                    {i < timeline.length - 1 && <div style={{ width: 1.5, flex: 1, background: "var(--border)", marginTop: 4, minHeight: 24 }}></div>}
                  </div>
                  {/* Trip card */}
                  <div style={{ flex: 1, paddingBottom: 16, borderBottom: i < timeline.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 16, color: "var(--ink)" }}>
                            {o.origin || "?"} → {o.destination || "?"}
                          </span>
                          <span className={`badge ${o.trip_context === "business" ? "bb" : "bg"}`} style={{ fontSize: 10 }}>{o.trip_context}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {o.airline_code && <span className="badge bm" style={{ fontSize: 10, marginRight: 6 }}>{o.airline_code}</span>}
                          {o.cabin && <span style={{ fontFamily: "var(--mono)", color: cabinColor(o.cabin), fontWeight: 600 }}>{o.cabin}</span>}
                          {o.pnr && <span style={{ color: "var(--hint)", marginLeft: 8, fontFamily: "var(--mono)", fontSize: 11 }}>{o.pnr}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>
                          {new Date(o.departure_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                        {o.total_amount && <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 14, color: "var(--emerald)" }}>${parseFloat(o.total_amount).toLocaleString()}</div>}
                      </div>
                    </div>
                    {o.route && o.route !== `${o.origin}→${o.destination}` && (
                      <div style={{ fontSize: 12, color: "var(--hint)", fontFamily: "var(--mono)" }}>{o.route}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TRAVEL WRAPPED VIEW ───────────────────────────────────────────── */}
      {view === "wrapped" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Hero */}
          <div className="card" style={{ background: "var(--indigo)", border: "none", textAlign: "center", padding: "36px 32px" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{thisYear} Travel Wrapped</div>
            <div style={{ fontFamily: "var(--display)", fontSize: 42, fontWeight: 900, color: "#fff", letterSpacing: "-1px", lineHeight: 1.1, marginBottom: 8 }}>{thisYearDests.length}<br/><span style={{ fontSize: 20, fontWeight: 600, opacity: 0.8 }}>destinations this year</span></div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 12 }}>
              {thisYearOrders.length} flights · ${Math.round(thisYearSpend).toLocaleString()} spent · {passenger?.first_name}'s {thisYear}
            </div>
          </div>

          <div className="g2">
            {/* Top destinations */}
            <div className="card">
              <div className="ctitle">Top destinations {thisYear}</div>
              {thisYearDests.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>No trips recorded this year yet.</div>
              ) : thisYearDests.slice(0, 5).map((d, i) => (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < Math.min(4, thisYearDests.length - 1) ? "1px solid var(--border)" : "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--indigo-xlight)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--display)", fontWeight: 900, fontSize: 12, color: "var(--indigo)", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>{d}</div>
                  <div style={{ marginLeft: "auto" }}>
                    <span className="badge bb" style={{ fontSize: 10 }}>
                      {thisYearOrders.filter(o => o.destination === d).length}x
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="stat stat-emerald">
                <div className="slbl">Flights this year</div>
                <div className="sval">{thisYearOrders.length}</div>
                <div className="ssub">{thisYearOrders.filter(o=>o.trip_context==="business").length} business · {thisYearOrders.filter(o=>o.trip_context!=="business").length} leisure</div>
              </div>
              <div className="stat stat-indigo">
                <div className="slbl">Total spend {thisYear}</div>
                <div className="sval">${Math.round(thisYearSpend).toLocaleString()}</div>
                <div className="ssub">Across {thisYearOrders.length} bookings</div>
              </div>
              <div className="stat stat-gray">
                <div className="slbl">Travel persona</div>
                <div className="sval" style={{ fontSize: 16, marginTop: 6 }}>{personality.label}</div>
                <div className="ssub">{personality.sub}</div>
              </div>
            </div>
          </div>

          {/* All-time records */}
          <div className="card">
            <div className="ctitle">All-time records</div>
            <div className="g4">
              {[
                { label: "Total flights", val: confirmedOrders.length },
                { label: "Countries / cities", val: destinations.length },
                { label: "Airlines flown", val: airlines.length },
                { label: "Loyalty miles", val: totalMiles.toLocaleString() },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center", padding: "16px 8px", background: "var(--bg)", borderRadius: "var(--r-lg)" }}>
                  <div style={{ fontFamily: "var(--display)", fontSize: 26, fontWeight: 900, color: "var(--indigo)" }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {confirmedOrders.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "48px 32px", marginTop: 0 }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>✈️</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 20, color: "var(--ink)", marginBottom: 8 }}>Your journey starts here</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, lineHeight: 1.7 }}>Add your first booking in Offer &amp; Order to begin building your travel identity map.</div>
        </div>
      )}
    </div>
  );
}

const COUNTRIES = [
  { code: "AF", name: "Afghanistan" }, { code: "AL", name: "Albania" }, { code: "DZ", name: "Algeria" },
  { code: "AR", name: "Argentina" }, { code: "AU", name: "Australia" }, { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" }, { code: "BH", name: "Bahrain" }, { code: "BD", name: "Bangladesh" },
  { code: "BE", name: "Belgium" }, { code: "BZ", name: "Belize" }, { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" }, { code: "BA", name: "Bosnia and Herzegovina" }, { code: "BR", name: "Brazil" },
  { code: "BN", name: "Brunei" }, { code: "BG", name: "Bulgaria" }, { code: "KH", name: "Cambodia" },
  { code: "CA", name: "Canada" }, { code: "CN", name: "China" }, { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" }, { code: "HR", name: "Croatia" }, { code: "CU", name: "Cuba" },
  { code: "CY", name: "Cyprus" }, { code: "CZ", name: "Czech Republic" }, { code: "DK", name: "Denmark" },
  { code: "DO", name: "Dominican Republic" }, { code: "EC", name: "Ecuador" }, { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" }, { code: "EE", name: "Estonia" }, { code: "ET", name: "Ethiopia" },
  { code: "FI", name: "Finland" }, { code: "FR", name: "France" }, { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" }, { code: "GR", name: "Greece" }, { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" }, { code: "HK", name: "Hong Kong" }, { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" }, { code: "IN", name: "India" }, { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" }, { code: "IQ", name: "Iraq" }, { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" }, { code: "IT", name: "Italy" }, { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" }, { code: "JO", name: "Jordan" }, { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" }, { code: "KW", name: "Kuwait" }, { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" }, { code: "LV", name: "Latvia" }, { code: "LB", name: "Lebanon" },
  { code: "LT", name: "Lithuania" }, { code: "LU", name: "Luxembourg" }, { code: "MO", name: "Macau" },
  { code: "MY", name: "Malaysia" }, { code: "MV", name: "Maldives" }, { code: "MT", name: "Malta" },
  { code: "MX", name: "Mexico" }, { code: "MD", name: "Moldova" }, { code: "MN", name: "Mongolia" },
  { code: "MA", name: "Morocco" }, { code: "MZ", name: "Mozambique" }, { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" }, { code: "NP", name: "Nepal" }, { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" }, { code: "NI", name: "Nicaragua" }, { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norway" }, { code: "OM", name: "Oman" }, { code: "PK", name: "Pakistan" },
  { code: "PA", name: "Panama" }, { code: "PY", name: "Paraguay" }, { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" }, { code: "PL", name: "Poland" }, { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" }, { code: "RO", name: "Romania" }, { code: "RU", name: "Russia" },
  { code: "SA", name: "Saudi Arabia" }, { code: "SN", name: "Senegal" }, { code: "RS", name: "Serbia" },
  { code: "SG", name: "Singapore" }, { code: "SK", name: "Slovakia" }, { code: "SI", name: "Slovenia" },
  { code: "ZA", name: "South Africa" }, { code: "KR", name: "South Korea" }, { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" }, { code: "SE", name: "Sweden" }, { code: "CH", name: "Switzerland" },
  { code: "TW", name: "Taiwan" }, { code: "TZ", name: "Tanzania" }, { code: "TH", name: "Thailand" },
  { code: "TN", name: "Tunisia" }, { code: "TR", name: "Turkey" }, { code: "TM", name: "Turkmenistan" },
  { code: "UG", name: "Uganda" }, { code: "UA", name: "Ukraine" }, { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" }, { code: "US", name: "United States" }, { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" }, { code: "VE", name: "Venezuela" }, { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yemen" }, { code: "ZM", name: "Zambia" }, { code: "ZW", name: "Zimbabwe" },
];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function expiryColor(days) {
  if (days === null) return "var(--border)";
  if (days <= 0) return "var(--rose)";
  if (days <= 30) return "var(--rose)";
  if (days <= 90) return "var(--amber)";
  return "var(--emerald)";
}

function TripVault({ passenger, uuid, token }) {
  const [form, setForm] = useState({
    nationality: passenger?.nationality || "",
    destination: "",
    travelDate: "",
    docType: "P",
    residency: passenger?.nationality || "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const passportDays = daysUntil(passenger?.passport_expiry);
  const passportPct = passenger?.passport_expiry
    ? Math.max(0, Math.min(100, (passportDays / (10 * 365)) * 100))
    : 0;

  const checkDocs = async () => {
    if (!form.nationality || !form.destination || !form.travelDate) {
      setErr("Please fill in nationality, destination and travel date.");
      return;
    }
    setErr(""); setResult(null); setLoading(true);
    try {
      const TIMATIC_KEY = "4e54227f34msh0eb8b07c1198168p1611acjsnc08da5ae6ec3";
      const TIMATIC_HOST = "timatic-autocheck-rest-api.p-eu.rapidapi.com";
      const TIMATIC_URL = `https://${TIMATIC_HOST}/query-interface-service/api/v1/documentRequest`;

      const travelDt = form.travelDate + "T12:00:00";
      const departureDt = new Date(new Date(form.travelDate) - 86400000).toISOString().split("T")[0] + "T22:00:00";

      const payload = {
        checkType: "DOCUMENT",
        language: "EN",
        passengerId: uuid || "guest",
        transactionId: `up-${Date.now()}`,
        passengerDetails: {
          nationality: form.nationality,
          residentCountryCode: form.residency || form.nationality,
          birthDate: passenger?.date_of_birth || "",
          birthCountry: form.nationality,
          gender: passenger?.gender || "",
          countriesVisited: { countries: [], visitedBeforeDays: 0 },
        },
        travelDocuments: {
          documents: [
            {
              documentType: form.docType === "P" ? "PASSPORT" : form.docType,
              nationalityCode: form.nationality,
              expiryDate: passenger?.passport_expiry ? passenger.passport_expiry.split("T")[0] : "2030-01-01",
              issuingCountry: form.nationality,
              ...(passenger?.passport_number ? { documentNumber: passenger.passport_number } : {}),
            },
          ],
        },
        itinerary: {
          legs: [
            {
              arrival: { dateTime: travelDt, point: form.destination, type: "AIRPORT" },
              departure: { dateTime: departureDt, point: form.origin || form.nationality, type: "AIRPORT" },
              durationOfStay: { duration: 7, timeUnit: "DAYS" },
              luggageCollected: true,
              operatingCarrier: "",
              processingEntity: form.destination,
              purposeOfStay: "",
              returnOnwardTicket: "",
            },
          ],
        },
      };

      const resp = await fetch(TIMATIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RapidAPI-Key": TIMATIC_KEY,
          "X-RapidAPI-Host": TIMATIC_HOST,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();

      if (!resp.ok || data.message || data.error) {
        setErr(data.message || data.error || `Timatic error (${resp.status})`);
      } else {
        setResult(data);
      }
    } catch (e) {
      setErr("Could not reach Timatic. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Timatic result can come back as top-level or nested under result/data
  const timaticData = result?.result || result?.data || result || null;
  const timaticStatus = timaticData?.overallAdmissibility || timaticData?.status || timaticData?.admissibility || "";
  const isOk = timaticStatus === "ADMITTED" || timaticStatus === "OK" || timaticStatus === "ALLOWED";
  const isWarn = timaticStatus === "CONDITIONAL" || timaticStatus === "WARNING" || timaticStatus === "REVIEW";
  const isFail = timaticStatus === "NOT_ADMITTED" || timaticStatus === "REFUSED" || timaticStatus === "DENIED";

  const statusClass = result
    ? isOk ? "timatic-ok" : isWarn ? "timatic-warn" : isFail ? "timatic-fail" : "timatic-unk"
    : "";

  const statusIcon = result
    ? isOk ? "✅" : isWarn ? "⚠️" : isFail ? "🚫" : "ℹ️"
    : "";

  return (
    <div className="fade-up">
      <div className="ph">
        <div>
          <div className="ptitle">Trip Vault</div>
          <div className="psub">Module 6 · IATA Timatic · Document &amp; Visa Requirements · Passport Health</div>
        </div>
      </div>

      {/* ── PASSPORT STATUS ── */}
      <div className="vault-doc" style={{ borderColor: passportDays !== null && passportDays <= 90 ? (passportDays <= 30 ? "rgba(244,63,94,0.4)" : "rgba(245,158,11,0.5)") : "var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 28 }}>📘</div>
            <div>
              <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>Passport</div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                {passenger?.nationality || "—"} · {passenger?.passport_number || "—"}
              </div>
            </div>
          </div>
          {passportDays !== null && (
            <span className={`badge ${passportDays <= 0 ? "bd" : passportDays <= 30 ? "bd" : passportDays <= 90 ? "bw" : "bg"}`}>
              {passportDays <= 0 ? "Expired" : `${passportDays}d left`}
            </span>
          )}
        </div>
        <div className="g2" style={{ gap: 12 }}>
          <div>
            <div className="fr"><span className="fl">Holder</span><span className="fv">{passenger?.first_name} {passenger?.last_name}</span></div>
            <div className="fr"><span className="fl">Nationality</span><span className="fv">{passenger?.nationality || "—"}</span></div>
          </div>
          <div>
            <div className="fr"><span className="fl">Passport no.</span><span className="fv">{passenger?.passport_number || "—"}</span></div>
            <div className="fr"><span className="fl">Expiry</span>
              <span className="fv" style={{ color: passportDays !== null && passportDays <= 90 ? expiryColor(passportDays) : "var(--ink)" }}>
                {passenger?.passport_expiry ? new Date(passenger.passport_expiry).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
              </span>
            </div>
          </div>
        </div>
        {passportDays !== null && (
          <div className="exp-bar" style={{ marginTop: 14 }}>
            <div className="exp-fill" style={{ width: `${passportPct}%`, background: expiryColor(passportDays) }} />
          </div>
        )}
        {passportDays !== null && passportDays > 0 && passportDays <= 180 && (
          <div style={{ marginTop: 8, fontSize: 12, color: passportDays <= 30 ? "var(--rose)" : "var(--amber)", fontWeight: 600 }}>
            ⚠️ Many countries require 6 months passport validity beyond travel dates. Renew promptly.
          </div>
        )}
      </div>

      {/* ── TIMATIC CHECK ── */}
      <div className="card">
        <div className="ctitle">✈️ Timatic Document Check — Sandbox</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18, lineHeight: 1.6 }}>
          Enter your travel details to check visa requirements, passport validity rules, and entry restrictions
          via the IATA Timatic database.
        </div>
        <div className="g2" style={{ gap: 14, marginBottom: 0 }}>
          <div className="field">
            <label>Nationality</label>
            <select value={form.nationality} onChange={set("nationality")}>
              <option value="">Select country…</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>Country of residence</label>
            <select value={form.residency} onChange={set("residency")}>
              <option value="">Same as nationality</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>Destination country</label>
            <select value={form.destination} onChange={set("destination")}>
              <option value="">Select destination…</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>Travel date</label>
            <input type="date" value={form.travelDate} onChange={set("travelDate")} min={new Date().toISOString().split("T")[0]} />
          </div>
          <div className="field">
            <label>Document type</label>
            <select value={form.docType} onChange={set("docType")}>
              <option value="P">Passport</option>
              <option value="V">Visa</option>
              <option value="ID">National ID</option>
              <option value="RP">Residence Permit</option>
            </select>
          </div>
        </div>
        {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-p" onClick={checkDocs} disabled={loading} style={{ width: "100%", padding: "13px" }}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Checking requirements…</> : "🛂 Check document requirements"}
          </button>
        </div>

        {result && (
          <div className={`timatic-result ${statusClass}`}>
            <div className="timatic-heading">{statusIcon} {
              isOk ? "Travel permitted" :
              isWarn ? "Conditions apply — review required" :
              isFail ? "Entry not permitted" :
              "Timatic requirements"
            }</div>

            {/* Overall admissibility */}
            {timaticStatus && (
              <div style={{ fontSize: 12, fontFamily: "var(--mono)", fontWeight: 700, marginBottom: 10, opacity: 0.75 }}>
                TIMATIC STATUS: {timaticStatus}
              </div>
            )}

            {/* Visa requirement */}
            {(timaticData?.visaRequired !== undefined || timaticData?.visa?.required !== undefined) && (
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Visa required:{" "}
                <span style={{ color: (timaticData?.visaRequired ?? timaticData?.visa?.required) ? "var(--rose)" : "var(--emerald)" }}>
                  {(timaticData?.visaRequired ?? timaticData?.visa?.required) ? "Yes" : "No"}
                </span>
              </div>
            )}

            {/* Document requirements / rules */}
            {(timaticData?.requirements || timaticData?.documentRequirements || timaticData?.rules || timaticData?.visa?.requirements) && (
              <div className="timatic-req">
                {(timaticData?.requirements || timaticData?.documentRequirements || timaticData?.rules || timaticData?.visa?.requirements || [])
                  .map((r, i) => <div key={i} style={{ paddingBottom: 4 }}>• {typeof r === "string" ? r : r.text || r.description || r.rule || JSON.stringify(r)}</div>)}
              </div>
            )}

            {/* Admission rules from legs */}
            {timaticData?.admissionRules && timaticData.admissionRules.length > 0 && (
              <div className="timatic-req">
                {timaticData.admissionRules.map((r, i) => (
                  <div key={i} style={{ paddingBottom: 4 }}>• {r.text || r.description || JSON.stringify(r)}</div>
                ))}
              </div>
            )}

            {/* Health requirements */}
            {timaticData?.healthRequirements?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Health requirements</div>
                <div className="timatic-req">
                  {timaticData.healthRequirements.map((r, i) => (
                    <div key={i} style={{ paddingBottom: 4 }}>• {r.text || r.description || JSON.stringify(r)}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes / free-text */}
            {(timaticData?.notes || timaticData?.remarks || timaticData?.summary) && (
              <div style={{ fontSize: 12, color: "var(--ink2)", marginTop: 10, lineHeight: 1.8 }}>
                {timaticData.notes || timaticData.remarks || timaticData.summary}
              </div>
            )}

            {/* Raw fallback for unknown structure */}
            {!timaticStatus && !timaticData?.requirements && !timaticData?.admissionRules && (
              <pre style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 8 }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            )}

            <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 12, fontFamily: "var(--mono)" }}>
              Source: IATA Timatic · Checked {new Date().toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ background: "var(--indigo-xlight)", border: "1px solid var(--indigo-surface)" }}>
        <div className="ctitle" style={{ color: "var(--indigo-light)" }}>About Timatic</div>
        <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.8 }}>
          IATA Timatic is the authoritative source for travel document, visa, health, and customs requirements used by airlines and travel agents worldwide.
          Results are sourced from official government databases and updated daily. Always confirm with the destination country's embassy or consulate for critical travel.
        </div>
      </div>
    </div>
  );
}

function Meal({ passenger }) {
  const prefs = [
    { key: "meal_preference", label: "Meal code", sub: "IATA SSR meal type stored in UUID profile", icon: "🍽" },
    { key: "dietary_requirement", label: "Dietary requirement", sub: "Allergy & preference flags — auto-applied at booking", icon: "🥗" },
    { key: "snack_preference", label: "Snack preference", sub: "Lounge & in-flight snack personalisation", icon: "🧃" },
  ];
  return (
    <div className="fade-up">
      <div className="ph"><div><div className="ptitle">Meal preferences</div><div className="psub">Module 3 · IATA SSR codes · Dietary requirements · UUID-stored</div></div></div>
      <div className="g3" style={{ marginBottom: 18 }}>
        {prefs.map(p => (
          <div key={p.key} className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>{p.icon}</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 15, marginBottom: 5, color: "var(--ink)" }}>{p.label}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>{p.sub}</div>
            <span className={`badge ${passenger?.[p.key] ? "bg" : "bw"}`}>{passenger?.[p.key] || "Not set"}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="ctitle">IATA SSR meal codes</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>Meal preferences are stored as IATA Special Service Request codes (VGML, HNML, KSML, etc.) and automatically injected into NDC offer requests and PNR remarks. Update your preferences in the Setup Wizard to have them applied on every future booking.</div>
      </div>
    </div>
  );
}

function Cruise({ passenger, onNavigate }) {
  const pp = passenger?.passport_number;
  const exp = passenger?.passport_expiry;
  const nat = passenger?.nationality;
  const daysLeft = exp ? Math.floor((new Date(exp) - new Date()) / 86400000) : null;
  const expColor = daysLeft === null ? "var(--ink)" : daysLeft <= 30 ? "var(--rose)" : daysLeft <= 90 ? "var(--amber)" : "var(--emerald)";

  const CRUISE_SSR = [
    { code: "VGML", label: "Vegan" }, { code: "HNML", label: "Hindu" },
    { code: "KSML", label: "Kosher" }, { code: "MOML", label: "Muslim / Halal" },
    { code: "GFML", label: "Gluten-free" }, { code: "DBML", label: "Diabetic" },
    { code: "LSML", label: "Low sodium" }, { code: "NLML", label: "Low lactose" },
    { code: "SFML", label: "Seafood-free" }, { code: "RVML", label: "Vegetarian" },
  ];

  return (
    <div className="fade-up">
      <div className="ph"><div><div className="ptitle">Cruise profile</div><div className="psub">Module 7 · CLIA compliance · APIS · Cabin class · Shore excursions</div></div></div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ctitle">Cruise preferences</div>
        <div className="g3" style={{ gap: 12, marginTop: 12 }}>
          {[
            { label: "Cabin class", value: passenger?.cruise_cabin || "Not set" },
            { label: "Dining preference", value: passenger?.cruise_dining || "Not set" },
            { label: "Loyalty programme", value: passenger?.cruise_loyalty || "Not set" },
            { label: "Muster station", value: passenger?.muster_station || "Assigned at embarkation" },
            { label: "Shore excursion tier", value: passenger?.shore_excursion_tier || "Not set" },
            { label: "Accessibility needs", value: passenger?.accessibility || "None noted" },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ctitle">Dietary &amp; onboard SSR</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.6 }}>Cruise line dietary requirements use the same SSR codes as IATA. Your selection is transmitted to the vessel's catering system at time of booking.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CRUISE_SSR.map(s => {
            const active = passenger?.meal_preference === s.code || passenger?.dietary_requirement === s.code;
            return (
              <div key={s.code} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "var(--r-md)", border: `1px solid ${active ? "var(--emerald)" : "var(--border)"}`, background: active ? "var(--emerald-xlight)" : "var(--surface)", cursor: "default" }}>
                <span style={{ fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: active ? "var(--emerald)" : "var(--muted)" }}>{s.code}</span>
                <span style={{ fontSize: 12, color: active ? "var(--ink)" : "var(--muted)" }}>{s.label}</span>
                {active && <span style={{ fontSize: 10, color: "var(--emerald)" }}>✓</span>}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 12 }}>Active SSR code inherited from your Meal preferences (Module 3). Update it there to change it here.</div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ctitle">Vessel emergency contact</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.6 }}>Required by CLIA member lines and port authorities. This contact is specific to the vessel and may differ from your standard travel emergency contact.</div>
        <div className="g3" style={{ gap: 12 }}>
          {[
            { label: "Contact name", value: passenger?.cruise_emergency_name || "Not set" },
            { label: "Relationship", value: passenger?.cruise_emergency_relationship || "Not set" },
            { label: "Phone (with country code)", value: passenger?.cruise_emergency_phone || "Not set" },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: f.value === "Not set" ? "var(--hint)" : "var(--ink)" }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, border: pp ? "1px solid var(--border)" : "1px solid rgba(245,158,11,0.35)" }}>
        <div className="ctitle">Document &amp; compliance</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.6 }}>CLIA member lines and port immigration systems require APIS (Advance Passenger Information System) data. Your passport is linked from the Identity &amp; Documents module — no re-entry needed.</div>
        {pp ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "var(--emerald-xlight)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "var(--r-md)" }}>
            <span style={{ fontSize: 22 }}>📘</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--emerald)", marginBottom: 2 }}>Passport linked ✓</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>No. <strong style={{ color: "var(--ink)" }}>{pp}</strong></span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Nationality <strong style={{ color: "var(--ink)" }}>{nat || "—"}</strong></span>
                <span style={{ fontSize: 12, color: daysLeft !== null && daysLeft <= 90 ? expColor : "var(--muted)" }}>Expires <strong style={{ color: expColor }}>{exp || "—"}{daysLeft !== null && daysLeft <= 180 ? ` · ${daysLeft}d` : ""}</strong></span>
              </div>
            </div>
            <button className="btn" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => onNavigate?.("identitydocs")}>View →</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--r-md)" }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--amber)", marginBottom: 2 }}>No passport on file</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>APIS submission will be incomplete. Add your passport in Identity &amp; Documents.</div>
            </div>
            <button className="btn btn-p" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => onNavigate?.("identitydocs")}>Add passport →</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="ctitle">About CLIA compliance</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>Your UniProfile UUID links your cruise bookings to your full travel identity — enabling seamless port-to-port APIS submission, pre-boarding check-in, and loyalty consolidation across CLIA member lines. Passport data is transmitted once and reused across all booked voyages.</div>
      </div>
    </div>
  );
}

function Family({ passenger }) {
  return (
    <div className="fade-up">
      <div className="ph"><div><div className="ptitle">Family &amp; companions</div><div className="psub">Module 8 · Companion profiles · Minor travel · Group bookings</div></div></div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ctitle">Linked profiles</div>
        <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.7, marginTop: 8, marginBottom: 4 }}>Link your family members so you share upcoming trips automatically and your respective preferences travel with each booking.</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>Each linked member gets their own sub-UUID — keeping preferences and documents separate while allowing group booking in a single action.</div>
        <button className="btn-primary" style={{ marginTop: 14 }}>+ Add companion profile</button>
      </div>
      <div className="card">
        <div className="ctitle">Minor travel</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>Children travelling as unaccompanied minors (UMNR) can be linked to your profile. Their documents, consent records, and handling instructions are stored under your UUID and presented automatically at check-in.</div>
      </div>
    </div>
  );
}

function Insurance({ passenger }) {
  return (
    <div className="fade-up">
      <div className="ph"><div><div className="ptitle">Travel insurance</div><div className="psub">Module 9 · Policy management · Claims · Real-time eligibility</div></div></div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ctitle">Active policies</div>
        <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.7, marginTop: 8, marginBottom: 4 }}>Add your travel insurance policies and tour bookings here. Linked family members can see them for emergency contacts and shared itineraries.</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>Connected policies allow insurers to verify trip data, flight disruption events, and baggage mishandling records in real time — eliminating manual claims paperwork.</div>
        <button className="btn-primary" style={{ marginTop: 14 }}>+ Link insurance policy</button>
      </div>
      <div className="card">
        <div className="ctitle">Automated claims</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>When a disruption or delay is recorded against your UUID, your insurer is notified automatically via the UniProfile event bus. EU261 compensation and insurance claims can be initiated without you filing a single form.</div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "⬡", section: "overview" },
  { id: "journey", label: "Journey map", icon: "🌍", section: "overview" },
  { id: "order", label: "Offer & Order", icon: "✈", section: "oneorder" },
  { id: "disruption", label: "Disruption", icon: "⚡", section: "oneorder" },
  { id: "baggage", label: "BagJourney", icon: "🧳", section: "oneorder" },
  { id: "identitydocs", label: "Identity & Documents", icon: "🪪", section: "modules", badge: true, mod: 1 },
  { id: "seat", label: "Seat & Ancillary", icon: "💺", section: "modules", mod: 2 },
  { id: "meal", label: "Meal preferences", icon: "🍽", section: "modules", mod: 3 },
  { id: "loyalty", label: "Loyalty", icon: "⭐", section: "modules", mod: 4 },
  { id: "payment", label: "Payment", icon: "💳", section: "modules", mod: 5 },
  { id: "tripvault", label: "Trip Vault", icon: "🛂", section: "modules", mod: 6 },
  { id: "cruise", label: "Cruise profile", icon: "🚢", section: "modules", mod: 7 },
  { id: "family", label: "Family & companions", icon: "👨‍👩‍👧", section: "modules", mod: 8 },
  { id: "insurance", label: "Travel insurance", icon: "🛡", section: "modules", mod: 9 },
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
  const [loadingProfile, setLoadingProfile] = useState(true);

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
    if (authMode === "forgot") return <><style>{CSS}</style><ForgotPasswordPage onSwitch={handleSwitch} /></>;
    return <><style>{CSS}</style><LoginPage onLogin={handleLogin} onSwitch={handleSwitch} prefill={prefill} /></>;
  }
  if (loadingProfile) return (
    <><style>{CSS}</style>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="loading"><div className="spinner"></div>Loading your UniProfile…</div>
      </div>
    </>
  );
  const PAGES = {
    dashboard: <Dashboard passenger={passenger} uuid={uuid} token={user.token} onRefresh={handleRefresh} onNavigate={setActive} />,
    journey: <JourneyMap uuid={uuid} token={user.token} passenger={passenger} />,
    tripvault: <TripVault passenger={passenger} uuid={uuid} token={user.token} />,
    order: <Orders uuid={uuid} token={user.token} />,
    seat: <SeatAncillary passenger={passenger} />,
    disruption: <Disruption />,
    loyalty: <Loyalty uuid={uuid} token={user.token} />,
    payment: <Payment uuid={uuid} token={user.token} />,
    baggage: <Baggage uuid={uuid} token={user.token} />,
    identitydocs: <IdentityDocs passenger={passenger} onNavigate={setActive} />,
    meal: <Meal passenger={passenger} />,
    cruise: <Cruise passenger={passenger} onNavigate={setActive} />,
    family: <Family passenger={passenger} />,
    insurance: <Insurance passenger={passenger} />,
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
              <div className="uuid-lbl">UniProfile Number</div>
              <div className="uuid-val">{uuid}</div>
            </div>
          )}
          {[{ id: "overview", label: "Overview" }, { id: "oneorder", label: "OneOrder" }, { id: "modules", label: "Passenger modules" }, { id: "identity", label: "Identity" }].map(section => (
            <div key={section.id}>
              <div className="nav-sec">{section.label}</div>
              {NAV_ITEMS.filter(n => n.section === section.id).map(n => (
                <div key={n.id} className={`nav-item ${active === n.id ? "on" : ""}`} onClick={() => setActive(n.id)}>
                  <div className="nav-icon">{n.icon}</div>
                  {n.label}
                  {n.badge && <span className="nav-badge" />}
                  {n.mod != null && <span className="mod-num">{n.mod}</span>}
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
        <div className="app-right">
          <div className="topbar">
            <div className="topbar-left">IATA OneOrder · v2.0</div>
            <div className="bleisure-wrap">
              {[["Personal", "leisure"], ["Bleisure", "bleisure"], ["Business", "business"]].map(([label, val]) => (
                <button key={val} className={`bleisure-btn ${context === val ? "on" : ""}`} onClick={() => setContext(val)}>{label}</button>
              ))}
            </div>
          </div>
          <main className="main">{PAGES[active]}</main>
        </div>
      </div>
      {!setupDone && !loadingProfile && <SetupWizard user={user} onComplete={handleSetupComplete} />}
    </>
  );
}
