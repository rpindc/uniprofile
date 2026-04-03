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

/* AUTH */
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--ink)}
.auth-box{background:var(--ink2);border:1px solid var(--border);border-radius:20px;padding:44px 40px;width:100%;max-width:440px;box-shadow:0 24px 64px rgba(0,0,0,0.4)}
.auth-logo{font-family:var(--display);font-size:26px;font-weight:800;margin-bottom:4px}
.auth-logo span{color:var(--accent)}
.auth-sub{font-size:10px;color:var(--muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:32px}
.auth-h{font-family:var(--display);font-size:22px;font-weight:700;margin-bottom:24px}
.field{margin-bottom:16px}
.field label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-family:var(--mono);margin-bottom:6px}
.field input,.field select,.field textarea{width:100%;background:var(--ink3);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--sans);font-size:14px;padding:11px 14px;outline:none;transition:border-color 0.12s}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent)}
.field select option{background:var(--ink3)}
.field textarea{min-height:90px;resize:vertical}
.g2f{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.btn-full{width:100%;padding:13px;border-radius:10px;background:var(--accent);border:none;color:#fff;font-family:var(--mono);font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;letter-spacing:0.5px;margin-top:4px}
.btn-full:hover{background:#4a7de0;transform:translateY(-1px)}
.btn-full:disabled{opacity:0.5;cursor:not-allowed;transform:none}
.auth-sw{text-align:center;margin-top:18px;font-size:13px;color:var(--muted)}
.auth-sw a{color:var(--accent);cursor:pointer;text-decoration:none}
.auth-sw a:hover{text-decoration:underline}
.err{background:rgba(232,93,93,0.1);border:1px solid rgba(232,93,93,0.25);border-radius:10px;padding:11px 16px;font-size:13px;color:var(--danger);margin-bottom:16px}

/* SIDEBAR */
.sidebar{width:220px;min-width:220px;background:var(--ink2);border-right:1px solid var(--border);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;overflow:hidden}
.logo-area{padding:20px 20px 14px;border-bottom:1px solid var(--border)}
.logotype{font-family:var(--display);font-size:20px;font-weight:800;letter-spacing:-0.5px}
.logotype span{color:var(--accent)}
.logo-sub{font-size:9px;color:var(--muted);font-family:var(--mono);letter-spacing:1px;text-transform:uppercase;margin-top:3px}
.uuid-chip{margin:12px 14px;padding:10px 12px;background:var(--ink3);border:1px solid var(--border);border-radius:10px}
.uuid-lbl{font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-family:var(--mono)}
.uuid-val{font-family:var(--mono);font-size:8px;color:var(--accent);word-break:break-all;margin-top:3px;line-height:1.5}
.ctx-row{margin:0 14px 10px;display:flex;background:var(--ink3);border:1px solid var(--border);border-radius:8px;overflow:hidden;padding:2px}
.ctx-btn{flex:1;padding:5px 2px;font-size:10px;font-family:var(--mono);border:none;background:transparent;color:var(--muted);cursor:pointer;text-align:center;transition:all 0.12s;border-radius:6px}
.ctx-btn.on{background:var(--ink2);color:var(--accent2);font-weight:500}
.nav-sec{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-family:var(--mono);padding:12px 20px 5px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 20px;cursor:pointer;border-left:2px solid transparent;font-size:13px;color:var(--muted);transition:all 0.1s}
.nav-item:hover{background:var(--ink3);color:var(--text)}
.nav-item.on{background:rgba(91,141,238,0.1);border-left-color:var(--accent);color:var(--text)}
.nav-dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:0.4;flex-shrink:0}
.nav-item.on .nav-dot{opacity:1}
.sidebar-foot{margin-top:auto;padding:14px 16px;border-top:1px solid var(--border)}
.user-email{font-size:11px;color:var(--muted);font-family:var(--mono);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.signout-btn{width:100%;padding:8px;border-radius:8px;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:var(--mono);font-size:10px;cursor:pointer;transition:all 0.12s;text-transform:uppercase;letter-spacing:0.5px}
.signout-btn:hover{border-color:var(--danger);color:var(--danger)}

/* MAIN */
.main{flex:1;overflow-y:auto;padding:32px 40px;height:100vh;max-width:100%}
.ph{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
.ptitle{font-family:var(--display);font-size:26px;font-weight:700;letter-spacing:-0.5px}
.psub{font-size:12px;color:var(--muted);margin-top:4px}

/* CARDS */
.card{background:var(--ink2);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px}
.ctitle{font-family:var(--mono);font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);margin-bottom:14px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}

/* STATS */
.stat{background:var(--ink3);border:1px solid var(--border);border-radius:12px;padding:16px}
.slbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-family:var(--mono)}
.sval{font-family:var(--display);font-size:26px;font-weight:700;line-height:1.1;margin-top:4px}
.ssub{font-size:11px;color:var(--muted);margin-top:3px}

/* FIELD ROWS */
.fr{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
.fr:last-child{border-bottom:none}
.fl{font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:var(--muted);font-family:var(--mono)}
.fv{font-size:13px;color:var(--text);text-align:right;font-family:var(--mono)}

/* BADGES */
.badge{display:inline-block;font-size:9px;font-family:var(--mono);padding:3px 8px;border-radius:5px;text-transform:uppercase;letter-spacing:0.5px}
.bg{background:rgba(61,214,140,0.12);color:var(--accent2);border:1px solid rgba(61,214,140,0.22)}
.bb{background:rgba(91,141,238,0.12);color:var(--accent);border:1px solid rgba(91,141,238,0.22)}
.bw{background:rgba(245,166,35,0.12);color:var(--warn);border:1px solid rgba(245,166,35,0.22)}
.bd{background:rgba(232,93,93,0.12);color:var(--danger);border:1px solid rgba(232,93,93,0.22)}
.bp{background:rgba(167,139,250,0.12);color:var(--purple);border:1px solid rgba(167,139,250,0.22)}
.bm{background:rgba(255,255,255,0.05);color:var(--muted);border:1px solid var(--border)}

/* TABLE */
.tbl{width:100%;border-collapse:collapse}
.tbl th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-family:var(--mono);text-align:left;padding:8px 12px;border-bottom:1px solid var(--border)}
.tbl td{padding:11px 12px;border-bottom:1px solid rgba(255,255,255,0.03);font-size:13px;vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:rgba(255,255,255,0.02)}
.mono{font-family:var(--mono)}.acc{color:var(--accent)}.acc2{color:var(--accent2)}.muted{color:var(--muted)}.warn{color:var(--warn)}.pur{color:var(--purple)}

/* LOADING & EMPTY */
.loading{display:flex;align-items:center;justify-content:center;padding:56px;color:var(--muted);font-family:var(--mono);font-size:12px;gap:10px}
.spinner{width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{text-align:center;padding:56px 32px}
.empty-icon{font-size:40px;margin-bottom:14px;opacity:0.35}
.empty-title{font-family:var(--display);font-size:18px;font-weight:700;margin-bottom:8px}
.empty-sub{font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.7}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--text);font-size:12px;font-family:var(--mono);cursor:pointer;transition:all 0.12s;white-space:nowrap}
.btn:hover{background:var(--ink3);border-color:var(--accent)}
.btn-p{background:var(--accent);border-color:var(--accent);color:#fff}
.btn-p:hover{background:#4a7de0;border-color:#4a7de0}
.btn-d{border-color:rgba(232,93,93,0.3);color:var(--danger)}
.btn-d:hover{background:rgba(232,93,93,0.1)}
.btn-sm{padding:5px 10px;font-size:10px}

/* MODAL */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:200;padding:24px;backdrop-filter:blur(4px)}
.modal{background:var(--ink2);border:1px solid var(--border2);border-radius:16px;padding:32px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto}
.modal-title{font-family:var(--display);font-size:20px;font-weight:700;margin-bottom:24px}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:24px;padding-top:16px;border-top:1px solid var(--border)}

/* MISC */
.prog{height:4px;border-radius:2px;background:var(--ink3);overflow:hidden;margin-top:8px}
.pf{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--accent),var(--accent2))}
.toggle{width:36px;height:20px;border-radius:10px;border:none;cursor:pointer;position:relative;transition:background 0.2s;flex-shrink:0}
.toggle::after{content:'';position:absolute;width:14px;height:14px;border-radius:50%;background:white;top:3px;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3)}
.t-on{background:var(--accent2)}.t-on::after{left:18px}
.t-off{background:var(--muted)}.t-off::after{left:3px}

