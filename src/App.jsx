import { useState, useEffect } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || "https://0wsxmo9ftg.execute-api.us-east-1.amazonaws.com/prod";
const COGNITO_DOMAIN = `https://uniprofile-auth.auth.us-east-1.amazoncognito.com`;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || "2heljmdli4f9cv2i4m0i020mfc";
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || "us-east-1_OqNHNEWZP";
const REGION = import.meta.env.VITE_REGION || "us-east-1";

// ── CSS ───────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --ink:#0a0d14;--ink2:#141824;--ink3:#1e2433;
    --border:rgba(255,255,255,0.07);--border2:rgba(255,255,255,0.13);
    --text:#e8eaf0;--muted:#7a8099;
    --accent:#5b8dee;--accent2:#3dd68c;--warn:#f5a623;--danger:#e85d5d;--purple:#a78bfa;
    --mono:'DM Mono',monospace;--sans:'DM Sans',sans-serif;--display:'Syne',sans-serif;
  }
  body{background:var(--ink);color:var(--text);font-family:var(--sans);font-size:14px;line-height:1.6;min-height:100vh}
  .app{display:flex;min-height:100vh}

  /* AUTH PAGES */
  .auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--ink)}
  .auth-card{background:var(--ink2);border:1px solid var(--border);border-radius:16px;padding:40px;width:100%;max-width:420px}
  .auth-logo{font-family:var(--display);font-size:24px;font-weight:800;margin-bottom:8px}
  .auth-logo span{color:var(--accent)}
  .auth-sub{font-size:12px;color:var(--muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:32px}
  .auth-title{font-family:var(--display);font-size:20px;font-weight:700;margin-bottom:24px}
  .field{margin-bottom:16px}
  .field label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-family:var(--mono);margin-bottom:6px}
  .field input,.field select{width:100%;background:var(--ink3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--sans);font-size:13px;padding:10px 12px;outline:none;transition:border-color 0.12s}
  .field input:focus,.field select:focus{border-color:var(--accent)}
  .field select option{background:var(--ink3)}
  .btn-full{width:100%;padding:12px;border-radius:8px;background:var(--accent);border:none;color:#fff;font-family:var(--mono);font-size:12px;font-weight:500;cursor:pointer;transition:background 0.12s;letter-spacing:0.5px}
  .btn-full:hover{background:#4a7de0}
  .btn-full:disabled{opacity:0.5;cursor:not-allowed}
  .auth-switch{text-align:center;margin-top:20px;font-size:12px;color:var(--muted)}
  .auth-switch a{color:var(--accent);cursor:pointer;text-decoration:none}
  .auth-switch a:hover{text-decoration:underline}
  .error-msg{background:rgba(232,93,93,0.1);border:1px solid rgba(232,93,93,0.25);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--danger);margin-bottom:16px}
  .success-msg{background:rgba(61,214,140,0.1);border:1px solid rgba(61,214,140,0.25);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--accent2);margin-bottom:16px}
  .divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:var(--muted);font-size:11px}
  .divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border)}

  /* SIDEBAR */
  .sidebar{width:210px;min-width:210px;background:var(--ink2);border-right:1px solid var(--border);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;overflow:hidden}
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
  .signout-btn{width:100%;padding:8px;border-radius:7px;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:var(--mono);font-size:10px;cursor:pointer;transition:all 0.12s;text-transform:uppercase;letter-spacing:0.5px}
  .signout-btn:hover{border-color:var(--danger);color:var(--danger)}

  /* MAIN */
  .main{flex:1;overflow-y:auto;padding:22px 24px;height:100vh}
  .ph{margin-bottom:20px}
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
  .ssub{font-size:10px;color:var(--muted);margin-top:2px}
  .fr{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
  .fr:last-child{border-bottom:none}
  .fl{font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:var(--muted);font-family:var(--mono)}
  .fv{font-size:12px;color:var(--text);text-align:right;font-family:var(--mono)}
  .badge{display:inline-block;font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px}
  .bg{background:rgba(61,214,140,0.12);color:var(--accent2);border:1px solid rgba(61,214,140,0.22)}
  .bb{background:rgba(91,141,238,0.12);color:var(--accent);border:1px solid rgba(91,141,238,0.22)}
  .bw{background:rgba(245,166,35,0.12);color:var(--warn);border:1px solid rgba(245,166,35,0.22)}
  .bp{background:rgba(167,139,250,0.12);color:var(--purple);border:1px solid rgba(167,139,250,0.22)}
  .empty-state{text-align:center;padding:48px 24px;color:var(--muted)}
  .empty-icon{font-size:36px;margin-bottom:12px;opacity:0.4}
  .empty-title{font-family:var(--display);font-size:16px;font-weight:600;margin-bottom:6px;color:var(--text)}
  .empty-sub{font-size:12px;line-height:1.6}
  .loading{display:flex;align-items:center;justify-content:center;padding:48px;color:var(--muted);font-family:var(--mono);font-size:12px;gap:10px}
  .spinner{width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .tbl{width:100%;border-collapse:collapse}
  .tbl th{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-family:var(--mono);text-align:left;padding:6px 10px;border-bottom:1px solid var(--border)}
  .tbl td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,0.03);font-size:12px;vertical-align:middle}
  .tbl tr:last-child td{border-bottom:none}
  .mono{font-family:var(--mono)}
  .acc{color:var(--accent)}.acc2{color:var(--accent2)}.muted{color:var(--muted)}.warn{color:var(--warn)}.pur{color:var(--purple)}
  .setup-wizard{max-width:560px;margin:0 auto}
  .wizard-step{background:var(--ink2);border:1px solid var(--border);border-radius:12px;padding:28px;margin-bottom:16px}
  .wizard-step-num{font-family:var(--mono);font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .wizard-step-title{font-family:var(--display);font-size:18px;font-weight:700;margin-bottom:20px}
  .btn-primary{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:8px;background:var(--accent);border:none;color:#fff;font-family:var(--mono);font-size:12px;cursor:pointer;transition:background 0.12s}
  .btn-primary:hover{background:#4a7de0}
  .btn-primary:disabled{opacity:0.5;cursor:not-allowed}
  .g2-field{display:grid;grid-template-columns:1fr 1fr;gap:12px}
`;

// ── COGNITO AUTH HELPERS ──────────────────────────────────────────────────
const COGNITO_URL = `https://cognito-idp.${REGION}.amazonaws.com/`;

async function cognitoRequest(action, body) {
  const res = await fetch(COGNITO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.__type || "Auth error");
  return data;
}

async function signUp(email, password, firstName, lastName) {
  return cognitoRequest("SignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "given_name", Value: firstName },
      { Name: "family_name", Value: lastName },
    ],
  });
}

async function confirmSignUp(email, code) {
  return cognitoRequest("ConfirmSignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  });
}

async function signIn(email, password) {
  return cognitoRequest("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
}

async function forgotPassword(email) {
  return cognitoRequest("ForgotPassword", { ClientId: CLIENT_ID, Username: email });
}

// ── API HELPERS ───────────────────────────────────────────────────────────
async function apiCall(path, method = "GET", body = null, token) {
  const res = await fetch(`${API_URL}/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

// ── UUID v7 GENERATOR ─────────────────────────────────────────────────────
function generateUUID() {
  const now = Date.now();
  const hex = now.toString(16).padStart(12, "0");
  const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  const r12 = () => Math.floor(Math.random() * 0x1000000000000).toString(16).padStart(12, "0");
  return `${hex.slice(0,8)}-${hex.slice(8)}-7${r().slice(1)}-${(0x8000|Math.random()*0x3fff).toString(16)}-${r12()}`;
}

// ── SIGN UP PAGE ──────────────────────────────────────────────────────────
function SignUpPage({ onSwitch }) {
  const [step, setStep] = useState("details"); // details | verify
  const [form, setForm] = useState({ firstName:"", lastName:"", email:"", password:"", confirm:"" });
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSignUp = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password)
      return setError("All fields are required");
    if (form.password !== form.confirm)
      return setError("Passwords do not match");
    if (form.password.length < 8)
      return setError("Password must be at least 8 characters");
    setError(""); setLoading(true);
    try {
      await signUp(form.email, form.password, form.firstName, form.lastName);
      setStep("verify");
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!code) return setError("Enter the verification code");
    setError(""); setLoading(true);
    try {
      await confirmSignUp(form.email, code);
      onSwitch("login", form.email);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  if (step === "verify") return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Uni<span>Profile</span></div>
        <div className="auth-sub">IATA OneOrder · v2.0</div>
        <div className="auth-title">Check your email</div>
        <p style={{ fontSize:13, color:"var(--muted)", marginBottom:24 }}>
          We sent a verification code to <strong style={{color:"var(--text)"}}>{form.email}</strong>
        </p>
        {error && <div className="error-msg">{error}</div>}
        <div className="field">
          <label>Verification Code</label>
          <input value={code} onChange={e=>setCode(e.target.value)} placeholder="123456" maxLength={6} />
        </div>
        <button className="btn-full" onClick={handleVerify} disabled={loading}>
          {loading ? "Verifying…" : "Verify Email →"}
        </button>
        <div className="auth-switch" style={{marginTop:16}}>
          <a onClick={()=>setStep("details")}>← Back</a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Uni<span>Profile</span></div>
        <div className="auth-sub">IATA OneOrder · v2.0</div>
        <div className="auth-title">Create your passenger profile</div>
        {error && <div className="error-msg">{error}</div>}
        <div className="g2-field">
          <div className="field"><label>First Name</label><input value={form.firstName} onChange={set("firstName")} placeholder="Rommel" /></div>
          <div className="field"><label>Last Name</label><input value={form.lastName} onChange={set("lastName")} placeholder="Santos" /></div>
        </div>
        <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" /></div>
        <div className="field"><label>Password</label><input type="password" value={form.password} onChange={set("password")} placeholder="Min. 8 characters" /></div>
        <div className="field"><label>Confirm Password</label><input type="password" value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" /></div>
        <button className="btn-full" onClick={handleSignUp} disabled={loading}>
          {loading ? "Creating account…" : "Create UniProfile →"}
        </button>
        <div className="auth-switch">Already have an account? <a onClick={()=>onSwitch("login")}>Sign in</a></div>
      </div>
    </div>
  );
}

// ── LOGIN PAGE ────────────────────────────────────────────────────────────
function LoginPage({ onLogin, onSwitch, prefillEmail }) {
  const [form, setForm] = useState({ email: prefillEmail||"", password:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login"); // login | forgot | forgot-sent

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleLogin = async () => {
    if (!form.email || !form.password) return setError("Email and password required");
    setError(""); setLoading(true);
    try {
      const data = await signIn(form.email, form.password);
      const tokens = data.AuthenticationResult;
      onLogin({ email: form.email, token: tokens.IdToken, accessToken: tokens.AccessToken });
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!form.email) return setError("Enter your email first");
    setError(""); setLoading(true);
    try {
      await forgotPassword(form.email);
      setMode("forgot-sent");
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  if (mode === "forgot-sent") return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Uni<span>Profile</span></div>
        <div className="auth-sub">IATA OneOrder · v2.0</div>
        <div className="success-msg">Password reset email sent to {form.email}</div>
        <button className="btn-full" onClick={()=>setMode("login")}>Back to Sign In</button>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Uni<span>Profile</span></div>
        <div className="auth-sub">IATA OneOrder · v2.0</div>
        <div className="auth-title">{mode==="forgot" ? "Reset password" : "Sign in to UniProfile"}</div>
        {error && <div className="error-msg">{error}</div>}
        <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" /></div>
        {mode === "login" && (
          <div className="field"><label>Password</label><input type="password" value={form.password} onChange={set("password")} placeholder="Your password" onKeyDown={e=>e.key==="Enter"&&handleLogin()} /></div>
        )}
        {mode === "login"
          ? <button className="btn-full" onClick={handleLogin} disabled={loading}>{loading?"Signing in…":"Sign In →"}</button>
          : <button className="btn-full" onClick={handleForgot} disabled={loading}>{loading?"Sending…":"Send Reset Email →"}</button>
        }
        <div className="auth-switch" style={{marginTop:12}}>
          {mode==="login"
            ? <><a onClick={()=>setMode("forgot")}>Forgot password?</a> · <a onClick={()=>onSwitch("signup")}>Create account</a></>
            : <a onClick={()=>setMode("login")}>← Back to sign in</a>
          }
        </div>
      </div>
    </div>
  );
}

// ── PROFILE SETUP WIZARD ──────────────────────────────────────────────────
function SetupWizard({ user, onComplete }) {
  const [form, setForm] = useState({
    phone:"", nationality:"", passportNo:"", passportExpiry:"",
    dob:"", seatPref:"Window", mealPref:"AVML", cabinPref:"Economy", context:"leisure"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setLoading(true); setError("");
    try {
      const uuid = generateUUID();
      const nameParts = user.email.split("@")[0].split(".");
      await apiCall("/passengers", "POST", {
        uuid,
        firstName: user.firstName || nameParts[0] || "Passenger",
        lastName: user.lastName || nameParts[1] || "User",
        email: user.email,
        phone: form.phone,
        nationality: form.nationality,
        passportNo: form.passportNo,
        passportExpiry: form.passportExpiry || null,
        dateOfBirth: form.dob || null,
        context: form.context,
        seatPreference: form.seatPref,
        mealPreference: form.mealPref,
        cabinPreference: form.cabinPref,
      }, user.token);
      onComplete(uuid);
    } catch (e) { setError("Could not create profile. Please try again."); }
    setLoading(false);
  };

  return (
    <div className="main">
      <div className="setup-wizard">
        <div className="ph">
          <div className="ptitle">Welcome to UniProfile</div>
          <div className="psub">Let's set up your passenger identity — takes 2 minutes</div>
        </div>
        {error && <div className="error-msg" style={{borderRadius:8,padding:"10px 14px",marginBottom:16}}>{error}</div>}
        <div className="wizard-step">
          <div className="wizard-step-num">Step 1 of 2</div>
          <div className="wizard-step-title">Personal & Travel Documents</div>
          <div className="g2-field">
            <div className="field"><label>Phone</label><input value={form.phone} onChange={set("phone")} placeholder="+1 571 555 0192" /></div>
            <div className="field"><label>Nationality (ISO)</label><input value={form.nationality} onChange={set("nationality")} placeholder="PHL" maxLength={3} /></div>
          </div>
          <div className="g2-field">
            <div className="field"><label>Passport Number</label><input value={form.passportNo} onChange={set("passportNo")} placeholder="P12345678" /></div>
            <div className="field"><label>Passport Expiry</label><input type="date" value={form.passportExpiry} onChange={set("passportExpiry")} /></div>
          </div>
          <div className="field"><label>Date of Birth</label><input type="date" value={form.dob} onChange={set("dob")} /></div>
        </div>
        <div className="wizard-step">
          <div className="wizard-step-num">Step 2 of 2</div>
          <div className="wizard-step-title">Travel Preferences</div>
          <div className="g2-field">
            <div className="field"><label>Seat Preference</label>
              <select value={form.seatPref} onChange={set("seatPref")}>
                <option>Window</option><option>Aisle</option><option>Middle</option>
              </select>
            </div>
            <div className="field"><label>Cabin</label>
              <select value={form.cabinPref} onChange={set("cabinPref")}>
                <option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option>
              </select>
            </div>
          </div>
          <div className="g2-field">
            <div className="field"><label>Meal Preference</label>
              <select value={form.mealPref} onChange={set("mealPref")}>
                <option value="AVML">Asian Vegetarian</option>
                <option value="VGML">Vegan</option>
                <option value="HNML">Hindu</option>
                <option value="MOML">Muslim</option>
                <option value="KSML">Kosher</option>
                <option value="GFML">Gluten Free</option>
                <option value="NLML">No Preference</option>
              </select>
            </div>
            <div className="field"><label>Travel Context</label>
              <select value={form.context} onChange={set("context")}>
                <option value="leisure">Leisure</option>
                <option value="business">Business</option>
                <option value="bleisure">Bleisure</option>
              </select>
            </div>
          </div>
        </div>
        <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{width:"100%",justifyContent:"center",padding:"14px"}}>
          {loading ? "Creating your UniProfile…" : "Complete Setup →"}
        </button>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────
function Dashboard({ passenger, uuid }) {
  if (!passenger) return <div className="loading"><div className="spinner"></div>Loading profile…</div>;
  return (
    <div>
      <div className="ph">
        <div className="ptitle">Welcome, {passenger.first_name}</div>
        <div className="psub">Your UniProfile Identity Dashboard · IATA OneOrder</div>
      </div>
      <div className="g4" style={{marginBottom:14}}>
        <div className="stat"><div className="slbl">UUID v7</div><div style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--accent)",marginTop:4,wordBreak:"break-all"}}>{uuid}</div></div>
        <div className="stat"><div className="slbl">Context</div><div className="sval" style={{fontSize:16,marginTop:4}}><span className="badge bp">{passenger.bleisure_context||"leisure"}</span></div></div>
        <div className="stat"><div className="slbl">Cabin Pref</div><div className="sval" style={{fontSize:16,marginTop:4}}>{passenger.cabin_preference||"—"}</div></div>
        <div className="stat"><div className="slbl">Meal Code</div><div className="sval" style={{fontSize:16,marginTop:4}}>{passenger.meal_preference||"—"}</div></div>
      </div>
      <div className="g2">
        <div className="card">
          <div className="ctitle">Identity</div>
          <div className="fr"><span className="fl">Full Name</span><span className="fv">{passenger.first_name} {passenger.last_name}</span></div>
          <div className="fr"><span className="fl">Email</span><span className="fv" style={{fontSize:11}}>{passenger.email}</span></div>
          <div className="fr"><span className="fl">Phone</span><span className="fv">{passenger.phone||"—"}</span></div>
          <div className="fr"><span className="fl">Nationality</span><span className="fv">{passenger.nationality||"—"}</span></div>
          <div className="fr"><span className="fl">Passport</span><span className="fv">{passenger.passport_number||"—"}</span></div>
          <div className="fr"><span className="fl">Expiry</span><span className="fv">{passenger.passport_expiry ? new Date(passenger.passport_expiry).toLocaleDateString() : "—"}</span></div>
        </div>
        <div className="card">
          <div className="ctitle">Preferences</div>
          <div className="fr"><span className="fl">Seat</span><span className="fv">{passenger.seat_preference||"—"}</span></div>
          <div className="fr"><span className="fl">Meal</span><span className="fv">{passenger.meal_preference||"—"}</span></div>
          <div className="fr"><span className="fl">Cabin</span><span className="fv">{passenger.cabin_preference||"—"}</span></div>
          <div className="fr"><span className="fl">Lounge</span><span className="fv">{passenger.lounge_access?"Yes":"No"}</span></div>
          <div className="fr"><span className="fl">Context</span><span className="fv">{passenger.bleisure_context||"—"}</span></div>
          <div className="fr"><span className="fl">Member Since</span><span className="fv">{new Date(passenger.created_at).toLocaleDateString()}</span></div>
        </div>
      </div>
      <div className="card">
        <div className="ctitle">Biometric Enrollment</div>
        <div style={{display:"flex",gap:10}}>
          <span className={`badge ${passenger.frt_enrolled?"bg":"bw"}`}>FRT {passenger.frt_enrolled?"✓":"pending"}</span>
          <span className={`badge ${passenger.fido2_enrolled?"bg":"bw"}`}>FIDO2 {passenger.fido2_enrolled?"✓":"pending"}</span>
          <span className={`badge ${passenger.nfc_enrolled?"bg":"bw"}`}>NFC {passenger.nfc_enrolled?"✓":"pending"}</span>
        </div>
        <div style={{fontSize:11,color:"var(--muted)",marginTop:10}}>Biometric enrollment available at partner airports and via the UniProfile mobile app.</div>
      </div>
    </div>
  );
}

// ── EMPTY MODULE ──────────────────────────────────────────────────────────
function EmptyModule({ icon, title, sub }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [user, setUser] = useState(null);           // { email, token }
  const [uuid, setUuid] = useState(null);
  const [passenger, setPassenger] = useState(null);
  const [setupDone, setSetupDone] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");
  const [context, setContext] = useState("bleisure");
  const [prefillEmail, setPrefillEmail] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Load passenger profile after login
  useEffect(() => {
    if (!user) return;
    setLoadingProfile(true);
    apiCall(`/passengers/by-email?email=${encodeURIComponent(user.email)}`, "GET", null, user.token)
      .then(data => {
        if (data.passenger) {
          setPassenger(data.passenger);
          setUuid(data.passenger.uuid);
          setSetupDone(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleSwitch = (mode, email = "") => {
    setAuthMode(mode);
    if (email) setPrefillEmail(email);
  };

  const handleSetupComplete = (newUuid) => {
    setUuid(newUuid);
    setSetupDone(true);
    apiCall(`/passengers/${newUuid}`, "GET", null, user.token)
      .then(data => { if (data.passenger) setPassenger(data.passenger); });
  };

  const handleSignOut = () => {
    setUser(null); setUuid(null); setPassenger(null);
    setSetupDone(false); setActivePage("dashboard");
  };

  // Not logged in
  if (!user) {
    if (authMode === "signup") return <SignUpPage onSwitch={handleSwitch} />;
    return <LoginPage onLogin={handleLogin} onSwitch={handleSwitch} prefillEmail={prefillEmail} />;
  }

  // Loading profile
  if (loadingProfile) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div className="loading"><div className="spinner"></div>Loading your UniProfile…</div>
    </div>
  );

  // First-time setup
  if (!setupDone) return <SetupWizard user={user} onComplete={handleSetupComplete} />;

  const NAV = [
    { id:"dashboard", label:"Dashboard", section:"overview" },
    { id:"order", label:"Offer & Order", section:"oneorder" },
    { id:"seat", label:"Seat & Ancillary", section:"oneorder" },
    { id:"disruption", label:"Disruption", section:"oneorder" },
    { id:"loyalty", label:"Loyalty", section:"oneorder" },
    { id:"payment", label:"Payment", section:"oneorder" },
    { id:"baggage", label:"BagJourney", section:"oneorder" },
    { id:"biometrics", label:"Biometrics", section:"identity" },
    { id:"consent", label:"Consent Engine", section:"identity" },
  ];

  const PAGES = {
    dashboard: <Dashboard passenger={passenger} uuid={uuid} />,
    order: <EmptyModule icon="✈️" title="No orders yet" sub="Your IATA OneOrder bookings will appear here once you book through a connected airline or TMC." />,
    seat: <EmptyModule icon="💺" title="No ancillary services" sub="Seat selections, meal orders, and lounge access will appear here." />,
    disruption: <EmptyModule icon="⚡" title="No disruptions" sub="Flight disruptions and reprotection actions will appear here automatically." />,
    loyalty: <EmptyModule icon="⭐" title="No loyalty programs" sub="Add your frequent flyer numbers to start consolidating miles across airlines." />,
    payment: <EmptyModule icon="💳" title="No payment methods" sub="Your BSP-tokenised payment methods will appear here." />,
    baggage: <EmptyModule icon="🧳" title="No baggage tracked" sub="Real-time RFID baggage tracking will appear here during active trips." />,
    biometrics: <EmptyModule icon="🪪" title="Biometrics not enrolled" sub="Visit a partner airport or use the UniProfile mobile app to enroll FRT, FIDO2, or NFC." />,
    consent: <EmptyModule icon="🔒" title="No consent grants" sub="Data sharing consents with airlines, TMCs, and airports will appear here." />,
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
              <div className="uuid-lbl">Passenger UUID</div>
              <div className="uuid-val">{uuid}</div>
            </div>
          )}
          <div className="ctx-row">
            {["business","bleisure","leisure"].map(c => (
              <button key={c} className={`ctx-btn ${context===c?"on":""}`} onClick={()=>setContext(c)}>{c.charAt(0).toUpperCase()+c.slice(1,3)}</button>
            ))}
          </div>
          {["overview","oneorder","identity"].map(section => (
            <div key={section}>
              <div className="nav-sec">{section==="overview"?"Overview":section==="oneorder"?"OneOrder Modules":"Identity"}</div>
              {NAV.filter(n=>n.section===section).map(n => (
                <div key={n.id} className={`nav-item ${activePage===n.id?"on":""}`} onClick={()=>setActivePage(n.id)}>
                  <div className="nav-dot"></div>{n.label}
                </div>
              ))}
            </div>
          ))}
          <div className="sidebar-foot">
            <div style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--mono)",marginBottom:6}}>{user.email}</div>
            <button className="signout-btn" onClick={handleSignOut}>Sign Out</button>
          </div>
        </aside>
        <main className="main">{PAGES[activePage]}</main>
      </div>
    </>
  );
}
