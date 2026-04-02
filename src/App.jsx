import { useState, useEffect, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL || "https://0wsxmo9ftg.execute-api.us-east-1.amazonaws.com/prod";
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || "2heljmdli4f9cv2i4m0i020mfc";
const REGION = import.meta.env.VITE_REGION || "us-east-1";
const COGNITO_URL = `https://cognito-idp.${REGION}.amazonaws.com/`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0a0d14;--ink2:#141824;--ink3:#1e2433;--border:rgba(255,255,255,0.07);--border2:rgba(255,255,255,0.13);--text:#e8eaf0;--muted:#7a8099;--accent:#5b8dee;--accent2:#3dd68c;--warn:#f5a623;--danger:#e85d5d;--purple:#a78bfa;--mono:'DM Mono',monospace;--sans:'DM Sans',sans-serif;--display:'Syne',sans-serif;}
body{background:var(--ink);color:var(--text);font-family:var(--sans);font-size:14px;line-height:1.6;min-height:100vh}
.app{display:flex;min-height:100vh}
.auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.auth-card{background:var(--ink2);border:1px solid var(--border);border-radius:16px;padding:40px;width:100%;max-width:420px}
.auth-logo{font-family:var(--display);font-size:24px;font-weight:800;margin-bottom:4px}
.auth-logo span{color:var(--accent)}
.auth-sub{font-size:10px;color:var(--muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:28px}
.auth-title{font-family:var(--display);font-size:20px;font-weight:700;margin-bottom:20px}
.field{margin-bottom:14px}
.field label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-family:var(--mono);margin-bottom:5px}
.field input,.field select,.field textarea{width:100%;background:var(--ink3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--sans);font-size:13px;padding:9px 12px;outline:none;transition:border-color 0.12s}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent)}
.field select option{background:var(--ink3)}
.field textarea{min-height:80px;resize:vertical}
.g2f{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.btn-full{width:100%;padding:11px;border-radius:8px;background:var(--accent);border:none;color:#fff;font-family:var(--mono);font-size:12px;font-weight:500;cursor:pointer;transition:background 0.12s;letter-spacing:0.5px}
.btn-full:hover{background:#4a7de0}
.btn-full:disabled{opacity:0.5;cursor:not-allowed}
.auth-switch{text-align:center;margin-top:16px;font-size:12px;color:var(--muted)}
.auth-switch a{color:var(--accent);cursor:pointer}
.err{background:rgba(232,93,93,0.1);border:1px solid rgba(232,93,93,0.25);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--danger);margin-bottom:14px}
.suc{background:rgba(61,214,140,0.1);border:1px solid rgba(61,214,140,0.25);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--accent2);margin-bottom:14px}
.sidebar{width:210px;min-width:210px;background:var(--ink2);border-right:1px solid var(--border);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;overflow-y:auto}
.logo-area{padding:16px 16px 12px;border-bottom:1px solid var(--border)}
.logotype{font-family:var(--display);font-size:19px;font-weight:800;letter-spacing:-0.5px}
.logotype span{color:var(--accent)}
.logo-sub{font-size:9px;color:var(--muted);font-family:var(--mono);letter-spacing:1px;text-transform:uppercase;margin-top:2px}
.uuid-chip{margin:10px 12px;padding:7px 10px;background:var(--ink3);border:1px solid var(--border);border-radius:7px}
.uuid-lbl{font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-family:var(--mono)}
.uuid-val{font-family:var(--mono);font-size:8px;color:var(--accent);word-break:break-all;margin-top:2px;opacity:0.8}
.ctx-row{margin:0 12px 8px;display:flex;background:var(--ink3);border:1px solid var(--border);border-radius:7px;overflow:hidden}
.ctx-btn{flex:1;padding:5px 2px;font-size:10px;font-family:var(--mono);border:none;background:transparent;color:var(--muted);cursor:pointer;text-align:center;transition:all 0.12s}
.ctx-btn.on{background:var(--ink2);color:var(--accent2);border-radius:5px}
.nav-sec{font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-family:var(--mono);padding:10px 16px 4px}
.nav-item{display:flex;align-items:center;gap:8px;padding:8px 16px;cursor:pointer;border-left:2px solid transparent;font-size:12px;color:var(--muted);transition:all 0.1s;white-space:nowrap}
.nav-item:hover{background:var(--ink3);color:var(--text)}
.nav-item.on{background:rgba(91,141,238,0.1);border-left-color:var(--accent);color:var(--text)}
.nav-dot{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:0.5;flex-shrink:0}
.nav-item.on .nav-dot{opacity:1}
.sidebar-foot{margin-top:auto;padding:12px 16px;border-top:1px solid var(--border)}
.signout-btn{width:100%;padding:7px;border-radius:7px;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:var(--mono);font-size:10px;cursor:pointer;transition:all 0.12s;text-transform:uppercase;letter-spacing:0.5px}
.signout-btn:hover{border-color:var(--danger);color:var(--danger)}
.main{flex:1;overflow-y:auto;padding:22px 24px;height:100vh}
.ph{margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ptitle{font-family:var(--display);font-size:22px;font-weight:700;letter-spacing:-0.5px}
.psub{font-size:11px;color:var(--muted);margin-top:3px}
.card{background:var(--ink2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:14px}
.ctitle{font-family:var(--display);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:12px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.stat{background:var(--ink3);border:1px solid var(--border);border-radius:8px;padding:12px}
.slbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-family:var(--mono)}
.sval{font-family:var(--display);font-size:22px;font-weight:700;line-height:1.1;margin-top:3px}
.fr{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
.fr:last-child{border-bottom:none}
.fl{font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:var(--muted);font-family:var(--mono)}
.fv{font-size:12px;color:var(--text);text-align:right;font-family:var(--mono)}
.badge{display:inline-block;font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px}
.bg{background:rgba(61,214,140,0.12);color:var(--accent2);border:1px solid rgba(61,214,140,0.22)}
.bb{background:rgba(91,141,238,0.12);color:var(--accent);border:1px solid rgba(91,141,238,0.22)}
.bw{background:rgba(245,166,35,0.12);color:var(--warn);border:1px solid rgba(245,166,35,0.22)}
.bd{background:rgba(232,93,93,0.12);color:var(--danger);border:1px solid rgba(232,93,93,0.22)}
.bp{background:rgba(167,139,250,0.12);color:var(--purple);border:1px solid rgba(167,139,250,0.22)}
.bm{background:rgba(255,255,255,0.05);color:var(--muted);border:1px solid var(--border)}
.tbl{width:100%;border-collapse:collapse}
.tbl th{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-family:var(--mono);text-align:left;padding:6px 10px;border-bottom:1px solid var(--border)}
.tbl td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,0.03);font-size:12px;vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.mono{font-family:var(--mono)}
.acc{color:var(--accent)}.acc2{color:var(--accent2)}.muted{color:var(--muted)}.warn{color:var(--warn)}.pur{color:var(--purple)}
.loading{display:flex;align-items:center;justify-content:center;padding:48px;color:var(--muted);font-family:var(--mono);font-size:12px;gap:10px}
.spinner{width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{text-align:center;padding:40px 24px;color:var(--muted)}
.empty-icon{font-size:32px;margin-bottom:10px;opacity:0.4}
.empty-title{font-family:var(--display);font-size:15px;font-weight:600;margin-bottom:5px;color:var(--text)}
.empty-sub{font-size:12px;line-height:1.6;margin-bottom:16px}
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:7px;border:1px solid var(--border2);background:transparent;color:var(--text);font-size:11px;font-family:var(--mono);cursor:pointer;transition:all 0.1s}
.btn:hover{background:var(--ink3);border-color:var(--accent)}
.btn-p{background:var(--accent);border-color:var(--accent);color:#fff}
.btn-p:hover{background:#4a7de0}
.btn-d{border-color:rgba(232,93,93,0.3);color:var(--danger)}
.btn-d:hover{background:rgba(232,93,93,0.1)}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px}
.modal{background:var(--ink2);border:1px solid var(--border2);border-radius:14px;padding:28px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto}
.modal-title{font-family:var(--display);font-size:18px;font-weight:700;margin-bottom:20px}
.modal-actions{display:flex;gap:10px;margin-top:20px;justify-content:flex-end}
.consent-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);gap:10px}
.consent-row:last-child{border-bottom:none}
.prog{height:3px;border-radius:2px;background:var(--ink3);overflow:hidden;margin-top:6px}
.pf{height:100%;border-radius:2px;background:var(--accent)}
.wizard-card{background:var(--ink2);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:14px}
.wizard-num{font-family:var(--mono);font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.wizard-title{font-family:var(--display);font-size:17px;font-weight:700;margin-bottom:18px}
`;

async function cognitoReq(action, body) {
  const r = await fetch(COGNITO_URL, { method:"POST", headers:{"Content-Type":"application/x-amz-json-1.1","X-Amz-Target":`AWSCognitoIdentityProviderService.${action}`}, body:JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message||d.__type||"Auth error");
  return d;
}

async function apiCall(path, method="GET", body=null, token) {
  const r = await fetch(`${API_URL}/v1${path}`, { method, headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})}, ...(body?{body:JSON.stringify(body)}:{}) });
  return r.json();
}

function genUUID() {
  const n=Date.now(); const h=n.toString(16).padStart(12,"0");
  const r=()=>Math.floor(Math.random()*0x10000).toString(16).padStart(4,"0");
  const r12=()=>Math.floor(Math.random()*0x1000000000000).toString(16).padStart(12,"0");
  return `${h.slice(0,8)}-${h.slice(8)}-7${r().slice(1)}-${(0x8000|Math.random()*0x3fff).toString(16)}-${r12()}`;
}

function Modal({title,onClose,children}){
  return <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-title">{title}</div>{children}</div></div>;
}

function LoginPage({onLogin,onSwitch,prefill}){
  const [f,setF]=useState({email:prefill||"",password:""});
  const [err,setErr]=useState(""); const [loading,setLoading]=useState(false); const [mode,setMode]=useState("login");
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const doLogin=async()=>{
    if(!f.email||!f.password) return setErr("Email and password required");
    setErr(""); setLoading(true);
    try{ const d=await cognitoReq("InitiateAuth",{AuthFlow:"USER_PASSWORD_AUTH",ClientId:CLIENT_ID,AuthParameters:{USERNAME:f.email,PASSWORD:f.password}}); onLogin({email:f.email,token:d.AuthenticationResult.IdToken}); }
    catch(e){setErr(e.message);}
    setLoading(false);
  };
  const doForgot=async()=>{
    if(!f.email) return setErr("Enter your email first");
    setErr(""); setLoading(true);
    try{ await cognitoReq("ForgotPassword",{ClientId:CLIENT_ID,Username:f.email}); setMode("forgot-sent"); }
    catch(e){setErr(e.message);}
    setLoading(false);
  };
  if(mode==="forgot-sent") return <div className="auth-page"><div className="auth-card"><div className="auth-logo">Uni<span>Profile</span></div><div className="auth-sub">IATA OneOrder · v2.0</div><div className="suc">Password reset email sent to {f.email}</div><button className="btn-full" onClick={()=>setMode("login")}>Back to Sign In</button></div></div>;
  return <div className="auth-page"><div className="auth-card">
    <div className="auth-logo">Uni<span>Profile</span></div><div className="auth-sub">IATA OneOrder · v2.0</div>
    <div className="auth-title">{mode==="forgot"?"Reset password":"Sign in"}</div>
    {err&&<div className="err">{err}</div>}
    <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set("email")} placeholder="you@example.com"/></div>
    {mode==="login"&&<div className="field"><label>Password</label><input type="password" value={f.password} onChange={set("password")} placeholder="Password" onKeyDown={e=>e.key==="Enter"&&doLogin()}/></div>}
    <button className="btn-full" onClick={mode==="login"?doLogin:doForgot} disabled={loading}>{loading?"Please wait…":mode==="login"?"Sign In →":"Send Reset Email →"}</button>
    <div className="auth-switch">{mode==="login"?<><a onClick={()=>setMode("forgot")}>Forgot password?</a> · <a onClick={()=>onSwitch("signup")}>Create account</a></>:<a onClick={()=>setMode("login")}>← Back</a>}</div>
  </div></div>;
}

function SignUpPage({onSwitch}){
  const [step,setStep]=useState("form");
  const [f,setF]=useState({firstName:"",lastName:"",email:"",password:"",confirm:""});
  const [code,setCode]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const doSignUp=async()=>{
    if(!f.firstName||!f.lastName||!f.email||!f.password) return setErr("All fields required");
    if(f.password!==f.confirm) return setErr("Passwords do not match");
    setErr(""); setLoading(true);
    try{ await cognitoReq("SignUp",{ClientId:CLIENT_ID,Username:f.email,Password:f.password,UserAttributes:[{Name:"email",Value:f.email},{Name:"given_name",Value:f.firstName},{Name:"family_name",Value:f.lastName}]}); setStep("verify"); }
    catch(e){setErr(e.message);}
    setLoading(false);
  };
  const doVerify=async()=>{
    if(!code) return setErr("Enter verification code");
    setErr(""); setLoading(true);
    try{ await cognitoReq("ConfirmSignUp",{ClientId:CLIENT_ID,Username:f.email,ConfirmationCode:code}); onSwitch("login",f.email); }
    catch(e){setErr(e.message);}
    setLoading(false);
  };
  if(step==="verify") return <div className="auth-page"><div className="auth-card"><div className="auth-logo">Uni<span>Profile</span></div><div className="auth-sub">IATA OneOrder · v2.0</div><div className="auth-title">Check your email</div><p style={{fontSize:13,color:"var(--muted)",marginBottom:20}}>Code sent to <strong style={{color:"var(--text)"}}>{f.email}</strong></p>{err&&<div className="err">{err}</div>}<div className="field"><label>Verification Code</label><input value={code} onChange={e=>setCode(e.target.value)} placeholder="123456" maxLength={6}/></div><button className="btn-full" onClick={doVerify} disabled={loading}>{loading?"Verifying…":"Verify Email →"}</button><div className="auth-switch"><a onClick={()=>setStep("form")}>← Back</a></div></div></div>;
  return <div className="auth-page"><div className="auth-card">
    <div className="auth-logo">Uni<span>Profile</span></div><div className="auth-sub">IATA OneOrder · v2.0</div>
    <div className="auth-title">Create your UniProfile</div>
    {err&&<div className="err">{err}</div>}
    <div className="g2f"><div className="field"><label>First Name</label><input value={f.firstName} onChange={set("firstName")} placeholder="Rommel"/></div><div className="field"><label>Last Name</label><input value={f.lastName} onChange={set("lastName")} placeholder="Santos"/></div></div>
    <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set("email")} placeholder="you@example.com"/></div>
    <div className="field"><label>Password</label><input type="password" value={f.password} onChange={set("password")} placeholder="Min. 8 characters"/></div>
    <div className="field"><label>Confirm Password</label><input type="password" value={f.confirm} onChange={set("confirm")} placeholder="Repeat password"/></div>
    <button className="btn-full" onClick={doSignUp} disabled={loading}>{loading?"Creating account…":"Create UniProfile →"}</button>
    <div className="auth-switch">Already have an account? <a onClick={()=>onSwitch("login")}>Sign in</a></div>
  </div></div>;
}

function SetupWizard({user,onComplete}){
  const [f,setF]=useState({phone:"",nationality:"",passportNo:"",passportExpiry:"",dob:"",seatPref:"Window",mealPref:"AVML",cabinPref:"Economy",context:"leisure"});
  const [loading,setLoading]=useState(false); const [err,setErr]=useState("");
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const doSubmit=async()=>{
    setLoading(true); setErr("");
    try{
      const uuid=genUUID(); const parts=user.email.split("@")[0].split(".");
      const r=await apiCall("/passengers","POST",{uuid,firstName:user.firstName||parts[0]||"Passenger",lastName:user.lastName||parts[1]||"User",email:user.email,phone:f.phone||null,nationality:f.nationality||null,passportNo:f.passportNo||null,passportExpiry:f.passportExpiry||null,dateOfBirth:f.dob||null,context:f.context,seatPreference:f.seatPref,mealPreference:f.mealPref,cabinPreference:f.cabinPref},user.token);
      if(r.passenger) onComplete(r.passenger); else setErr("Could not create profile. Please try again.");
    }catch(e){setErr("Could not create profile. Please try again.");}
    setLoading(false);
  };
  return <div className="main" style={{maxWidth:580,margin:"0 auto"}}>
    <div className="ph"><div><div className="ptitle">Welcome to UniProfile</div><div className="psub">Set up your passenger identity</div></div></div>
    {err&&<div className="err">{err}</div>}
    <div className="wizard-card"><div className="wizard-num">Step 1 of 2</div><div className="wizard-title">Personal &amp; Travel Documents</div>
      <div className="g2f"><div className="field"><label>Phone</label><input value={f.phone} onChange={set("phone")} placeholder="+1 571 555 0192"/></div><div className="field"><label>Nationality (ISO 3)</label><input value={f.nationality} onChange={set("nationality")} placeholder="PHL" maxLength={3}/></div></div>
      <div className="g2f"><div className="field"><label>Passport Number</label><input value={f.passportNo} onChange={set("passportNo")} placeholder="P12345678"/></div><div className="field"><label>Passport Expiry</label><input type="date" value={f.passportExpiry} onChange={set("passportExpiry")}/></div></div>
      <div className="field"><label>Date of Birth</label><input type="date" value={f.dob} onChange={set("dob")}/></div>
    </div>
    <div className="wizard-card"><div className="wizard-num">Step 2 of 2</div><div className="wizard-title">Travel Preferences</div>
      <div className="g2f"><div className="field"><label>Seat</label><select value={f.seatPref} onChange={set("seatPref")}><option>Window</option><option>Aisle</option><option>Middle</option></select></div><div className="field"><label>Cabin</label><select value={f.cabinPref} onChange={set("cabinPref")}><option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option></select></div></div>
      <div className="g2f"><div className="field"><label>Meal</label><select value={f.mealPref} onChange={set("mealPref")}><option value="AVML">Asian Vegetarian</option><option value="VGML">Vegan</option><option value="HNML">Hindu</option><option value="MOML">Muslim</option><option value="KSML">Kosher</option><option value="GFML">Gluten Free</option><option value="NLML">No Preference</option></select></div><div className="field"><label>Context</label><select value={f.context} onChange={set("context")}><option value="leisure">Leisure</option><option value="business">Business</option><option value="bleisure">Bleisure</option></select></div></div>
    </div>
    <button className="btn-full" onClick={doSubmit} disabled={loading}>{loading?"Creating your UniProfile…":"Complete Setup →"}</button>
  </div>;
}

function Dashboard({passenger,uuid}){
  if(!passenger) return <div className="loading"><div className="spinner"></div>Loading…</div>;
  return <div>
    <div className="ph"><div><div className="ptitle">Welcome, {passenger.first_name}</div><div className="psub">Your UniProfile Identity Dashboard</div></div></div>
    <div className="g4" style={{marginBottom:14}}>
      <div className="stat"><div className="slbl">Context</div><div className="sval" style={{fontSize:14,marginTop:6}}><span className="badge bp">{passenger.bleisure_context||"leisure"}</span></div></div>
      <div className="stat"><div className="slbl">Cabin</div><div className="sval" style={{fontSize:16,marginTop:4}}>{passenger.cabin_preference||"—"}</div></div>
      <div className="stat"><div className="slbl">Meal</div><div className="sval" style={{fontSize:16,marginTop:4}}>{passenger.meal_preference||"—"}</div></div>
      <div className="stat"><div className="slbl">Seat</div><div className="sval" style={{fontSize:16,marginTop:4}}>{passenger.seat_preference||"—"}</div></div>
    </div>
    <div className="g2">
      <div className="card"><div className="ctitle">Identity</div>
        <div className="fr"><span className="fl">UUID v7</span><span className="fv acc" style={{fontSize:9,maxWidth:160,wordBreak:"break-all"}}>{uuid}</span></div>
        <div className="fr"><span className="fl">Name</span><span className="fv">{passenger.first_name} {passenger.last_name}</span></div>
        <div className="fr"><span className="fl">Email</span><span className="fv" style={{fontSize:11}}>{passenger.email}</span></div>
        <div className="fr"><span className="fl">Phone</span><span className="fv">{passenger.phone||"—"}</span></div>
        <div className="fr"><span className="fl">Nationality</span><span className="fv">{passenger.nationality||"—"}</span></div>
        <div className="fr"><span className="fl">Passport</span><span className="fv">{passenger.passport_number||"—"}</span></div>
        <div className="fr"><span className="fl">Member Since</span><span className="fv">{new Date(passenger.created_at).toLocaleDateString()}</span></div>
      </div>
      <div className="card"><div className="ctitle">Biometric Status</div>
        {[["Face Recognition (FRT)","frt_enrolled"],["Fingerprint / FIDO2","fido2_enrolled"],["ePassport NFC","nfc_enrolled"]].map(([label,key])=>(
          <div key={key} className="fr"><span className="fl">{label}</span><span className={`badge ${passenger[key]?"bg":"bw"}`}>{passenger[key]?"Enrolled":"Pending"}</span></div>
        ))}
        <div style={{marginTop:14,fontSize:11,color:"var(--muted)"}}>Enroll at partner airports or via the mobile app.</div>
      </div>
    </div>
  </div>;
}

function OrdersModule({uuid,token}){
  const [orders,setOrders]=useState([]); const [loading,setLoading]=useState(true); const [showModal,setShowModal]=useState(false);
  const [f,setF]=useState({airline:"",pnr:"",route:"",origin:"",destination:"",departureDate:"",cabin:"Economy",totalAmount:"",currency:"USD",status:"confirmed",tripContext:"leisure"}); const [saving,setSaving]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const load=useCallback(async()=>{ setLoading(true); const d=await apiCall(`/orders?uuid=${uuid}`,"GET",null,token); setOrders(d.orders||[]); setLoading(false); },[uuid,token]);
  useEffect(()=>{load();},[load]);
  const doAdd=async()=>{ setSaving(true); const ref=`ORD-${Date.now()}`; await apiCall("/orders","POST",{passengerUuid:uuid,orderReference:ref,airlineCode:f.airline,pnr:f.pnr,route:f.route,origin:f.origin,destination:f.destination,departureDate:f.departureDate||null,cabin:f.cabin,totalAmount:f.totalAmount||null,currency:f.currency,status:f.status,tripContext:f.tripContext},token); setShowModal(false); load(); setSaving(false); };
  return <div>
    <div className="ph"><div><div className="ptitle">Offer &amp; Order</div><div className="psub">IATA OneOrder · NDC-compatible bookings</div></div><button className="btn btn-p" onClick={()=>setShowModal(true)}>+ Add Order</button></div>
    {loading?<div className="loading"><div className="spinner"></div>Loading orders…</div>:orders.length===0?<div className="card"><div className="empty"><div className="empty-icon">✈️</div><div className="empty-title">No orders yet</div><div className="empty-sub">Add your first booking to track it here</div><button className="btn btn-p" onClick={()=>setShowModal(true)}>+ Add Order</button></div></div>:
    <div className="card"><table className="tbl"><thead><tr><th>Reference</th><th>Route</th><th>PNR</th><th>Date</th><th>Cabin</th><th>Amount</th><th>Status</th><th>Type</th></tr></thead>
    <tbody>{orders.map(o=><tr key={o.id}><td className="mono acc" style={{fontSize:10}}>{o.order_reference}</td><td style={{fontSize:12}}>{o.route||`${o.origin||""}→${o.destination||""}`}</td><td className="mono pur">{o.pnr||"—"}</td><td className="mono" style={{fontSize:10}}>{o.departure_date?new Date(o.departure_date).toLocaleDateString():"—"}</td><td>{o.cabin||"—"}</td><td className="mono acc2">{o.total_amount?`${o.currency} ${o.total_amount}`:"—"}</td><td><span className={`badge ${o.status==="confirmed"?"bg":o.status==="ticketed"?"bb":"bw"}`}>{o.status}</span></td><td><span className={`badge ${o.trip_context==="business"?"bb":"bg"}`}>{o.trip_context||"leisure"}</span></td></tr>)}</tbody></table></div>}
    {showModal&&<Modal title="Add Order" onClose={()=>setShowModal(false)}>
      <div className="g2f"><div className="field"><label>Airline Code</label><input value={f.airline} onChange={set("airline")} placeholder="EK" maxLength={2}/></div><div className="field"><label>PNR</label><input value={f.pnr} onChange={set("pnr")} placeholder="EK7X4M"/></div></div>
      <div className="field"><label>Route</label><input value={f.route} onChange={set("route")} placeholder="IAD → DXB → SIN"/></div>
      <div className="g2f"><div className="field"><label>Origin</label><input value={f.origin} onChange={set("origin")} placeholder="IAD" maxLength={3}/></div><div className="field"><label>Destination</label><input value={f.destination} onChange={set("destination")} placeholder="DXB" maxLength={3}/></div></div>
      <div className="g2f"><div className="field"><label>Departure Date</label><input type="date" value={f.departureDate} onChange={set("departureDate")}/></div><div className="field"><label>Cabin</label><select value={f.cabin} onChange={set("cabin")}><option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option></select></div></div>
      <div className="g2f"><div className="field"><label>Amount</label><input value={f.totalAmount} onChange={set("totalAmount")} placeholder="3420.00"/></div><div className="field"><label>Currency</label><input value={f.currency} onChange={set("currency")} placeholder="USD" maxLength={3}/></div></div>
      <div className="g2f"><div className="field"><label>Status</label><select value={f.status} onChange={set("status")}><option value="confirmed">Confirmed</option><option value="ticketed">Ticketed</option><option value="pending">Pending</option></select></div><div className="field"><label>Trip Context</label><select value={f.tripContext} onChange={set("tripContext")}><option value="leisure">Leisure</option><option value="business">Business</option></select></div></div>
      <div className="modal-actions"><button className="btn" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-p" onClick={doAdd} disabled={saving}>{saving?"Saving…":"Add Order"}</button></div>
    </Modal>}
  </div>;
}

function LoyaltyModule({uuid,token}){
  const [programs,setPrograms]=useState([]); const [loading,setLoading]=useState(true); const [showModal,setShowModal]=useState(false);
  const [f,setF]=useState({programName:"",airlineCode:"",membershipNumber:"",tier:"",milesBalance:"",expiryDate:""}); const [saving,setSaving]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const load=useCallback(async()=>{ setLoading(true); const d=await apiCall(`/loyalty?uuid=${uuid}`,"GET",null,token); setPrograms(d.programs||[]); setLoading(false); },[uuid,token]);
  useEffect(()=>{load();},[load]);
  const doAdd=async()=>{ setSaving(true); await apiCall("/loyalty","POST",{passengerUuid:uuid,programName:f.programName,airlineCode:f.airlineCode||null,membershipNumber:f.membershipNumber,tier:f.tier||null,milesBalance:parseInt(f.milesBalance)||0,expiryDate:f.expiryDate||null},token); setShowModal(false); load(); setSaving(false); };
  const totalMiles=programs.reduce((a,p)=>a+(p.miles_balance||0),0);
  return <div>
    <div className="ph"><div><div className="ptitle">Loyalty &amp; Recognition</div><div className="psub">FFP aggregation · UUID-linked rewards</div></div><button className="btn btn-p" onClick={()=>setShowModal(true)}>+ Add Program</button></div>
    {programs.length>0&&<div className="g3" style={{marginBottom:14}}><div className="stat"><div className="slbl">Total Miles</div><div className="sval acc2">{totalMiles.toLocaleString()}</div></div><div className="stat"><div className="slbl">Programs</div><div className="sval">{programs.length}</div></div><div className="stat"><div className="slbl">Est. Value</div><div className="sval acc">${Math.round(totalMiles*0.015).toLocaleString()}</div></div></div>}
    {loading?<div className="loading"><div className="spinner"></div>Loading…</div>:programs.length===0?<div className="card"><div className="empty"><div className="empty-icon">⭐</div><div className="empty-title">No loyalty programs</div><div className="empty-sub">Add your frequent flyer numbers to consolidate miles</div><button className="btn btn-p" onClick={()=>setShowModal(true)}>+ Add Program</button></div></div>:
    <div className="g3">{programs.map(p=><div key={p.id} className="card"><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><div style={{fontFamily:"var(--display)",fontWeight:600,fontSize:14}}>{p.program_name}</div>{p.tier&&<span className="badge bw">{p.tier}</span>}</div><div className="fr"><span className="fl">Number</span><span className="fv" style={{fontSize:10}}>{p.membership_number}</span></div><div className="fr"><span className="fl">Miles</span><span className="fv acc2">{(p.miles_balance||0).toLocaleString()}</span></div>{p.expiry_date&&<div className="fr"><span className="fl">Expiry</span><span className="fv">{new Date(p.expiry_date).toLocaleDateString()}</span></div>}<div className="prog"><div className="pf" style={{width:`${Math.min(100,((p.miles_balance||0)/100000)*100).toFixed(0)}%`}}></div></div></div>)}</div>}
    {showModal&&<Modal title="Add Loyalty Program" onClose={()=>setShowModal(false)}>
      <div className="field"><label>Program Name</label><input value={f.programName} onChange={set("programName")} placeholder="Emirates Skywards"/></div>
      <div className="g2f"><div className="field"><label>Airline Code</label><input value={f.airlineCode} onChange={set("airlineCode")} placeholder="EK" maxLength={2}/></div><div className="field"><label>Membership Number</label><input value={f.membershipNumber} onChange={set("membershipNumber")} placeholder="EK-9872341"/></div></div>
      <div className="g2f"><div className="field"><label>Tier</label><input value={f.tier} onChange={set("tier")} placeholder="Gold"/></div><div className="field"><label>Miles Balance</label><input type="number" value={f.milesBalance} onChange={set("milesBalance")} placeholder="124800"/></div></div>
      <div className="field"><label>Expiry Date</label><input type="date" value={f.expiryDate} onChange={set("expiryDate")}/></div>
      <div className="modal-actions"><button className="btn" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-p" onClick={doAdd} disabled={saving}>{saving?"Saving…":"Add Program"}</button></div>
    </Modal>}
  </div>;
}

function PaymentModule({uuid,token}){
  const [methods,setMethods]=useState([]); const [loading,setLoading]=useState(true); const [showModal,setShowModal]=useState(false);
  const [f,setF]=useState({cardType:"Visa",lastFour:"",expiryMonth:"",expiryYear:""}); const [saving,setSaving]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const load=useCallback(async()=>{ setLoading(true); const d=await apiCall(`/payment?uuid=${uuid}`,"GET",null,token); setMethods(d.methods||[]); setLoading(false); },[uuid,token]);
  useEffect(()=>{load();},[load]);
  const doAdd=async()=>{ setSaving(true); await apiCall("/payment","POST",{passengerUuid:uuid,cardType:f.cardType,lastFour:f.lastFour,expiryMonth:parseInt(f.expiryMonth)||null,expiryYear:parseInt(f.expiryYear)||null,isDefault:methods.length===0},token); setShowModal(false); load(); setSaving(false); };
  return <div>
    <div className="ph"><div><div className="ptitle">Payment &amp; Settlement</div><div className="psub">IATA PAX · BSP tokenisation · PCI-DSS compliant</div></div><button className="btn btn-p" onClick={()=>setShowModal(true)}>+ Add Card</button></div>
    {loading?<div className="loading"><div className="spinner"></div>Loading…</div>:methods.length===0?<div className="card"><div className="empty"><div className="empty-icon">💳</div><div className="empty-title">No payment methods</div><div className="empty-sub">Add a BSP-tokenised payment card</div><button className="btn btn-p" onClick={()=>setShowModal(true)}>+ Add Card</button></div></div>:
    <div className="g2">{methods.map(m=><div key={m.id} className="card" style={{background:"var(--ink3)",border:`1px solid ${m.is_default?"var(--accent)":"var(--border)"}`}}>{m.is_default&&<div style={{marginBottom:8}}><span className="badge bb">Default</span></div>}<div style={{fontFamily:"var(--display)",fontWeight:700,fontSize:16,marginBottom:10}}>{m.card_type}</div><div style={{fontFamily:"var(--mono)",fontSize:18,letterSpacing:4,marginBottom:10}}>•••• •••• •••• {m.last_four}</div><div className="fr"><span className="fl">Expiry</span><span className="fv">{m.expiry_month}/{m.expiry_year}</span></div><div className="fr"><span className="fl">BSP Token</span><span className="fv muted" style={{fontSize:9}}>{m.bsp_token?.slice(0,24)}…</span></div></div>)}</div>}
    {showModal&&<Modal title="Add Payment Card" onClose={()=>setShowModal(false)}>
      <div className="field"><label>Card Type</label><select value={f.cardType} onChange={set("cardType")}><option>Visa</option><option>Mastercard</option><option>Amex</option><option>UnionPay</option></select></div>
      <div className="field"><label>Last 4 Digits</label><input value={f.lastFour} onChange={set("lastFour")} placeholder="4821" maxLength={4}/></div>
      <div className="g2f"><div className="field"><label>Expiry Month</label><input type="number" value={f.expiryMonth} onChange={set("expiryMonth")} placeholder="09" min={1} max={12}/></div><div className="field"><label>Expiry Year</label><input type="number" value={f.expiryYear} onChange={set("expiryYear")} placeholder="2027"/></div></div>
      <div className="modal-actions"><button className="btn" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-p" onClick={doAdd} disabled={saving}>{saving?"Saving…":"Add Card"}</button></div>
    </Modal>}
  </div>;
}

function BaggageModule({uuid,token}){
  const [events,setEvents]=useState([]); const [loading,setLoading]=useState(true); const [showModal,setShowModal]=useState(false);
  const [f,setF]=useState({tagId:"",flightNumber:"",eventType:"CHECK_IN",location:"",status:"checked-in"}); const [saving,setSaving]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const load=useCallback(async()=>{ setLoading(true); const d=await apiCall(`/baggage?uuid=${uuid}`,"GET",null,token); setEvents(d.events||[]); setLoading(false); },[uuid,token]);
  useEffect(()=>{load();},[load]);
  const doAdd=async()=>{ setSaving(true); await apiCall("/baggage","POST",{passengerUuid:uuid,tagId:f.tagId,flightNumber:f.flightNumber||null,eventType:f.eventType,location:f.location||null,status:f.status},token); setShowModal(false); load(); setSaving(false); };
  return <div>
    <div className="ph"><div><div className="ptitle">BagJourney Tracking</div><div className="psub">IATA Resolution 753 · RFID real-time</div></div><button className="btn btn-p" onClick={()=>setShowModal(true)}>+ Add Bag</button></div>
    {loading?<div className="loading"><div className="spinner"></div>Loading…</div>:events.length===0?<div className="card"><div className="empty"><div className="empty-icon">🧳</div><div className="empty-title">No baggage tracked</div><div className="empty-sub">Add your bag tag to start RFID tracking</div><button className="btn btn-p" onClick={()=>setShowModal(true)}>+ Add Bag</button></div></div>:
    <div className="card"><table className="tbl"><thead><tr><th>Tag ID</th><th>Flight</th><th>Event</th><th>Location</th><th>Status</th><th>Time</th></tr></thead>
    <tbody>{events.map(e=><tr key={e.id}><td className="mono acc">{e.tag_id}</td><td>{e.flight_number||"—"}</td><td><span className="badge bb">{e.event_type}</span></td><td style={{fontSize:12}}>{e.location||"—"}</td><td><span className={`badge ${e.status==="delivered"?"bg":"bw"}`}>{e.status}</span></td><td className="mono muted" style={{fontSize:10}}>{new Date(e.event_timestamp).toLocaleString()}</td></tr>)}</tbody></table></div>}
    {showModal&&<Modal title="Add Bag Tag" onClose={()=>setShowModal(false)}>
      <div className="g2f"><div className="field"><label>Bag Tag ID</label><input value={f.tagId} onChange={set("tagId")} placeholder="AC847291"/></div><div className="field"><label>Flight Number</label><input value={f.flightNumber} onChange={set("flightNumber")} placeholder="EK521"/></div></div>
      <div className="field"><label>Event Type</label><select value={f.eventType} onChange={set("eventType")}><option value="CHECK_IN">Check-in</option><option value="SECURITY">Security</option><option value="LOAD">Loaded</option><option value="TRANSFER">Transfer</option><option value="DELIVER">Delivered</option></select></div>
      <div className="field"><label>Location</label><input value={f.location} onChange={set("location")} placeholder="IAD Terminal 2"/></div>
      <div className="field"><label>Status</label><select value={f.status} onChange={set("status")}><option value="checked-in">Checked In</option><option value="in-transit">In Transit</option><option value="in-flight">In Flight</option><option value="delivered">Delivered</option></select></div>
      <div className="modal-actions"><button className="btn" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-p" onClick={doAdd} disabled={saving}>{saving?"Saving…":"Add Bag"}</button></div>
    </Modal>}
  </div>;
}

function ConsentModule({uuid,token}){
  const [grants,setGrants]=useState([]); const [loading,setLoading]=useState(true); const [showModal,setShowModal]=useState(false);
  const [f,setF]=useState({organisation:"",organisationType:"AIRLINE",dataScope:""}); const [saving,setSaving]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const load=useCallback(async()=>{ setLoading(true); const d=await apiCall(`/consent?uuid=${uuid}`,"GET",null,token); setGrants(d.grants||[]); setLoading(false); },[uuid,token]);
  useEffect(()=>{load();},[load]);
  const doAdd=async()=>{ setSaving(true); await apiCall("/consent","POST",{passengerUuid:uuid,organisation:f.organisation,organisationType:f.organisationType,dataScope:f.dataScope},token); setShowModal(false); load(); setSaving(false); };
  const doRevoke=async(id)=>{ await apiCall(`/consent/${id}`,"DELETE",null,token); load(); };
  return <div>
    <div className="ph"><div><div className="ptitle">Consent Engine</div><div className="psub">GDPR Art. 7 · IATA Resolution 787 · Granular control</div></div><button className="btn btn-p" onClick={()=>setShowModal(true)}>+ Grant Consent</button></div>
    {loading?<div className="loading"><div className="spinner"></div>Loading…</div>:grants.length===0?<div className="card"><div className="empty"><div className="empty-icon">🔒</div><div className="empty-title">No consent grants</div><div className="empty-sub">Grant consent to airlines, TMCs and airports to share your profile data</div><button className="btn btn-p" onClick={()=>setShowModal(true)}>+ Grant Consent</button></div></div>:
    <div className="card">{grants.map(g=><div key={g.id} className="consent-row"><div style={{flex:1,minWidth:0}}><div style={{fontWeight:500,marginBottom:2,fontSize:13}}>{g.organisation}</div><div style={{fontSize:10,color:"var(--muted)"}}>{g.data_scope}</div><div style={{fontSize:9,color:"var(--muted)",fontFamily:"var(--mono)",marginTop:2}}>Granted: {new Date(g.granted_at).toLocaleDateString()} · <span className="badge bb" style={{fontSize:9}}>{g.organisation_type}</span></div></div><div style={{display:"flex",alignItems:"center",gap:8}}><span className={`badge ${g.status==="active"?"bg":"bm"}`}>{g.status}</span>{g.status==="active"&&<button className="btn btn-d" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>doRevoke(g.id)}>Revoke</button>}</div></div>)}</div>}
    {showModal&&<Modal title="Grant Consent" onClose={()=>setShowModal(false)}>
      <div className="field"><label>Organisation</label><input value={f.organisation} onChange={set("organisation")} placeholder="Emirates Airlines"/></div>
      <div className="field"><label>Organisation Type</label><select value={f.organisationType} onChange={set("organisationType")}><option value="AIRLINE">Airline</option><option value="TMC">TMC</option><option value="AIRPORT">Airport</option><option value="GDS">GDS</option><option value="OTHER">Other</option></select></div>
      <div className="field"><label>Data Scope</label><textarea value={f.dataScope} onChange={set("dataScope")} placeholder="Profile, loyalty, meal preferences, seat preference"/></div>
      <div className="modal-actions"><button className="btn" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-p" onClick={doAdd} disabled={saving}>{saving?"Saving…":"Grant Consent"}</button></div>
    </Modal>}
  </div>;
}

function DisruptionModule({uuid,token}){
  const [events,setEvents]=useState([]); const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{ setLoading(true); const d=await apiCall(`/disruption?uuid=${uuid}`,"GET",null,token); setEvents(d.events||[]); setLoading(false); },[uuid,token]);
  useEffect(()=>{load();},[load]);
  return <div>
    <div className="ph"><div><div className="ptitle">Disruption &amp; Reprotection</div><div className="psub">Chaos recovery · EU261 · DOT 14 CFR 250</div></div></div>
    {loading?<div className="loading"><div className="spinner"></div>Loading…</div>:events.length===0?<div className="card"><div className="empty"><div className="empty-icon">⚡</div><div className="empty-title">No disruptions</div><div className="empty-sub">Flight disruptions and reprotection actions will appear here automatically when detected via connected airline systems.</div></div></div>:
    <div className="card"><table className="tbl"><thead><tr><th>Type</th><th>Original</th><th>Rebooked</th><th>Delay</th><th>Compensation</th><th>Status</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td><span className="badge bd">{e.disruption_type}</span></td><td style={{fontSize:12}}>{e.original_flight||"—"}</td><td style={{fontSize:12}}>{e.rebooked_flight||"—"}</td><td>{e.delay_minutes?`${e.delay_minutes} min`:"—"}</td><td className="mono acc2">{e.compensation_amount?`$${e.compensation_amount}`:"—"}</td><td><span className={`badge ${e.resolved?"bg":"bw"}`}>{e.resolved?"Resolved":"Active"}</span></td></tr>)}</tbody></table></div>}
    <div className="card"><div className="ctitle">Regulatory Coverage</div><div className="g3">{[["EU 261/2004","Europe compensation"],["DOT 14 CFR 250","US involuntary bump"],["Montreal Conv.","International liability"]].map(([t,s])=><div key={t} style={{background:"var(--ink3)",border:"1px solid var(--border)",borderRadius:8,padding:12}}><div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--accent)",marginBottom:4}}>{t}</div><div style={{fontSize:11,color:"var(--muted)"}}>{s}</div></div>)}</div></div>
  </div>;
}

function SeatModule({passenger}){
  return <div>
    <div className="ph"><div><div className="ptitle">Seat &amp; Ancillary</div><div className="psub">EMD-S · IATA PADIS · Personalised upsell</div></div></div>
    <div className="g2">
      <div className="card"><div className="ctitle">Your NDC Preferences</div>
        <div className="fr"><span className="fl">Seat</span><span className="fv">{passenger?.seat_preference||"—"}</span></div>
        <div className="fr"><span className="fl">Meal Code</span><span className="fv">{passenger?.meal_preference||"—"}</span></div>
        <div className="fr"><span className="fl">Cabin</span><span className="fv">{passenger?.cabin_preference||"—"}</span></div>
        <div className="fr"><span className="fl">Lounge</span><span className="fv">{passenger?.lounge_access?"Yes":"No"}</span></div>
        <div style={{marginTop:14,fontSize:11,color:"var(--muted)"}}>Automatically injected into NDC offers from connected airlines.</div>
      </div>
      <div className="card"><div className="ctitle">Seat Map — Business A380</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,maxWidth:240}}>
          {["12A","12C","12D","12F","13A","13C","13D","13F","14A","14C","14D","14F"].map(s=><div key={s} style={{background:s==="14A"?"var(--accent)":s==="13A"||s==="13C"?"rgba(232,93,93,0.18)":"var(--ink3)",border:`1px solid ${s==="14A"?"var(--accent)":"var(--border)"}`,borderRadius:5,padding:"7px 3px",textAlign:"center",fontFamily:"var(--mono)",fontSize:10,color:s==="14A"?"#fff":s==="13A"||s==="13C"?"var(--danger)":"var(--muted)"}}>{s}</div>)}
        </div>
        <div style={{display:"flex",gap:10,marginTop:10,fontSize:10,color:"var(--muted)"}}><span>🔵 Preferred</span><span>🔴 Occupied</span><span>⬜ Available</span></div>
      </div>
    </div>
  </div>;
}

function BiometricsModule({passenger}){
  const [scanning,setScanning]=useState(null);
  const [enrolled,setEnrolled]=useState({frt:passenger?.frt_enrolled||false,fido2:passenger?.fido2_enrolled||false,nfc:passenger?.nfc_enrolled||false});
  const startScan=key=>{ setScanning(key); setTimeout(()=>{ setScanning(null); setEnrolled(e=>({...e,[key]:true})); },2400); };
  return <div>
    <div className="ph"><div><div className="ptitle">Profile &amp; Biometrics</div><div className="psub">FRT · FIDO2/WebAuthn · NFC ePassport · ICAO 9303</div></div></div>
    <div className="g3" style={{marginBottom:14}}>
      {[{key:"frt",label:"Face Recognition",sub:"ICAO 9303 · Airport biometrics",icon:"👁"},{key:"fido2",label:"Fingerprint / FIDO2",sub:"WebAuthn · W3C standard",icon:"🔑"},{key:"nfc",label:"ePassport NFC",sub:"ISO 14443 · BAC/PACE",icon:"📘"}].map(b=><div key={b.key} className="card" style={{textAlign:"center"}}>
        {scanning===b.key?<div style={{width:56,height:56,borderRadius:"50%",border:"2px solid var(--accent)",margin:"0 auto 10px",animation:"spin 1.5s linear infinite",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{b.icon}</div>:<div style={{fontSize:32,marginBottom:10}}>{b.icon}</div>}
        <div style={{fontFamily:"var(--display)",fontWeight:600,marginBottom:3}}>{b.label}</div>
        <div style={{fontSize:10,color:"var(--muted)",marginBottom:12}}>{b.sub}</div>
        <div style={{marginBottom:12}}><span className={`badge ${enrolled[b.key]?"bg":"bw"}`}>{enrolled[b.key]?"Enrolled":"Pending"}</span></div>
        {!enrolled[b.key]&&<button className="btn btn-p" style={{width:"100%",justifyContent:"center"}} onClick={()=>startScan(b.key)}>{scanning===b.key?"Scanning…":"Enroll Now"}</button>}
      </div>)}
    </div>
    <div className="card"><div className="ctitle">Standards</div><div className="g3">{[["ICAO 9303","ePassport standard"],["W3C WebAuthn","FIDO2 auth"],["ISO 14443","NFC communication"]].map(([t,s])=><div key={t} style={{background:"var(--ink3)",border:"1px solid var(--border)",borderRadius:8,padding:12}}><div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--accent)",marginBottom:4}}>{t}</div><div style={{fontSize:11,color:"var(--muted)"}}>{s}</div></div>)}</div></div>
  </div>;
}

export default function App(){
  const [authMode,setAuthMode]=useState("login");
  const [user,setUser]=useState(null);
  const [passenger,setPassenger]=useState(null);
  const [uuid,setUuid]=useState(null);
  const [setupDone,setSetupDone]=useState(false);
  const [activePage,setActivePage]=useState("dashboard");
  const [context,setContext]=useState("bleisure");
  const [prefillEmail,setPrefillEmail]=useState("");
  const [loadingProfile,setLoadingProfile]=useState(false);

  useEffect(()=>{
    if(!user) return;
    setLoadingProfile(true);
    apiCall(`/passengers/by-email?email=${encodeURIComponent(user.email)}`,"GET",null,user.token)
      .then(d=>{ if(d.passenger){ setPassenger(d.passenger); setUuid(d.passenger.uuid); setSetupDone(true); } })
      .catch(()=>{})
      .finally(()=>setLoadingProfile(false));
  },[user]);

  const handleSwitch=(mode,email="")=>{ setAuthMode(mode); if(email) setPrefillEmail(email); };
  const handleSignOut=()=>{ setUser(null); setUuid(null); setPassenger(null); setSetupDone(false); setActivePage("dashboard"); };
  const handleSetupComplete=p=>{ setPassenger(p); setUuid(p.uuid); setSetupDone(true); };

  if(!user){ if(authMode==="signup") return <><style>{CSS}</style><SignUpPage onSwitch={handleSwitch}/></>; return <><style>{CSS}</style><LoginPage onLogin={setUser} onSwitch={handleSwitch} prefill={prefillEmail}/></>; }
  if(loadingProfile) return <><style>{CSS}</style><div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><div className="loading"><div className="spinner"></div>Loading your UniProfile…</div></div></>;
  if(!setupDone) return <><style>{CSS}</style><SetupWizard user={user} onComplete={handleSetupComplete}/></>;

  const NAV=[{id:"dashboard",label:"Dashboard",section:"overview"},{id:"order",label:"Offer & Order",section:"oneorder"},{id:"seat",label:"Seat & Ancillary",section:"oneorder"},{id:"disruption",label:"Disruption",section:"oneorder"},{id:"loyalty",label:"Loyalty",section:"oneorder"},{id:"payment",label:"Payment",section:"oneorder"},{id:"baggage",label:"BagJourney",section:"oneorder"},{id:"biometrics",label:"Biometrics",section:"identity"},{id:"consent",label:"Consent Engine",section:"identity"}];
  const PAGES={dashboard:<Dashboard passenger={passenger} uuid={uuid}/>,order:<OrdersModule uuid={uuid} token={user.token}/>,seat:<SeatModule passenger={passenger}/>,disruption:<DisruptionModule uuid={uuid} token={user.token}/>,loyalty:<LoyaltyModule uuid={uuid} token={user.token}/>,payment:<PaymentModule uuid={uuid} token={user.token}/>,baggage:<BaggageModule uuid={uuid} token={user.token}/>,biometrics:<BiometricsModule passenger={passenger}/>,consent:<ConsentModule uuid={uuid} token={user.token}/>};

  return <><style>{CSS}</style>
    <div className="app">
      <aside className="sidebar">
        <div className="logo-area"><div className="logotype">Uni<span>Profile</span></div><div className="logo-sub">IATA OneOrder · v2.0</div></div>
        {uuid&&<div className="uuid-chip"><div className="uuid-lbl">Passenger UUID</div><div className="uuid-val">{uuid}</div></div>}
        <div className="ctx-row">{["business","bleisure","leisure"].map(c=><button key={c} className={`ctx-btn ${context===c?"on":""}`} onClick={()=>setContext(c)}>{c.slice(0,3).charAt(0).toUpperCase()+c.slice(1,3)}</button>)}</div>
        {["overview","oneorder","identity"].map(section=><div key={section}><div className="nav-sec">{section==="overview"?"Overview":section==="oneorder"?"OneOrder Modules":"Identity"}</div>{NAV.filter(n=>n.section===section).map(n=><div key={n.id} className={`nav-item ${activePage===n.id?"on":""}`} onClick={()=>setActivePage(n.id)}><div className="nav-dot"></div>{n.label}</div>)}</div>)}
        <div className="sidebar-foot"><div style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--mono)",marginBottom:6,wordBreak:"break-all"}}>{user.email}</div><button className="signout-btn" onClick={handleSignOut}>Sign Out</button></div>
      </aside>
      <main className="main">{PAGES[activePage]}</main>
    </div>
  </>;
}