/* WIZARD */
.wizard{max-width:600px;margin:0 auto}
.wstep{background:var(--ink2);border:1px solid var(--border);border-radius:16px;padding:32px;margin-bottom:18px}
.wnum{font-family:var(--mono);font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px}
.wtitle{font-family:var(--display);font-size:20px;font-weight:700;margin-bottom:22px}

/* CONSENT ROW */
.consent-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);gap:16px}
.consent-row:last-child{border-bottom:none}
`;

async function cognitoReq(action, body) {
  const r = await fetch(COGNITO_URL, {
    method:"POST",
    headers:{"Content-Type":"application/x-amz-json-1.1","X-Amz-Target":`AWSCognitoIdentityProviderService.${action}`},
    body:JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || d.__type || "Auth error");
  return d;
}
const signUp = (e,p,f,l) => cognitoReq("SignUp",{ClientId:CLIENT_ID,Username:e,Password:p,UserAttributes:[{Name:"email",Value:e},{Name:"given_name",Value:f},{Name:"family_name",Value:l}]});
const confirmSignUp = (e,c) => cognitoReq("ConfirmSignUp",{ClientId:CLIENT_ID,Username:e,ConfirmationCode:c});
const signIn = (e,p) => cognitoReq("InitiateAuth",{AuthFlow:"USER_PASSWORD_AUTH",ClientId:CLIENT_ID,AuthParameters:{USERNAME:e,PASSWORD:p}});

async function api(path,method="GET",body=null,token=null) {
  const r = await fetch(`${API_URL}/v1${path}`,{
    method,
    headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  return r.json();
}

function genUUID() {
  const n=Date.now(),h=n.toString(16).padStart(12,"0");
  const r=()=>Math.floor(Math.random()*0x10000).toString(16).padStart(4,"0");
  return `${h.slice(0,8)}-${h.slice(8)}-7${r().slice(1)}-${(0x8000|Math.random()*0x3fff).toString(16)}-${Math.floor(Math.random()*0x1000000000000).toString(16).padStart(12,"0")}`;
}

function Modal({title,onClose,onSubmit,submitLabel="Save",loading,children}){
  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">{title}</div>
        {children}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-p" onClick={onSubmit} disabled={loading}>{loading?"Saving…":submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Empty({icon,title,sub,onAdd,addLabel="+ Add"}){
  return(
    <div className="card empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
      {onAdd&&<button className="btn btn-p" onClick={onAdd}>{addLabel}</button>}
    </div>
  );
}

function SignUpPage({onSwitch}){
  const [step,setStep]=useState("form");
  const [f,setF]=useState({fn:"",ln:"",email:"",pw:"",pw2:""});
  const [code,setCode]=useState("");
  const [err,setErr]=useState("");const [loading,setLoading]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const doSignUp=async()=>{
    if(!f.fn||!f.ln||!f.email||!f.pw)return setErr("All fields required");
    if(f.pw!==f.pw2)return setErr("Passwords don't match");
    if(f.pw.length<8)return setErr("Min 8 characters");
    setErr("");setLoading(true);
    try{await signUp(f.email,f.pw,f.fn,f.ln);setStep("verify");}catch(e){setErr(e.message);}
    setLoading(false);
  };
  const doVerify=async()=>{
    if(!code)return setErr("Enter code");
    setErr("");setLoading(true);
    try{await confirmSignUp(f.email,code);onSwitch("login",f.email);}catch(e){setErr(e.message);}
    setLoading(false);
  };
  if(step==="verify")return(
    <div className="auth-wrap"><div className="auth-box">
      <div className="auth-logo">Uni<span>Profile</span></div>
      <div className="auth-sub">Verify your email</div>
      <div className="auth-h">Check your inbox</div>
      <p style={{fontSize:13,color:"var(--muted)",marginBottom:20,lineHeight:1.7}}>We sent a 6-digit code to <strong style={{color:"var(--text)"}}>{f.email}</strong></p>
      {err&&<div className="err">{err}</div>}
      <div className="field"><label>Verification Code</label><input value={code} onChange={e=>setCode(e.target.value)} placeholder="123456" maxLength={6} style={{fontSize:20,letterSpacing:6,textAlign:"center"}}/></div>
      <button className="btn-full" onClick={doVerify} disabled={loading}>{loading?"Verifying…":"Verify Email →"}</button>
      <div className="auth-sw"><a onClick={()=>setStep("form")}>← Back</a></div>
    </div></div>
  );
  return(
    <div className="auth-wrap"><div className="auth-box">
      <div className="auth-logo">Uni<span>Profile</span></div>
      <div className="auth-sub">IATA OneOrder · v2.0</div>
      <div className="auth-h">Create your passenger profile</div>
      {err&&<div className="err">{err}</div>}
      <div className="g2f">
        <div className="field"><label>First Name</label><input value={f.fn} onChange={set("fn")} placeholder="Rommel"/></div>
        <div className="field"><label>Last Name</label><input value={f.ln} onChange={set("ln")} placeholder="Santos"/></div>
      </div>
      <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set("email")} placeholder="you@example.com"/></div>
      <div className="field"><label>Password</label><input type="password" value={f.pw} onChange={set("pw")} placeholder="Min 8 characters"/></div>
      <div className="field"><label>Confirm Password</label><input type="password" value={f.pw2} onChange={set("pw2")} placeholder="Repeat password"/></div>
      <button className="btn-full" onClick={doSignUp} disabled={loading}>{loading?"Creating account…":"Create UniProfile →"}</button>
      <div className="auth-sw">Already have an account? <a onClick={()=>onSwitch("login")}>Sign in</a></div>
    </div></div>
  );
}

function LoginPage({onLogin,onSwitch,prefill=""}){
  const [f,setF]=useState({email:prefill,pw:""});
  const [err,setErr]=useState("");const [loading,setLoading]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const doLogin=async()=>{
    if(!f.email||!f.pw)return setErr("Email and password required");
    setErr("");setLoading(true);
    try{const d=await signIn(f.email,f.pw);onLogin({email:f.email,token:d.AuthenticationResult.IdToken});}catch(e){setErr(e.message);}
    setLoading(false);
  };
  return(
    <div className="auth-wrap"><div className="auth-box">
      <div className="auth-logo">Uni<span>Profile</span></div>
      <div className="auth-sub">IATA OneOrder · v2.0</div>
      <div className="auth-h">Welcome back</div>
      {err&&<div className="err">{err}</div>}
      <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set("email")} placeholder="you@example.com"/></div>
      <div className="field"><label>Password</label><input type="password" value={f.pw} onChange={set("pw")} placeholder="Your password" onKeyDown={e=>e.key==="Enter"&&doLogin()}/></div>
      <button className="btn-full" onClick={doLogin} disabled={loading}>{loading?"Signing in…":"Sign In →"}</button>
      <div className="auth-sw">No account yet? <a onClick={()=>onSwitch("signup")}>Create one</a></div>
    </div></div>
  );
}

function SetupWizard({user,onComplete}){
  const [f,setF]=useState({phone:"",nat:"",passport:"",exp:"",dob:"",seat:"Window",meal:"AVML",cabin:"Economy",ctx:"leisure"});
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const submit=async()=>{
    setLoading(true);setErr("");
    try{
      const uuid=genUUID();
      const np=user.email.split("@")[0].split(".");
      const d=await api("/passengers","POST",{uuid,firstName:np[0]||"Passenger",lastName:np[1]||"User",email:user.email,phone:f.phone,nationality:f.nat,passportNo:f.passport,passportExpiry:f.exp||null,dateOfBirth:f.dob||null,context:f.ctx,seatPreference:f.seat,mealPreference:f.meal,cabinPreference:f.cabin},user.token);
      if(d.passenger)onComplete(d.passenger.uuid,d.passenger);
      else setErr("Could not create profile. Please try again.");
    }catch(e){setErr(e.message||"Error creating profile");}
    setLoading(false);
  };
  return(
    <div className="main"><div className="wizard">
      <div style={{marginBottom:28}}>
        <div style={{fontFamily:"var(--display)",fontSize:28,fontWeight:800,letterSpacing:"-0.5px",marginBottom:6}}>Welcome to UniProfile</div>
        <div style={{fontSize:13,color:"var(--muted)"}}>Set up your passenger identity — takes 2 minutes</div>
      </div>
      {err&&<div className="err">{err}</div>}
      <div className="wstep">
        <div className="wnum">Step 1 of 2</div>
        <div className="wtitle">Personal &amp; Travel Documents</div>
        <div className="g2f">
          <div className="field"><label>Phone Number</label><input value={f.phone} onChange={set("phone")} placeholder="+1 571 555 0192"/></div>
          <div className="field"><label>Nationality (ISO 3)</label><input value={f.nat} onChange={set("nat")} placeholder="PHL" maxLength={3}/></div>
        </div>
        <div className="g2f">
          <div className="field"><label>Passport Number</label><input value={f.passport} onChange={set("passport")} placeholder="P12345678"/></div>
          <div className="field"><label>Passport Expiry</label><input type="date" value={f.exp} onChange={set("exp")}/></div>
        </div>
        <div className="field"><label>Date of Birth</label><input type="date" value={f.dob} onChange={set("dob")}/></div>
      </div>
      <div className="wstep">
        <div className="wnum">Step 2 of 2</div>
        <div className="wtitle">Travel Preferences</div>
        <div className="g2f">
          <div className="field"><label>Preferred Seat</label><select value={f.seat} onChange={set("seat")}><option>Window</option><option>Aisle</option><option>Middle</option></select></div>
          <div className="field"><label>Preferred Cabin</label><select value={f.cabin} onChange={set("cabin")}><option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option></select></div>
        </div>
        <div className="g2f">
          <div className="field"><label>Meal Preference</label><select value={f.meal} onChange={set("meal")}><option value="AVML">Asian Vegetarian</option><option value="VGML">Vegan</option><option value="HNML">Hindu</option><option value="MOML">Muslim</option><option value="KSML">Kosher</option><option value="GFML">Gluten Free</option><option value="NLML">No Preference</option></select></div>
          <div className="field"><label>Travel Context</label><select value={f.ctx} onChange={set("ctx")}><option value="leisure">Leisure</option><option value="business">Business</option><option value="bleisure">Bleisure</option></select></div>
        </div>
      </div>
      <button className="btn-full" onClick={submit} disabled={loading} style={{marginTop:4}}>{loading?"Creating your UniProfile…":"Complete Setup →"}</button>
    </div></div>
  );
}

function Dashboard({passenger,uuid,onRefresh}){
  if(!passenger)return(
    <div className="card" style={{textAlign:"center",padding:"48px 32px"}}>
      <div style={{fontSize:36,marginBottom:14,opacity:0.4}}>👤</div>
      <div style={{fontFamily:"var(--display)",fontWeight:700,fontSize:18,marginBottom:8}}>Profile loading…</div>
      <div style={{fontSize:13,color:"var(--muted)",marginBottom:24}}>If this persists, try signing out and back in.</div>
      <button className="btn btn-p" onClick={onRefresh}>Refresh Profile</button>
    </div>
  );
  return(
    <div>
      <div className="ph"><div><div className="ptitle">Welcome back, {passenger.first_name} 👋</div><div className="psub">Your UniProfile Identity Dashboard · IATA OneOrder Active</div></div></div>
      <div className="g4" style={{marginBottom:18}}>
        <div className="stat"><div className="slbl">Travel Context</div><div style={{marginTop:8}}><span className="badge bp">{passenger.bleisure_context||"leisure"}</span></div></div>
        <div className="stat"><div className="slbl">Preferred Cabin</div><div className="sval" style={{fontSize:18,marginTop:6}}>{passenger.cabin_preference||"—"}</div></div>
        <div className="stat"><div className="slbl">Meal Code</div><div className="sval" style={{fontSize:18,marginTop:6}}>{passenger.meal_preference||"—"}</div></div>
        <div className="stat"><div className="slbl">Seat Preference</div><div className="sval" style={{fontSize:18,marginTop:6}}>{passenger.seat_preference||"—"}</div></div>
      </div>
      <div className="g2">
        <div className="card">
          <div className="ctitle">Passenger Identity</div>
          <div className="fr"><span className="fl">Full Name</span><span className="fv">{passenger.first_name} {passenger.last_name}</span></div>
          <div className="fr"><span className="fl">Email</span><span className="fv" style={{fontSize:12}}>{passenger.email}</span></div>
          <div className="fr"><span className="fl">Phone</span><span className="fv">{passenger.phone||"—"}</span></div>
          <div className="fr"><span className="fl">Nationality</span><span className="fv">{passenger.nationality||"—"}</span></div>
          <div className="fr"><span className="fl">Passport</span><span className="fv">{passenger.passport_number||"—"}</span></div>
          <div className="fr"><span className="fl">Member Since</span><span className="fv">{new Date(passenger.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}</span></div>
        </div>
        <div>
          <div className="card">
            <div className="ctitle">UUID v7 — Passenger Key</div>
            <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",wordBreak:"break-all",lineHeight:1.9,background:"var(--ink3)",padding:"10px 12px",borderRadius:8}}>{uuid}</div>
          </div>
          <div className="card">
            <div className="ctitle">Biometric Enrollment</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <span className={`badge ${passenger.frt_enrolled?"bg":"bw"}`}>👁 FRT {passenger.frt_enrolled?"Enrolled":"Pending"}</span>
              <span className={`badge ${passenger.fido2_enrolled?"bg":"bw"}`}>🔑 FIDO2 {passenger.fido2_enrolled?"Enrolled":"Pending"}</span>
              <span className={`badge ${passenger.nfc_enrolled?"bg":"bw"}`}>📘 NFC {passenger.nfc_enrolled?"Enrolled":"Pending"}</span>
            </div>
            <div style={{fontSize:11,color:"var(--muted)",marginTop:12,lineHeight:1.6}}>Enroll at partner airports or via the UniProfile mobile app.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Orders({uuid,token}){
  const [orders,setOrders]=useState(null);const [modal,setModal]=useState(false);
  const [f,setF]=useState({airline:"",pnr:"",route:"",origin:"",destination:"",date:"",cabin:"Economy",amount:"",currency:"USD",status:"confirmed",context:"business"});
  const [loading,setLoading]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const load=useCallback(async()=>{const d=await api(`/orders?uuid=${uuid}`,"GET",null,token);setOrders(d.orders||[]);},[uuid,token]);
  useEffect(()=>{load();},[load]);
  const save=async()=>{
    setLoading(true);
    await api("/orders","POST",{passengerUuid:uuid,orderReference:`ORD-${Date.now()}`,airlineCode:f.airline,pnr:f.pnr,route:f.route,origin:f.origin,destination:f.destination,departureDate:f.date||null,cabin:f.cabin,totalAmount:f.amount||null,currency:f.currency,status:f.status,tripContext:f.context},token);
    setModal(false);setF({airline:"",pnr:"",route:"",origin:"",destination:"",date:"",cabin:"Economy",amount:"",currency:"USD",status:"confirmed",context:"business"});await load();setLoading(false);
  };
  return(
    <div>
      <div className="ph"><div><div className="ptitle">Offer &amp; Order Management</div><div className="psub">IATA OneOrder · NDC Level 4 · UUID-linked bookings</div></div><button className="btn btn-p" onClick={()=>setModal(true)}>+ Add Order</button></div>
      {!orders?<div className="loading"><div className="spinner"></div>Loading orders…</div>:orders.length===0?
        <Empty icon="✈️" title="No orders yet" sub="Add your first IATA OneOrder booking. Every order is linked to your passenger UUID and enriched with your travel preferences automatically." onAdd={()=>setModal(true)} addLabel="+ Add First Order"/>:(
        <div className="card"><table className="tbl">
          <thead><tr><th>Order Ref</th><th>Airline</th><th>Route</th><th>PNR</th><th>Departure</th><th>Cabin</th><th>Amount</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>{orders.map(o=>(
            <tr key={o.id}>
              <td><span className="mono acc" style={{fontSize:11}}>{o.order_reference}</span></td>
              <td><span className="badge bb">{o.airline_code||"—"}</span></td>
              <td style={{fontSize:12}}>{o.route||`${o.origin||""}→${o.destination||""}`}</td>
              <td><span className="mono pur">{o.pnr||"—"}</span></td>
              <td className="mono" style={{fontSize:11}}>{o.departure_date?new Date(o.departure_date).toLocaleDateString():"—"}</td>
              <td>{o.cabin||"—"}</td>
              <td><span className="acc2 mono">{o.total_amount?`$${parseFloat(o.total_amount).toLocaleString()}`:"—"}</span></td>
              <td><span className={`badge ${o.trip_context==="business"?"bb":"bg"}`}>{o.trip_context||"—"}</span></td>
              <td><span className={`badge ${o.status==="confirmed"?"bg":o.status==="ticketed"?"bb":"bw"}`}>{o.status}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {modal&&<Modal title="Add OneOrder Booking" onClose={()=>setModal(false)} onSubmit={save} loading={loading}>
        <div className="g2f">
          <div className="field"><label>Airline Code</label><input value={f.airline} onChange={set("airline")} placeholder="EK" maxLength={2}/></div>
          <div className="field"><label>PNR Reference</label><input value={f.pnr} onChange={set("pnr")} placeholder="EK7X4M"/></div>
        </div>
        <div className="field"><label>Route Description</label><input value={f.route} onChange={set("route")} placeholder="IAD → DXB → SIN"/></div>
        <div className="g2f">
          <div className="field"><label>Origin Airport</label><input value={f.origin} onChange={set("origin")} placeholder="IAD" maxLength={3}/></div>
          <div className="field"><label>Destination Airport</label><input value={f.destination} onChange={set("destination")} placeholder="SIN" maxLength={3}/></div>
        </div>
        <div className="g2f">
          <div className="field"><label>Departure Date</label><input type="date" value={f.date} onChange={set("date")}/></div>
          <div className="field"><label>Cabin Class</label><select value={f.cabin} onChange={set("cabin")}><option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option></select></div>
        </div>
        <div className="g2f">
          <div className="field"><label>Total Amount</label><input value={f.amount} onChange={set("amount")} placeholder="3420.00"/></div>
          <div className="field"><label>Currency</label><select value={f.currency} onChange={set("currency")}><option>USD</option><option>EUR</option><option>GBP</option><option>SGD</option><option>AED</option><option>JPY</option></select></div>
        </div>
        <div className="g2f">
          <div className="field"><label>Booking Status</label><select value={f.status} onChange={set("status")}><option value="confirmed">Confirmed</option><option value="ticketed">Ticketed</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option></select></div>
          <div className="field"><label>Trip Type</label><select value={f.context} onChange={set("context")}><option value="business">Business</option><option value="leisure">Leisure</option></select></div>
        </div>
      </Modal>}
    </div>
  );
}

function Loyalty({uuid,token}){
  const [programs,setPrograms]=useState(null);const [modal,setModal]=useState(false);const [editModal,setEditModal]=useState(null);
  const [f,setF]=useState({program:"Emirates Skywards",airline:"EK",number:"",tier:"Gold",miles:"0",expiry:""});
  const [ef,setEf]=useState({});
  const [loading,setLoading]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const eSet=k=>e=>setEf(p=>({...p,[k]:e.target.value}));
  const load=useCallback(async()=>{const d=await api(`/loyalty?uuid=${uuid}`,"GET",null,token);setPrograms(d.programs||[]);},[uuid,token]);
  useEffect(()=>{load();},[load]);
  const save=async()=>{
    setLoading(true);
    await api("/loyalty","POST",{passengerUuid:uuid,programName:f.program,airlineCode:f.airline,membershipNumber:f.number,tier:f.tier,milesBalance:parseInt(f.miles)||0,expiryDate:f.expiry||null},token);
    setModal(false);setF({program:"Emirates Skywards",airline:"EK",number:"",tier:"Gold",miles:"0",expiry:""});await load();setLoading(false);
  };
  const saveEdit=async()=>{
    setLoading(true);
    await api(`/loyalty/${editModal.id}`,"PUT",{programName:ef.program,tier:ef.tier,milesBalance:parseInt(ef.miles)||0,expiryDate:ef.expiry||null},token);
    setEditModal(null);await load();setLoading(false);
  };
  const del=async(id)=>{if(!confirm("Delete this loyalty program?"))return;await api(`/loyalty/${id}`,"DELETE",null,token);await load();};
  const openEdit=p=>{setEf({program:p.program_name,tier:p.tier||"",miles:String(p.miles_balance||0),expiry:p.expiry_date?p.expiry_date.split("T")[0]:""});setEditModal(p);};
  const total=programs?.reduce((a,p)=>a+(p.miles_balance||0),0)||0;
  return(
    <div>
      <div className="ph"><div><div className="ptitle">Loyalty &amp; Recognition</div><div className="psub">FFP aggregation · Real-time tier status · UUID-linked rewards</div></div><button className="btn btn-p" onClick={()=>setModal(true)}>+ Add Program</button></div>
      {programs&&programs.length>0&&<div className="g3" style={{marginBottom:18}}>
        <div className="stat"><div className="slbl">Total Miles</div><div className="sval acc2">{total.toLocaleString()}</div><div className="ssub">Across {programs.length} program{programs.length>1?"s":""}</div></div>
        <div className="stat"><div className="slbl">Estimated Value</div><div className="sval acc">${Math.round(total*0.015).toLocaleString()}</div><div className="ssub">At $0.015 per mile</div></div>
        <div className="stat"><div className="slbl">Programs</div><div className="sval">{programs.length}</div><div className="ssub">Active FFP memberships</div></div>
      </div>}
      {!programs?<div className="loading"><div className="spinner"></div>Loading loyalty programs…</div>:programs.length===0?
        <Empty icon="⭐" title="No loyalty programs" sub="Add your frequent flyer numbers to start consolidating miles across all airlines in one place." onAdd={()=>setModal(true)} addLabel="+ Add First Program"/>:
        programs.map(p=>(
          <div key={p.id} className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <div style={{fontFamily:"var(--display)",fontWeight:700,fontSize:16,marginBottom:4}}>{p.program_name}</div>
                <div style={{fontSize:12,color:"var(--muted)",fontFamily:"var(--mono)"}}>{p.airline_code} · {p.membership_number}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span className="badge bb">{p.tier||"Member"}</span>
                <button className="btn btn-sm" onClick={()=>openEdit(p)}>Edit</button>
                <button className="btn btn-sm btn-d" onClick={()=>del(p.id)}>Delete</button>
              </div>
            </div>
            <div className="g2f">
              <div><div className="fl" style={{marginBottom:4}}>Miles Balance</div><div style={{fontFamily:"var(--display)",fontSize:22,fontWeight:700,color:"var(--accent2)"}}>{(p.miles_balance||0).toLocaleString()}</div></div>
              <div><div className="fl" style={{marginBottom:4}}>Expiry</div><div style={{fontFamily:"var(--mono)",fontSize:13}}>{p.expiry_date?new Date(p.expiry_date).toLocaleDateString():"—"}</div></div>
            </div>
            <div className="prog"><div className="pf" style={{width:`${Math.min(100,((p.miles_balance||0)/150000)*100).toFixed(0)}%`}}></div></div>
            <div style={{fontSize:10,color:"var(--muted)",marginTop:5,fontFamily:"var(--mono)"}}>{Math.min(100,((p.miles_balance||0)/150000)*100).toFixed(0)}% to next tier threshold</div>
          </div>
        ))
      }
      {modal&&<Modal title="Add Loyalty Program" onClose={()=>setModal(false)} onSubmit={save} loading={loading}>
        <div className="field"><label>Program Name</label><input value={f.program} onChange={set("program")} placeholder="Emirates Skywards"/></div>
        <div className="g2f">
          <div className="field"><label>Airline Code</label><input value={f.airline} onChange={set("airline")} placeholder="EK" maxLength={2}/></div>
          <div className="field"><label>Membership Tier</label><select value={f.tier} onChange={set("tier")}><option>Member</option><option>Silver</option><option>Gold</option><option>Platinum</option><option>PPS Club</option><option>Million Miler</option></select></div>
        </div>
        <div className="field"><label>Membership Number</label><input value={f.number} onChange={set("number")} placeholder="EK-9872341"/></div>
        <div className="g2f">
          <div className="field"><label>Current Miles Balance</label><input type="number" value={f.miles} onChange={set("miles")} placeholder="0"/></div>
          <div className="field"><label>Miles Expiry Date</label><input type="date" value={f.expiry} onChange={set("expiry")}/></div>
        </div>
      </Modal>}
      {editModal&&<Modal title={`Edit — ${editModal.program_name}`} onClose={()=>setEditModal(null)} onSubmit={saveEdit} loading={loading} submitLabel="Save Changes">
        <div className="field"><label>Program Name</label><input value={ef.program} onChange={eSet("program")}/></div>
        <div className="field"><label>Tier</label><select value={ef.tier} onChange={eSet("tier")}><option>Member</option><option>Silver</option><option>Gold</option><option>Platinum</option><option>PPS Club</option><option>Million Miler</option></select></div>
        <div className="g2f">
          <div className="field"><label>Miles Balance</label><input type="number" value={ef.miles} onChange={eSet("miles")}/></div>
          <div className="field"><label>Expiry Date</label><input type="date" value={ef.expiry} onChange={eSet("expiry")}/></div>
        </div>
      </Modal>}
    </div>
  );
}

function Payment({uuid,token}){
  const [methods,setMethods]=useState(null);const [modal,setModal]=useState(false);
  const [f,setF]=useState({type:"Visa",last4:"",month:"",year:"",isDefault:false});
  const [loading,setLoading]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const load=useCallback(async()=>{const d=await api(`/payment?uuid=${uuid}`,"GET",null,token);setMethods(d.methods||[]);},[uuid,token]);
  useEffect(()=>{load();},[load]);
  const save=async()=>{
    setLoading(true);
    await api("/payment","POST",{passengerUuid:uuid,cardType:f.type,lastFour:f.last4,expiryMonth:parseInt(f.month)||null,expiryYear:parseInt(f.year)||null,isDefault:f.isDefault},token);
    setModal(false);setF({type:"Visa",last4:"",month:"",year:"",isDefault:false});await load();setLoading(false);
  };
  return(
    <div>
      <div className="ph"><div><div className="ptitle">Payment &amp; Settlement</div><div className="psub">IATA PAX · BSP tokenisation · PCI-DSS Level 1 compliant</div></div><button className="btn btn-p" onClick={()=>setModal(true)}>+ Add Card</button></div>
      {!methods?<div className="loading"><div className="spinner"></div>Loading payment methods…</div>:methods.length===0?
        <Empty icon="💳" title="No payment methods" sub="Add a BSP-tokenised payment card. Your card details are never stored — only secure tokens are used for airline settlement." onAdd={()=>setModal(true)} addLabel="+ Add Card"/>:(
        <div className="g2">{methods.map(m=>(
          <div key={m.id} className="card" style={{background:"var(--ink3)",border:`1px solid ${m.is_default?"var(--accent)":"var(--border)"}`}}>
            {m.is_default&&<div style={{marginBottom:12}}><span className="badge bb">Default Card</span></div>}
            <div style={{fontFamily:"var(--display)",fontWeight:700,fontSize:18,marginBottom:14}}>{m.card_type}</div>
            <div style={{fontFamily:"var(--mono)",fontSize:20,letterSpacing:5,marginBottom:14,color:"var(--text)"}}>•••• •••• •••• {m.last_four}</div>
            <div className="fr"><span className="fl">Expiry</span><span className="fv">{m.expiry_month}/{m.expiry_year}</span></div>
            <div className="fr"><span className="fl">BSP Token</span><span className="fv muted" style={{fontSize:9,letterSpacing:0.5}}>{m.bsp_token}</span></div>
          </div>
        ))}</div>
      )}
      {modal&&<Modal title="Add Payment Card" onClose={()=>setModal(false)} onSubmit={save} loading={loading}>
        <div className="field"><label>Card Type</label><select value={f.type} onChange={set("type")}><option>Visa</option><option>Mastercard</option><option>Amex</option><option>Diners Club</option><option>UnionPay</option></select></div>
        <div className="field"><label>Last 4 Digits</label><input value={f.last4} onChange={set("last4")} placeholder="4821" maxLength={4}/></div>
        <div className="g2f">
          <div className="field"><label>Expiry Month</label><input type="number" value={f.month} onChange={set("month")} placeholder="09" min={1} max={12}/></div>
          <div className="field"><label>Expiry Year</label><input type="number" value={f.year} onChange={set("year")} placeholder="2027" min={2024} max={2040}/></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginTop:10,padding:"12px 0",borderTop:"1px solid var(--border)"}}>
          <button className={`toggle ${f.isDefault?"t-on":"t-off"}`} onClick={()=>setF(p=>({...p,isDefault:!p.isDefault}))}></button>
          <div><div style={{fontSize:13,fontWeight:500}}>Set as default payment method</div><div style={{fontSize:11,color:"var(--muted)"}}>Used for all BSP settlements</div></div>
        </div>
      </Modal>}
    </div>
  );
}

function Baggage({uuid,token}){
  const [events,setEvents]=useState(null);const [modal,setModal]=useState(false);
  const [f,setF]=useState({tagId:"",flight:"",type:"CHECK_IN",location:"",status:"checked-in"});
  const [loading,setLoading]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const load=useCallback(async()=>{const d=await api(`/baggage?uuid=${uuid}`,"GET",null,token);setEvents(d.events||[]);},[uuid,token]);
  useEffect(()=>{load();},[load]);
  const save=async()=>{
    setLoading(true);
    await api("/baggage","POST",{passengerUuid:uuid,tagId:f.tagId,flightNumber:f.flight,eventType:f.type,location:f.location,status:f.status},token);
    setModal(false);setF({tagId:"",flight:"",type:"CHECK_IN",location:"",status:"checked-in"});await load();setLoading(false);
  };
  const statusColor=s=>s==="Delivered"?"bg":s==="In-flight"?"bb":"bw";
  return(
    <div>
      <div className="ph"><div><div className="ptitle">BagJourney Tracking</div><div className="psub">IATA Resolution 753 · RFID real-time · WorldTracer integrated</div></div><button className="btn btn-p" onClick={()=>setModal(true)}>+ Track Bag</button></div>
      {!events?<div className="loading"><div className="spinner"></div>Loading baggage events…</div>:events.length===0?
        <Empty icon="🧳" title="No baggage tracked" sub="Add a bag tag number to start real-time RFID tracking. IATA Resolution 753 compliant tracking across all partner airlines." onAdd={()=>setModal(true)} addLabel="+ Track First Bag"/>:(
        <div className="card"><table className="tbl">
          <thead><tr><th>Tag ID</th><th>Flight</th><th>Event Type</th><th>Location</th><th>Status</th><th>Timestamp</th></tr></thead>
          <tbody>{events.map(e=>(
            <tr key={e.id}>
              <td><span className="mono acc" style={{fontSize:11}}>{e.tag_id}</span></td>
              <td><span className="badge bb">{e.flight_number||"—"}</span></td>
              <td><span className="badge bp">{e.event_type}</span></td>
              <td style={{fontSize:12}}>{e.location||"—"}</td>
              <td><span className={`badge ${statusColor(e.status)}`}>{e.status}</span></td>
              <td className="mono" style={{fontSize:10}}>{new Date(e.event_timestamp).toLocaleString()}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {modal&&<Modal title="Track Baggage" onClose={()=>setModal(false)} onSubmit={save} loading={loading}>
        <div className="g2f">
          <div className="field"><label>Bag Tag ID</label><input value={f.tagId} onChange={set("tagId")} placeholder="AC847291"/></div>
          <div className="field"><label>Flight Number</label><input value={f.flight} onChange={set("flight")} placeholder="EK521"/></div>
        </div>
        <div className="field"><label>Event Type</label><select value={f.type} onChange={set("type")}><option value="CHECK_IN">Check-in</option><option value="LOAD">Loaded onto aircraft</option><option value="TRANSFER">Transfer</option><option value="DELIVER">Delivered to belt</option></select></div>
        <div className="field"><label>Location</label><input value={f.location} onChange={set("location")} placeholder="IAD T2 Belt 7"/></div>
        <div className="field"><label>Status</label><select value={f.status} onChange={set("status")}><option value="checked-in">Checked in</option><option value="In-flight">In-flight</option><option value="Transferred">Transferred</option><option value="Delivered">Delivered</option></select></div>
      </Modal>}
    </div>
  );
}

function Consent({uuid,token}){
  const [grants,setGrants]=useState(null);const [modal,setModal]=useState(false);
  const [f,setF]=useState({org:"",type:"AIRLINE",scope:""});
  const [loading,setLoading]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const load=useCallback(async()=>{const d=await api(`/consent?uuid=${uuid}`,"GET",null,token);setGrants(d.grants||[]);},[uuid,token]);
  useEffect(()=>{load();},[load]);
  const save=async()=>{
    if(!f.org||!f.scope)return;
    setLoading(true);
    await api("/consent","POST",{passengerUuid:uuid,organisation:f.org,organisationType:f.type,dataScope:f.scope},token);
    setModal(false);setF({org:"",type:"AIRLINE",scope:""});await load();setLoading(false);
  };
  const revoke=async(id)=>{
    await api(`/consent/${id}`,"DELETE",null,token);await load();
  };
  const orgPresets=["Emirates Airlines","Amex GBT","Singapore Airlines","Changi Airport","Sabre GDS","Amadeus","BCD Travel","Navan","CWT"];
  return(
    <div>
      <div className="ph"><div><div className="ptitle">Consent Engine</div><div className="psub">GDPR Art. 7 · CCPA · IATA Resolution 787 · Granular data control</div></div><button className="btn btn-p" onClick={()=>setModal(true)}>+ Grant Consent</button></div>
      {!grants?<div className="loading"><div className="spinner"></div>Loading consent grants…</div>:grants.length===0?
        <Empty icon="🔒" title="No consent grants" sub="Grant data sharing consent to airlines, TMCs, and airports. Every consent is GDPR-compliant, granular, and revocable at any time." onAdd={()=>setModal(true)} addLabel="+ Grant First Consent"/>:(
        <div className="card">
          <div className="ctitle">Active Data Sharing Consents</div>
          {grants.map(g=>(
            <div key={g.id} className="consent-row">
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:14,marginBottom:3}}>{g.organisation}</div>
                <div style={{fontSize:12,color:"var(--muted)",marginBottom:3}}>{g.data_scope}</div>
                <div style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--mono)"}}>{g.organisation_type} · Granted {new Date(g.granted_at).toLocaleDateString()}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                <span className={`badge ${g.status==="active"?"bg":"bm"}`}>{g.status}</span>
                {g.status==="active"&&<button className="btn btn-sm btn-d" onClick={()=>revoke(g.id)}>Revoke</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="card" style={{marginTop:16}}>
        <div className="ctitle">Consent Audit Trail</div>
        <div style={{fontSize:12,color:"var(--muted)",fontFamily:"var(--mono)",lineHeight:2.2}}>
          {grants?.filter(g=>g.status==="active").map(g=><div key={g.id}><span className="acc2">GRANT</span> · {g.organisation} · {g.organisation_type} · {new Date(g.granted_at).toLocaleDateString()}</div>)}
          {grants?.filter(g=>g.status==="revoked").map(g=><div key={g.id}><span className="bd">REVOKE</span> · {g.organisation} · {new Date(g.revoked_at||g.granted_at).toLocaleDateString()}</div>)}
          {(!grants||grants.length===0)&&<div style={{color:"var(--muted)"}}>No consent events yet</div>}
        </div>
      </div>
      {modal&&<Modal title="Grant Data Consent" onClose={()=>setModal(false)} onSubmit={save} loading={loading} submitLabel="Grant Consent">
        <div className="field"><label>Organisation</label>
          <input value={f.org} onChange={set("org")} placeholder="Emirates Airlines" list="org-list"/>
          <datalist id="org-list">{orgPresets.map(o=><option key={o} value={o}/>)}</datalist>
        </div>
        <div className="field"><label>Organisation Type</label><select value={f.type} onChange={set("type")}><option value="AIRLINE">Airline</option><option value="TMC">TMC (Travel Management Company)</option><option value="AIRPORT">Airport</option><option value="GDS">GDS</option><option value="HOTEL">Hotel</option></select></div>
        <div className="field"><label>Data Scope — what can they access?</label><textarea value={f.scope} onChange={set("scope")} placeholder="e.g. Profile, loyalty status, meal preferences, seat preferences, travel history"/></div>
        <div style={{background:"rgba(91,141,238,0.07)",border:"1px solid rgba(91,141,238,0.15)",borderRadius:8,padding:"10px 14px",fontSize:12,color:"var(--muted)",marginTop:4}}>
          This consent is GDPR Article 7 compliant. You can revoke it at any time from this screen.
        </div>
      </Modal>}
    </div>
  );
}

function SeatAncillary({passenger}){
  return(
    <div>
      <div className="ph"><div><div className="ptitle">Seat &amp; Ancillary Services</div><div className="psub">EMD-S · IATA PADIS · Personalised upsell engine</div></div></div>
      <div className="card">
        <div className="ctitle">Your Preferences — Auto-applied to NDC Offers</div>
        <div className="g2">
          <div><div className="fr"><span className="fl">Seat Preference</span><span className="fv">{passenger?.seat_preference||"Not set"}</span></div><div className="fr"><span className="fl">Cabin Class</span><span className="fv">{passenger?.cabin_preference||"Not set"}</span></div></div>
          <div><div className="fr"><span className="fl">Meal Code</span><span className="fv">{passenger?.meal_preference||"Not set"}</span></div><div className="fr"><span className="fl">Lounge Access</span><span className="fv">{passenger?.lounge_access?"Yes":"No"}</span></div></div>
        </div>
      </div>
      <div className="card">
        <div className="ctitle">How Ancillary Services Work</div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {[["1. Profile enrichment","When you book via a connected airline or TMC, your UniProfile UUID is sent with the NDC offer request."],["2. Automatic preference injection","Your seat, meal, and cabin preferences are automatically applied to the offer — no re-entry needed."],["3. EMD-S issuance","Ancillary services (upgrades, extra bags, lounge passes) are issued as Electronic Miscellaneous Documents (EMD-S)."],["4. OneOrder consolidation","All ancillaries are consolidated into your OneOrder record, linked to your UUID."]].map(([t,d])=>(
            <div key={t} style={{display:"flex",gap:14,alignItems:"flex-start"}}>
              <div style={{background:"rgba(91,141,238,0.1)",border:"1px solid rgba(91,141,238,0.2)",borderRadius:8,padding:"4px 10px",fontFamily:"var(--mono)",fontSize:10,color:"var(--accent)",whiteSpace:"nowrap",flexShrink:0}}>{t.split(".")[0]}</div>
              <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6,paddingTop:2}}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Disruption(){
  return(
    <div>
      <div className="ph"><div><div className="ptitle">Disruption &amp; Reprotection</div><div className="psub">Chaos-theory recovery · EU261 · DOT 14 CFR 250 · Montreal Convention</div></div></div>
      <Empty icon="⚡" title="No disruptions" sub="When a connected airline detects a disruption affecting your booking, the UniProfile reprotection engine automatically assesses rebooking options using your preferences and triggers compensation where applicable."/>
      <div className="card">
        <div className="ctitle">Regulatory Coverage</div>
        <div className="g3">
          {[["EU 261/2004","Europe · Delay, cancellation & denied boarding compensation up to €600"],["DOT 14 CFR 250","United States · Involuntary denied boarding compensation"],["Montreal Convention","International · Liability for delay, baggage loss, and personal injury"]].map(([t,d])=>(
            <div key={t} style={{background:"var(--ink3)",border:"1px solid var(--border)",borderRadius:12,padding:16}}>
              <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--accent)",marginBottom:8,letterSpacing:0.5}}>{t}</div>
              <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.6}}>{d}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="ctitle">Reprotection Pipeline</div>
        <div style={{display:"flex",gap:0,alignItems:"stretch"}}>
          {["Detect disruption","Assess rebooking options","Apply passenger prefs","Execute reprotection","Notify + compensate"].map((s,i)=>(
            <div key={i} style={{flex:1,textAlign:"center",position:"relative"}}>
              <div style={{background:i<4?"rgba(91,141,238,0.1)":"rgba(61,214,140,0.1)",border:`1px solid ${i<4?"rgba(91,141,238,0.2)":"rgba(61,214,140,0.2)"}`,borderRadius:10,padding:"12px 8px",margin:"0 4px",fontSize:11,color:i<4?"var(--accent)":"var(--accent2)"}}>
                <div style={{fontFamily:"var(--mono)",fontSize:8,opacity:0.6,marginBottom:5,letterSpacing:1}}>STEP {i+1}</div>{s}
              </div>
              {i<4&&<div style={{position:"absolute",right:-3,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",fontSize:16,zIndex:1}}>›</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Biometrics({passenger}){
  return(
    <div>
      <div className="ph"><div><div className="ptitle">Profile &amp; Biometrics</div><div className="psub">FRT · FIDO2/WebAuthn · NFC ePassport · ICAO 9303</div></div></div>
      <div className="g3" style={{marginBottom:18}}>
        {[{key:"frt_enrolled",label:"Face Recognition",sub:"ICAO 9303 · ISO/IEC 19794-5",icon:"👁",std:"FRT"},
          {key:"fido2_enrolled",label:"Fingerprint / FIDO2",sub:"W3C WebAuthn · FIDO Alliance",icon:"🔑",std:"FIDO2"},
          {key:"nfc_enrolled",label:"ePassport NFC",sub:"ISO 14443 · ICAO Doc 9303",icon:"📘",std:"NFC"}].map(b=>(
          <div key={b.key} className="card" style={{textAlign:"center",padding:24}}>
            <div style={{fontSize:32,marginBottom:12}}>{b.icon}</div>
            <div style={{fontFamily:"var(--display)",fontWeight:700,fontSize:15,marginBottom:5}}>{b.label}</div>
            <div style={{fontSize:11,color:"var(--muted)",marginBottom:14,lineHeight:1.5}}>{b.sub}</div>
            <span className={`badge ${passenger?.[b.key]?"bg":"bw"}`}>{passenger?.[b.key]?"✓ Enrolled":"Pending Enrollment"}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="ctitle">Enrollment &amp; Privacy</div>
        <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.8}}>Biometric enrollment is available at partner airports (SITA, NEC, Vision-Box) and via the UniProfile mobile app. Your biometric data is never stored in raw form — only encrypted cryptographic tokens are retained, compliant with ICAO 9303 and GDPR Article 9.</div>
      </div>
    </div>
  );
}

export default function App(){
  const [authMode,setAuthMode]=useState("login");
  const [user,setUser]=useState(null);
  const [uuid,setUuid]=useState(null);
  const [passenger,setPassenger]=useState(null);
  const [setupDone,setSetupDone]=useState(false);
  const [active,setActive]=useState("dashboard");
  const [context,setContext]=useState("bleisure");
  const [prefill,setPrefill]=useState("");
  const [loadingProfile,setLoadingProfile]=useState(false);

  useEffect(()=>{
    if(!user)return;
    setLoadingProfile(true);
    api(`/passengers/by-email?email=${encodeURIComponent(user.email)}`,"GET",null,user.token)
      .then(d=>{if(d.passenger){setPassenger(d.passenger);setUuid(d.passenger.uuid);setSetupDone(true);}})
      .catch(()=>{}).finally(()=>setLoadingProfile(false));
  },[user]);

  const handleLogin=u=>setUser(u);
  const handleSwitch=(mode,email="")=>{setAuthMode(mode);if(email)setPrefill(email);};
  const handleSetupComplete=(newUuid,passengerData)=>{
    setUuid(newUuid);setSetupDone(true);if(passengerData)setPassenger(passengerData);
    
  };
  const handleSignOut=()=>{setUser(null);setUuid(null);setPassenger(null);setSetupDone(false);setActive("dashboard");};
  const handleRefresh=()=>{
    if(!user)return;
    api(`/passengers/by-email?email=${encodeURIComponent(user.email)}`,"GET",null,user.token)
      .then(d=>{if(d.passenger){setPassenger(d.passenger);setUuid(d.passenger.uuid);}});
  };

  if(!user){
    if(authMode==="signup")return <><style>{CSS}</style><SignUpPage onSwitch={handleSwitch}/></>;
    return <><style>{CSS}</style><LoginPage onLogin={handleLogin} onSwitch={handleSwitch} prefill={prefill}/></>;
  }
  if(loadingProfile)return <><style>{CSS}</style><div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><div className="loading"><div className="spinner"></div>Loading your UniProfile…</div></div></>;
  if(!setupDone)return <><style>{CSS}</style><SetupWizard user={user} onComplete={handleSetupComplete}/></>;

  const NAV=[
    {id:"dashboard",label:"Dashboard",section:"overview"},
    {id:"order",label:"Offer & Order",section:"oneorder"},
    {id:"seat",label:"Seat & Ancillary",section:"oneorder"},
    {id:"disruption",label:"Disruption",section:"oneorder"},
    {id:"loyalty",label:"Loyalty",section:"oneorder"},
    {id:"payment",label:"Payment",section:"oneorder"},
    {id:"baggage",label:"BagJourney",section:"oneorder"},
    {id:"biometrics",label:"Biometrics",section:"identity"},
    {id:"consent",label:"Consent Engine",section:"identity"},
  ];

  const PAGES={
    dashboard:<Dashboard passenger={passenger} uuid={uuid} onRefresh={handleRefresh}/>,
    order:<Orders uuid={uuid} token={user.token}/>,
    seat:<SeatAncillary passenger={passenger}/>,
    disruption:<Disruption/>,
    loyalty:<Loyalty uuid={uuid} token={user.token}/>,
    payment:<Payment uuid={uuid} token={user.token}/>,
    baggage:<Baggage uuid={uuid} token={user.token}/>,
    biometrics:<Biometrics passenger={passenger}/>,
    consent:<Consent uuid={uuid} token={user.token}/>,
  };

  return(
    <>
      <style>{CSS}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="logo-area">
            <div className="logotype">Uni<span>Profile</span></div>
            <div className="logo-sub">IATA OneOrder · v2.0</div>
          </div>
          {uuid&&<div className="uuid-chip"><div className="uuid-lbl">Passenger UUID v7</div><div className="uuid-val">{uuid}</div></div>}
          <div className="ctx-row">
            {["business","bleisure","leisure"].map(c=>(
              <button key={c} className={`ctx-btn ${context===c?"on":""}`} onClick={()=>setContext(c)}>{c.charAt(0).toUpperCase()+c.slice(1,4)}</button>
            ))}
          </div>
          {["overview","oneorder","identity"].map(section=>(
            <div key={section}>
              <div className="nav-sec">{section==="overview"?"Overview":section==="oneorder"?"OneOrder Modules":"Identity"}</div>
              {NAV.filter(n=>n.section===section).map(n=>(
                <div key={n.id} className={`nav-item ${active===n.id?"on":""}`} onClick={()=>setActive(n.id)}>
                  <div className="nav-dot"></div>{n.label}
                </div>
              ))}
            </div>
          ))}
          <div className="sidebar-foot">
            <div className="user-email">{user.email}</div>
            <button className="signout-btn" onClick={handleSignOut}>Sign Out</button>
          </div>
        </aside>
        <main className="main">{PAGES[active]}</main>
      </div>
    </>
  );
}
