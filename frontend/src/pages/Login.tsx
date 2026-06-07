/**
 * pages/Login.tsx
 * ===============
 * Login and Register — Australian bank style, light mode.
 *
 * Demo behaviour:
 *  - Demo credentials autofilled on load
 *  - Any user sees the same data (data comes from ML service, not per-user DB)
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

const DEMO_EMAIL    = "test@test.com"
const DEMO_PASSWORD = "password123"

export default function Login() {
  const [mode,     setMode]     = useState<"login" | "register">("login")
  const [email,    setEmail]    = useState(DEMO_EMAIL)       // ← autofilled
  const [password, setPassword] = useState(DEMO_PASSWORD)   // ← autofilled
  const [name,     setName]     = useState("")
  const { login, register, loading, error } = useAuth()
  const navigate = useNavigate()

  // Switch mode — keep demo credentials filled on login tab
  const handleModeSwitch = (m: "login" | "register") => {
    setMode(m)
    if (m === "login") {
      setEmail(DEMO_EMAIL)
      setPassword(DEMO_PASSWORD)
    } else {
      setEmail("")
      setPassword("")
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (mode === "login") {
        await login({ email, password })
      } else {
        await register({ email, password, name })
        // After registering, seed the demo data for the new user
        // This runs in background — dashboard loads immediately
        import("../services/api").then(({ default: client }) => {
          client.post("/transactions/seed", { limit: 20 }).catch(() => {})
        })
      }
      navigate("/")
    } catch {
      // error is set by useAuth hook
    }
  }

  return (
    <div style={{
      minHeight:      "100vh",
      background:     "#F4F7FB",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      fontFamily:     "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background:   "#FFFFFF",
        border:       "1px solid #DDE3EC",
        borderRadius: 16,
        padding:      "40px",
        width:        "100%",
        maxWidth:     420,
        boxShadow:    "0 4px 24px rgba(0,0,0,.08)",
      }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:48, height:48, borderRadius:12, margin:"0 auto 12px",
            background:"linear-gradient(135deg, #0066CC 0%, #0047A3 100%)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
            💳
          </div>
          <div style={{ fontSize:20, fontWeight:700, color:"#0F1923" }}>FinanceIQ</div>
          <div style={{ fontSize:13, color:"#94A3B8", marginTop:4 }}>Open Banking · CDR</div>
        </div>

        {/* Demo banner */}
        <div style={{ background:"#F0F7FF", border:"1px solid #E8F1FB", borderRadius:8,
          padding:"10px 14px", marginBottom:20, fontSize:12, color:"#0066CC",
          display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>ℹ️</span>
          <span>
            Demo mode — credentials prefilled. Just click <strong>Sign In</strong>.
          </span>
        </div>

        {/* Mode toggle */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
          background:"#F4F7FB", borderRadius:8, padding:4, marginBottom:28 }}>
          {(["login","register"] as const).map(m => (
            <button key={m} onClick={() => handleModeSwitch(m)} style={{
              padding:"8px 0", borderRadius:6, border:"none", cursor:"pointer",
              fontSize:13, fontWeight:600,
              background:  mode===m ? "#FFFFFF" : "transparent",
              color:       mode===m ? "#0066CC" : "#94A3B8",
              boxShadow:   mode===m ? "0 1px 4px rgba(0,0,0,.08)" : "none",
              transition:  "all .15s", textTransform:"capitalize",
            }}>{m}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"#475569",
                display:"block", marginBottom:6, textTransform:"uppercase",
                letterSpacing:.5 }}>Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="John Smith" required
                style={{ width:"100%", padding:"10px 14px", fontSize:14,
                  border:"1px solid #DDE3EC", borderRadius:8, outline:"none",
                  color:"#1E293B", background:"#F8FAFC", boxSizing:"border-box" }} />
            </div>
          )}

          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, fontWeight:600, color:"#475569",
              display:"block", marginBottom:6, textTransform:"uppercase",
              letterSpacing:.5 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required
              style={{ width:"100%", padding:"10px 14px", fontSize:14,
                border:"1px solid #DDE3EC", borderRadius:8, outline:"none",
                color:"#1E293B", background:"#F8FAFC", boxSizing:"border-box" }} />
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:12, fontWeight:600, color:"#475569",
              display:"block", marginBottom:6, textTransform:"uppercase",
              letterSpacing:.5 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={6}
              style={{ width:"100%", padding:"10px 14px", fontSize:14,
                border:"1px solid #DDE3EC", borderRadius:8, outline:"none",
                color:"#1E293B", background:"#F8FAFC", boxSizing:"border-box" }} />
          </div>

          {error && (
            <div style={{ background:"#FEE2E2", border:"1px solid #FECACA",
              borderRadius:8, padding:"10px 14px", marginBottom:16,
              fontSize:13, color:"#C41E3A" }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width:"100%", padding:"12px 0", fontSize:14, fontWeight:600,
            color:"#FFFFFF",
            background: loading ? "#94A3B8" : "linear-gradient(135deg, #0066CC 0%, #004FB3 100%)",
            border:"none", borderRadius:8, cursor: loading ? "not-allowed" : "pointer",
            boxShadow:"0 2px 8px rgba(0,102,204,.3)", transition:"all .2s",
          }}>
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign:"center", fontSize:12, color:"#94A3B8", marginTop:24 }}>
          Protected by JWT authentication
        </p>
      </div>
    </div>
  )
}