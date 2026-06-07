/**
 * pages/Dashboard.tsx
 * ====================
 * Layout matches design2.html (dashboard) and design1.html (transaction history).
 * Amendments applied:
 *  - "Review All Alerts" opens a modal
 *  - ML Accuracy metric removed
 *  - "View Insights" in sidebar opens insights modal
 *  - Removed Security, Support links from sidebar
 *  - Removed Bell, Settings icons from header
 *  - Transaction method simplified to "Card"
 *  - Spending Categories shows all cats, click to expand top-3 merchants
 *  - Subscriptions section: new + continuing, all from ML data
 *  - No fictional data — "No data available at the moment" when empty
 */

import { useState, useMemo } from "react"
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
// Google Material Icons — loaded via CDN in index.html
//<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
const MI = ({ name, size = 20, color = "currentColor", style = {} }: {
  name: string; size?: number; color?: string; style?: React.CSSProperties
}) => (
  <span
    className="material-icons"
    style={{ fontSize: size, color, lineHeight: 1, userSelect: "none",
      display: "inline-flex", alignItems: "center", ...style }}
  >
    {name}
  </span>
)
import { useAuth }          from "../hooks/useAuth"
import { useFinancialData } from "../hooks/useFinancialData"
import type { Transaction, AnomalyAlert, Insights, Metrics } from "../types/api"
import MLInsightsPanel from "../components/MLInsightsPanel"
// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  surface:            "#f8f9ff",
  surfaceLow:         "#eff4ff",
  surfaceContainer:   "#e5eeff",
  surfaceHigh:        "#dce9ff",
  surfaceLowest:      "#ffffff",
  onSurface:          "#0b1c30",
  onSurfaceVariant:   "#45464d",
  outline:            "#76777d",
  outlineVariant:     "#c6c6cd",
  primary:            "#0b1c30",
  primaryHover:       "#131b2e",
  onPrimary:          "#ffffff",
  secondary:          "#0051d5",
  secondaryHover:     "#003ea8",
  secondarySoft:      "#dbe1ff",
  secondaryContainer: "#316bf3",
  success:            "#0d8a4a",
  successSoft:        "#dcf2e3",
  warning:            "#9a5b00",
  warningSoft:        "#fde7c2",
  error:              "#ba1a1a",
  errorSoft:          "#ffdad6",
  onError:            "#ffffff",
  muted:              "#7a8694",
}

const CATEGORY_COLORS: Record<string, string> = {
  groceries:    "#0d8a4a",
  dining:       "#0051d5",
  utilities:    "#6845c4",
  transport:    "#0c7b9e",
  entertainment:"#b8276a",
  shopping:     "#9a5b00",
  healthcare:   "#0a7a5d",
  subscription: "#4f55c4",
  other:        T.muted,
}

const CATEGORY_ICONS: Record<string, string> = {
  groceries: "grocery", dining: "dining", utilities: "power", transport: "directions_car",
  entertainment: "music_note", shopping: "shopping_bag", healthcare: "cardiology",
  subscription: "subscriptions", other: "album",
}

// ── Shared primitives ─────────────────────────────────────────────────────────
type CardProps = React.HTMLAttributes<HTMLDivElement>

const Card = ({ children, style, ...rest }: CardProps) => (
  <div {...rest} style={{
    background: T.surfaceLowest, border: `1px solid ${T.outlineVariant}`,
    borderRadius: 16, boxShadow: "0 4px 20px rgba(15,23,42,.05)", ...style,
  }}>{children}</div>
)

const CardTitle = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 12, fontWeight: 600, color: T.onSurfaceVariant,
    textTransform: "uppercase", letterSpacing: 0.6, margin: 0 }}>{children}</p>
)

const Divider = () => (
  <div style={{ height: 1, background: T.outlineVariant, margin: "0 24px", opacity: 0.6 }} />
)

const Badge = ({ children, color = "neutral" }: { children: React.ReactNode; color?: string }) => {
  const map: Record<string, { bg: string; text: string }> = {
    blue:    { bg: T.secondarySoft,    text: T.secondary        },
    green:   { bg: T.successSoft,      text: T.success          },
    amber:   { bg: T.warningSoft,      text: T.warning          },
    red:     { bg: T.errorSoft,        text: T.error            },
    neutral: { bg: T.surfaceContainer, text: T.onSurfaceVariant },
  }
  const s = map[color] ?? map.neutral
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: 999, fontSize: 11, fontWeight: 600, background: s.bg, color: s.text }}>
      {children}
    </span>
  )
}

const Squiggle = ({ color = T.secondary, width = 56 }: { color?: string; width?: number }) => (
  <svg width={width} height="8" viewBox="0 0 56 8" aria-hidden="true">
    <path d="M2 5 C 8 1, 14 8, 22 4 S 36 1, 44 5 S 52 3, 54 4"
      stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
  </svg>
)

// ── Loading / error ───────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", minHeight: 320, gap: 14, color: T.muted }}>
    <MI name="sync" size={28} style={{ animation: "ethos-spin 1s linear infinite" }} />
    <span style={{ fontSize: 13 }}>Loading your financial data…</span>
  </div>
)

const ErrorBanner = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div style={{ padding: "16px 20px", background: T.errorSoft, borderRadius: 12,
    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <MI name="warning" size={16} color={T.error} />
      <span style={{ fontSize: 13, color: T.error, fontWeight: 500 }}>{message}</span>
    </div>
    <button onClick={onRetry} style={{ fontSize: 12, color: T.error, fontWeight: 600,
      cursor: "pointer", background: "none", border: "none", padding: "6px 10px", borderRadius: 6 }}>
      Retry
    </button>
  </div>
)

// ── Modal shell ───────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, wide = false }: {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 200,
    background: "rgba(11,28,48,.45)", display: "flex",
    alignItems: "center", justifyContent: "center", padding: 24 }}
    onClick={onClose}>
    <div style={{ background: T.surfaceLowest, borderRadius: 20,
      width: "100%", maxWidth: wide ? 680 : 540,
      maxHeight: "85vh", overflow: "hidden",
      display: "flex", flexDirection: "column",
      boxShadow: "0 24px 60px rgba(11,28,48,.18)" }}
      onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "20px 24px",
        borderBottom: `1px solid ${T.outlineVariant}` }}>
        {title}
        <button onClick={onClose} style={{ background: "none", border: "none",
          cursor: "pointer", color: T.muted, display: "flex",
          padding: 4, borderRadius: 6 }}>
          <MI name="close" size={18} />
        </button>
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>{children}</div>
    </div>
  </div>
)

// ── Alerts Modal ──────────────────────────────────────────────────────────────
const AlertsModal = ({ anomalies, onClose }: { anomalies: AnomalyAlert[]; onClose: () => void }) => (
  <Modal wide onClose={onClose} title={
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: T.errorSoft,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MI name="gpp_bad" size={18} color={T.error} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.onSurface }}>All Fraud Alerts</div>
        <div style={{ fontSize: 12, color: T.onSurfaceVariant }}>
          {anomalies.length} alert{anomalies.length !== 1 ? "s" : ""} detected by ML model
        </div>
      </div>
    </div>
  }>
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
      {anomalies.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: T.muted }}>
          <MI name="check_circle" size={32} color={T.success} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, color: T.onSurface, marginBottom: 4 }}>All clear</p>
          <p style={{ fontSize: 13 }}>No data available at the moment.</p>
        </div>
      ) : (
        anomalies.map(a => (
          <div key={a.transaction_id} style={{
            background: a.severity === "high" ? T.errorSoft : T.warningSoft,
            borderRadius: 12, borderLeft: `4px solid ${a.severity === "high" ? T.error : T.warning}`,
            padding: "14px 16px", display: "flex", gap: 14 }}>
            <MI name="gpp_bad" size={20} color={a.severity === "high" ? T.error : T.warning}
              style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.onSurface,
                  textTransform: "capitalize" }}>
                  {a.anomaly_type.replace(/_/g, " ")}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge color={a.severity === "high" ? "red" : "amber"}>
                    {a.severity}
                  </Badge>
                  <span style={{ fontSize: 14, fontWeight: 700,
                    color: a.severity === "high" ? T.error : T.warning }}>
                    ${a.amount.toFixed(2)}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.onSurface,
                marginBottom: 4, textTransform: "capitalize" }}>{a.merchant}</div>
              <div style={{ fontSize: 12, color: T.onSurfaceVariant, lineHeight: 1.5 }}>
                {a.description}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </Modal>
)

// ── Insights Modal ────────────────────────────────────────────────────────────
const InsightsModal = ({ insights, count, onClose }: {
  insights: Insights | null
  count: number
  onClose: () => void
}) => (
  <Modal wide onClose={onClose} title={
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: T.secondarySoft,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MI name="auto_awesome" size={18} color={T.secondary} />
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.onSurface }}>AI Insights</span>
          <Squiggle width={36} />
        </div>
        <div style={{ fontSize: 12, color: T.onSurfaceVariant }}>
          {insights ? insights.confidence_note : "Generated by ML model"}
        </div>
      </div>
    </div>
  }>
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      {!insights ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: T.muted }}>
          <MI name="auto_awesome" size={28} color={T.muted} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, color: T.onSurface, marginBottom: 4 }}>No insights yet</p>
          <p style={{ fontSize: 13 }}>No data available at the moment.</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14, color: T.onSurface, lineHeight: 1.7,
            background: T.surfaceLow, borderRadius: 12, padding: "14px 16px",
            whiteSpace: "pre-wrap", border: `1px solid ${T.outlineVariant}` }}>
            {insights.summary}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.onSurfaceVariant,
              textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
              Recommendations
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {insights.recommendations.map((rec, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px",
                  background: T.surfaceLowest, borderRadius: 10,
                  border: `1px solid ${T.outlineVariant}` }}>
                  <span style={{ color: T.secondary, fontWeight: 700, fontSize: 13, minWidth: 22 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 13, color: T.onSurface, lineHeight: 1.6 }}>{rec}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: T.muted, display: "flex",
            alignItems: "center", gap: 6, paddingTop: 4 }}>
            <MI name="bolt" size={11} /> Generated from {count} ML-classified transactions
          </div>
        </>
      )}
    </div>
  </Modal>
)

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ tab, setTab, user, logout, onViewInsights, onViewMLInsights }: {
  tab: string
  setTab: (t: string) => void
  user: { name: string } | null
  logout: () => void
  onViewInsights: () => void
  onViewMLInsights: () => void
}) => {
  const initials = user?.name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) ?? "U"

  const navBtn = (id: string, label: string, iconName: string) => {
    const active = tab === id
    return (
      <button key={id} onClick={() => setTab(id)} style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", borderRadius: 10, border: "none",
        cursor: "pointer", width: "100%", textAlign: "left",
        background: active ? T.secondaryContainer : "transparent",
        color: active ? "#fff" : T.onSurfaceVariant,
        fontWeight: active ? 700 : 500, fontSize: 14,
        transition: "background .15s",
        boxShadow: active ? "0 2px 8px rgba(0,81,213,.18)" : "none",
      }}>
        <MI name={iconName} size={18} />{label}
      </button>
    )
  }

  return (
    <aside style={{ width: 256, height: "100vh", position: "fixed", left: 0, top: 0,
      background: T.surfaceLow, borderRight: `1px solid ${T.outlineVariant}`,
      display: "flex", flexDirection: "column", padding: 16, zIndex: 50,
      overflowY: "auto" }}>

      {/* Logo */}
      <div style={{ marginBottom: 28, padding: "4px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: T.primary,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: T.onPrimary, fontSize: 16, fontWeight: 700 }}>E</div>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.onSurface,
            letterSpacing: "-0.01em" }}>Ethos Finance</span>
        </div>
      </div>

      {/* User profile */}
      <div style={{ display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", marginBottom: 20,
        background: T.surfaceContainer, borderRadius: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
          background: T.secondarySoft,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: T.secondary, fontSize: 14, fontWeight: 700 }}>
          {initials}
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: T.onSurface, margin: 0 }}>
            {user?.name ?? "User"}
          </p>
          <p style={{ fontSize: 11, color: T.onSurfaceVariant, margin: 0 }}>Premium Account</p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {navBtn("overview",     "Dashboard", "dashboard")}
        {navBtn("transactions", "History", "list")}
        <div style={{ borderTop: `1px solid ${T.outlineVariant}`, marginTop: 16, paddingTop: 16 }}>
          <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1,
            color: T.outline, padding: "0 16px", marginBottom: 8, fontWeight: 600 }}>
            Insights
          </p>
          <button onClick={onViewInsights} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px", borderRadius: 10, border: "none", cursor: "pointer",
            width: "100%", textAlign: "left", background: "transparent",
            color: T.onSurfaceVariant, fontSize: 14, fontWeight: 500,
            transition: "background .15s",
          }}>
            <MI name="auto_awesome" size={18} /> View Insights
          </button>
          <button onClick={onViewMLInsights} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              width: "100%", textAlign: "left", background: "transparent",
              color: T.onSurfaceVariant, fontSize: 14, fontWeight: 500,
              transition: "background .15s",
            }}>
              <MI name="bolt" size={18} /> ML Model
          </button>
        </div>
      </nav>

      {/* Sign out only */}
      <div style={{ borderTop: `1px solid ${T.outlineVariant}`, paddingTop: 12 }}>
        <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 12,
          padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
          background: "transparent", color: T.error, fontSize: 13,
          fontWeight: 500, width: "100%", textAlign: "left" }}>
          <MI name="logout" size={16} /> Sign out
        </button>
      </div>
    </aside>
  )
}

// ── Top Header ────────────────────────────────────────────────────────────────
const Header = ({ tab, setTab, user, refetch }: {
  tab: string
  setTab: (t: string) => void
  user: { name: string } | null
  refetch: () => void
}) => {
  const initials = user?.name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) ?? "U"
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 40, background: T.surfaceLowest,
      borderBottom: `1px solid ${T.outlineVariant}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        height: 64, padding: "0 40px" }}>

        <nav style={{ display: "flex", gap: 24 }}>
          {[["overview", "Dashboard"], ["transactions", "History"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 15, color: tab === id ? T.secondary : T.onSurfaceVariant,
              fontWeight: tab === id ? 600 : 400,
              borderBottom: tab === id ? `2px solid ${T.secondary}` : "2px solid transparent",
              paddingBottom: 4, transition: "color .15s",
            }}>{label}</button>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <MI name="search" size={14} color={T.muted} style={{ position: "absolute",
              left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search transactions…" style={{
              padding: "8px 14px 8px 32px", borderRadius: 999, fontSize: 13,
              border: `1px solid ${T.outlineVariant}`, background: T.surfaceLow,
              color: T.onSurface, outline: "none", width: 220,
            }} />
          </div>
          <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8, border: "none", fontSize: 13,
            fontWeight: 600, color: T.onPrimary, cursor: "pointer", background: T.primary,
            transition: "background .15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = T.primaryHover)}
            onMouseLeave={e => (e.currentTarget.style.background = T.primary)}>
            <MI name="refresh" size={13} /> Refresh
          </button>
          <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: T.secondarySoft, border: `1px solid ${T.outlineVariant}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: T.secondary }}>
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, sub, icon, accent = T.secondary }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accent?: string
}) => {
  const [hov, setHov] = useState(false)
  return (
    <Card style={{ padding: 24, cursor: "default", transition: "all .2s ease",
      borderColor: hov ? accent : T.outlineVariant,
      boxShadow: hov ? `0 8px 28px ${accent}1f` : "0 4px 20px rgba(15,23,42,.05)" }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <CardTitle>{label}</CardTitle>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}14`,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MI name={icon} size={16} color={accent} />
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: T.onSurface,
        lineHeight: 1.1, marginBottom: 6, letterSpacing: "-0.01em" }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: T.onSurfaceVariant }}>{sub}</div>}
    </Card>
  )
}

// ── Daily bar chart (last 15 days) ────────────────────────────────────────────
const DailyBarChart = ({ transactions }: { transactions: Transaction[] }) => {
  const data = useMemo(() => {
    const now = new Date()
    const slots: { day: string; spending: number; date: Date }[] = []
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      slots.push({ day: d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
        spending: 0, date: d })
    }
    transactions.forEach(t => {
      const tDate = new Date(t.date)
      slots.forEach(slot => {
        if (tDate.getDate() === slot.date.getDate() &&
            tDate.getMonth() === slot.date.getMonth() &&
            tDate.getFullYear() === slot.date.getFullYear())
          slot.spending += t.amount
      })
    })
    return slots.map(({ day, spending }) => ({ day, spending: +spending.toFixed(2) }))
  }, [transactions])

  return (
    <Card>
      <div style={{ padding: "20px 24px 0", display: "flex",
        justifyContent: "space-between", alignItems: "center" }}>
        <CardTitle>Transactions (Last 15 Days)</CardTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 6,
          background: T.secondarySoft, padding: "4px 12px", borderRadius: 999 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.secondary }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: T.secondary }}>Spending</span>
        </div>
      </div>
      <div style={{ padding: "16px 12px 8px" }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={T.outlineVariant} vertical={false} opacity={0.7} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: T.muted }}
              axisLine={false} tickLine={false} interval={2} />
            <YAxis tick={{ fontSize: 11, fill: T.muted }} axisLine={false}
              tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Spending"]}
              contentStyle={{ fontSize: 12, border: `1px solid ${T.outlineVariant}`,
                borderRadius: 10, boxShadow: "0 4px 20px rgba(15,23,42,.06)" }} />
            <Bar dataKey="spending" fill={T.surfaceHigh} radius={[4, 4, 0, 0]}
              activeBar={{ fill: T.secondaryContainer }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ padding: "4px 20px 16px", display: "flex",
        justifyContent: "space-between", fontSize: 11, color: T.muted }}>
        <span>Day 1</span><span>Day 8</span><span>Day 15</span>
      </div>
    </Card>
  )
}

// ── Fraud Alerts card ─────────────────────────────────────────────────────────
const FraudAlertsCard = ({ anomalies, onReviewAll }: {
  anomalies: AnomalyAlert[]
  onReviewAll: () => void
}) => (
  <div style={{ background: T.errorSoft, border: `1px solid rgba(186,26,26,.15)`,
    borderRadius: 16, padding: 24, boxSizing: "border-box" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.error, marginBottom: 14 }}>
      <MI name="warning" size={20} />
      <span style={{ fontSize: 18, fontWeight: 700 }}>Fraud Alerts</span>
    </div>
    <p style={{ fontSize: 13, color: T.error, marginBottom: 16, lineHeight: 1.5 }}>
      {anomalies.length
        ? `We've detected ${anomalies.length} suspicious activit${anomalies.length > 1 ? "ies" : "y"} requiring your immediate attention.`
        : "No data available at the moment."}
    </p>

    {anomalies.length === 0 && (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.success,
        padding: "12px 14px", background: T.successSoft, borderRadius: 10 }}>
        <MI name="check_circle" size={16} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>All transactions look normal.</span>
      </div>
    )}

    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {anomalies.slice(0, 2).map(a => (
        <div key={a.transaction_id} style={{ background: T.surfaceLowest, borderRadius: 10,
          borderLeft: `4px solid ${T.error}`, padding: "12px 14px",
          display: "flex", alignItems: "flex-start", gap: 12,
          boxShadow: "0 2px 8px rgba(186,26,26,.08)" }}>
          <MI name="gpp_bad" size={18} color={T.error} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.onSurface,
                textTransform: "capitalize" }}>
                {a.anomaly_type.replace(/_/g, " ")} · {a.merchant}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.error }}>
                ${a.amount.toFixed(2)}
              </span>
            </div>
            <p style={{ fontSize: 11, color: T.onSurfaceVariant, margin: 0, lineHeight: 1.4 }}>
              {a.description}
            </p>
          </div>
        </div>
      ))}
    </div>

    {anomalies.length > 0 && (
      <button onClick={onReviewAll} style={{ width: "100%", marginTop: 14, padding: "10px 0",
        background: T.error, color: T.onError, border: "none", borderRadius: 10,
        fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        Review All Alerts
      </button>
    )}
  </div>
)

// ── Spending Categories (all cats, click to expand merchants) ─────────────────
const SpendingCategoriesCard = ({ transactions }: { transactions: Transaction[] }) => {
  const [selected, setSelected] = useState<string | null>(null)

  const { cats, total } = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.forEach(t => { map[t.category] = (map[t.category] ?? 0) + t.amount })
    const tot = Object.values(map).reduce((s, v) => s + v, 0)
    return {
      cats: Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amount]) => ({
          cat, amount, pct: tot ? (amount / tot) * 100 : 0,
          color: CATEGORY_COLORS[cat] ?? T.muted,
        })),
      total: tot,
    }
  }, [transactions])

  const topMerchants = useMemo(() => {
    if (!selected) return []
    const map: Record<string, number> = {}
    transactions.filter(t => t.category === selected)
      .forEach(t => { map[t.merchant] = (map[t.merchant] ?? 0) + t.amount })
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3)
    const max = sorted[0]?.[1] ?? 1
    return sorted.map(([merchant, amount]) => ({ merchant, amount, pct: (amount / max) * 100 }))
  }, [transactions, selected])

  const gradient = useMemo(() => {
    let offset = 0
    const parts = cats.map(({ pct, color }) => {
      const seg = `${color} ${offset.toFixed(1)}% ${(offset + pct).toFixed(1)}%`
      offset += pct
      return seg
    })
    if (offset < 100) parts.push(`${T.surfaceHigh} ${offset.toFixed(1)}% 100%`)
    return `conic-gradient(${parts.join(", ")})`
  }, [cats])

  return (
    <Card style={{ padding: 24, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <CardTitle>Spending Categories</CardTitle>
        <span style={{ fontSize: 11, color: T.muted }}>Click to expand</span>
      </div>

      {cats.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: T.muted, fontSize: 13 }}>
          No data available at the moment.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px 0" }}>
            <div style={{ width: 144, height: 144, borderRadius: "50%",
              background: gradient, position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 92, height: 92, borderRadius: "50%",
                background: T.surfaceLowest,
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center" }}>
                <span style={{ fontSize: 10, color: T.onSurfaceVariant, marginBottom: 2 }}>
                  Total Spent
                </span>
                <span style={{ fontSize: 16, fontWeight: 600, color: T.onSurface }}>
                  ${total.toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {cats.map(({ cat, pct, amount, color }) => {
              const isOpen = selected === cat
              return (
                <div key={cat}>
                  <button onClick={() => setSelected(isOpen ? null : cat)} style={{
                    width: "100%", display: "flex", justifyContent: "space-between",
                    alignItems: "center", padding: "10px 12px", borderRadius: 10,
                    border: "none", cursor: "pointer", textAlign: "left",
                    background: isOpen ? `${color}10` : "transparent",
                    transition: "background .15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%",
                        background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: T.onSurface,
                        textTransform: "capitalize", fontWeight: isOpen ? 600 : 400 }}>
                        {cat}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: T.muted }}>
                        ${amount.toFixed(0)}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.onSurface,
                        minWidth: 34, textAlign: "right" }}>
                        {pct.toFixed(0)}%
                      </span>
                      {isOpen
                        ? <MI name="expand_less" size={14} color={T.muted} />
                        : <MI name="expand_more" size={14} color={T.muted} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ padding: "8px 12px 12px 30px",
                      background: `${color}08`, borderRadius: "0 0 10px 10px",
                      marginBottom: 4 }}>
                      {topMerchants.length === 0 ? (
                        <p style={{ fontSize: 12, color: T.muted }}>No data available at the moment.</p>
                      ) : (
                        <>
                          <p style={{ fontSize: 10, color: T.muted, textTransform: "uppercase",
                            letterSpacing: 0.6, fontWeight: 600, marginBottom: 8 }}>
                            Top merchants
                          </p>
                          {topMerchants.map(({ merchant, amount: amt, pct: mPct }) => (
                            <div key={merchant} style={{ marginBottom: 8 }}>
                              <div style={{ display: "flex", justifyContent: "space-between",
                                marginBottom: 3 }}>
                                <span style={{ fontSize: 12, color: T.onSurface,
                                  textTransform: "capitalize" }}>{merchant}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: T.onSurface }}>
                                  ${amt.toFixed(2)}
                                </span>
                              </div>
                              <div style={{ height: 3, borderRadius: 99, background: T.surfaceHigh }}>
                                <div style={{ height: "100%", borderRadius: 99,
                                  width: `${mPct}%`, background: color,
                                  transition: "width .4s" }} />
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

// ── Subscriptions card (new + continuing, from ML data only) ──────────────────
const SubscriptionsCard = ({ transactions }: { transactions: Transaction[] }) => {
  const { newSubs, continuingSubs } = useMemo(() => {
    const subTxns = transactions.filter(t => t.category === "subscription")
    const byMerchant: Record<string, Transaction[]> = {}
    subTxns.forEach(t => {
      if (!byMerchant[t.merchant]) byMerchant[t.merchant] = []
      byMerchant[t.merchant].push(t)
    })
    const newS = Object.entries(byMerchant)
      .filter(([, txns]) => txns.length === 1)
      .map(([merchant, txns]) => ({ merchant, amount: txns[0].amount, date: txns[0].date }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const contS = Object.entries(byMerchant)
      .filter(([, txns]) => txns.length > 1)
      .map(([merchant, txns]) => {
        const sorted = [...txns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        return {
          merchant,
          latestAmount: sorted[0].amount,
          count: txns.length,
          total: txns.reduce((s, t) => s + t.amount, 0),
        }
      })
      .sort((a, b) => b.latestAmount - a.latestAmount)
    return { newSubs: newS, continuingSubs: contS }
  }, [transactions])

  const noData = (
    <p style={{ fontSize: 12, color: T.muted, padding: "8px 0" }}>
      No data available at the moment.
    </p>
  )

  const subRow = (label: string, amount: number, sub: string, color: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 0", borderBottom: `1px solid ${T.outlineVariant}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `${color}14`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15 }}>📱</div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: T.onSurface,
            margin: 0, textTransform: "capitalize" }}>{label}</p>
          <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>{sub}</p>
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>${amount.toFixed(2)}</span>
    </div>
  )

  return (
    <Card style={{ padding: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        {/* New subscriptions */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: T.secondarySoft,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MI name="auto_awesome" size={14} color={T.secondary} />
            </div>
            <CardTitle>New Subscriptions</CardTitle>
          </div>
          {newSubs.length === 0 ? noData : newSubs.map(s =>
            subRow(s.merchant, s.amount,
              `First seen · ${new Date(s.date).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}`,
              T.secondary)
          )}
        </div>

        {/* Continuing subscriptions */}
        <div style={{ borderLeft: `1px solid ${T.outlineVariant}`, paddingLeft: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#4f55c414",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MI name="autorenew" size={14} color="#4f55c4" />
            </div>
            <CardTitle>Active Subscriptions</CardTitle>
          </div>
          {continuingSubs.length === 0 ? noData : continuingSubs.map(s =>
            subRow(s.merchant, s.latestAmount,
              `${s.count} charges · $${s.total.toFixed(2)} total`,
              "#4f55c4")
          )}
        </div>
      </div>
    </Card>
  )
}

// ── Recent transactions list ──────────────────────────────────────────────────
const RecentTransactionsList = ({ transactions, onViewAll }: {
  transactions: Transaction[]
  onViewAll: () => void
}) => {
  const recent = transactions.slice(0, 5)
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 24px 0", display: "flex",
        justifyContent: "space-between", alignItems: "center" }}>
        <CardTitle>Recent Transactions</CardTitle>
        <button onClick={onViewAll} style={{ fontSize: 13, color: T.secondary,
          fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>
          View All
        </button>
      </div>
      <div style={{ padding: "8px 0" }}>
        {recent.length === 0 ? (
          <p style={{ padding: "24px", fontSize: 13, color: T.muted, textAlign: "center" }}>
            No data available at the moment.
          </p>
        ) : recent.map(t => (
          <div key={t._id} style={{ display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: "14px 24px", transition: "background .15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = T.surfaceLow)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.surfaceContainer,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0 }}>
                <MI name={CATEGORY_ICONS[t.category]} size={16} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.onSurface,
                  margin: 0, textTransform: "capitalize" }}>{t.merchant}</p>
                <p style={{ fontSize: 11, color: T.onSurfaceVariant, margin: 0,
                  textTransform: "capitalize" }}>
                  {t.category} · {new Date(t.date).toLocaleDateString("en-AU",
                    { day: "2-digit", month: "short" })}
                </p>
              </div>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.onSurface, margin: 0 }}>
              ${t.amount.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── AI Insights (inline in dashboard) ────────────────────────────────────────
const AIInsights = ({ insights, count }: { insights: Insights; count: number }) => {
  const [open, setOpen] = useState(true)
  return (
    <Card style={{ borderLeft: `4px solid ${T.secondary}` }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%",
        padding: "18px 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: T.secondarySoft,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MI name="auto_awesome" size={18} color={T.secondary} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: T.onSurface }}>AI Insights</span>
              <Squiggle width={40} />
            </div>
            <div style={{ fontSize: 12, color: T.onSurfaceVariant, marginTop: 2 }}>
              {insights.confidence_note}
            </div>
          </div>
        </div>
        {open ? <MI name="expand_less" size={18} color={T.muted} /> : <MI name="expand_more" size={18} color={T.muted} />}
      </button>
      {open && (
        <>
          <Divider />
          <div style={{ padding: "16px 24px 8px" }}>
            <div style={{ fontSize: 14, color: T.onSurface, lineHeight: 1.7,
              background: T.surfaceLow, borderRadius: 12, padding: "14px 16px",
              whiteSpace: "pre-wrap", border: `1px solid ${T.outlineVariant}` }}>
              {insights.summary}
            </div>
          </div>
          <div style={{ padding: "8px 24px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {insights.recommendations.map((rec, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px",
                background: T.surfaceLowest, borderRadius: 10,
                border: `1px solid ${T.outlineVariant}` }}>
                <span style={{ color: T.secondary, fontWeight: 700, fontSize: 13, minWidth: 22 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 13, color: T.onSurface, lineHeight: 1.6 }}>{rec}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "0 24px 16px", fontSize: 11, color: T.muted,
            display: "flex", alignItems: "center", gap: 6 }}>
            <MI name="bolt" size={11} /> Generated from {count} classified transactions
          </div>
        </>
      )}
    </Card>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────
const Overview = ({ transactions, metrics, anomalies, insights, onViewAll, onReviewAll }: {
  transactions: Transaction[]
  metrics: Metrics
  anomalies: AnomalyAlert[]
  insights: Insights | null
  onViewAll: () => void
  onReviewAll: () => void
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
    {/* 3 metric cards (ML Accuracy removed) */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
      <MetricCard label="Total Spend"
        value={`$${metrics.total_spending.toFixed(2)}`}
        sub={`avg $${metrics.average_transaction.toFixed(2)} / txn`}
        icon="attach_money" accent={T.primary} />
      <MetricCard label="Transactions"
        value={metrics.transaction_count}
        sub="ML-classified"
        icon="credit_card" accent={T.secondary} />
      <MetricCard label="Fraud Alerts"
        value={anomalies.length}
        sub={anomalies.length ? "Needs review" : "All clear"}
        icon="warning" accent={anomalies.length ? T.warning : T.success} />
    </div>

    {/* Row 1: bar chart + fraud alerts */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
      <DailyBarChart transactions={transactions} />
      <FraudAlertsCard anomalies={anomalies} onReviewAll={onReviewAll} />
    </div>

    {/* Row 2: spending categories (all cats) + recent transactions */}
    <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: 24 }}>
      <SpendingCategoriesCard transactions={transactions} />
      <RecentTransactionsList transactions={transactions} onViewAll={onViewAll} />
    </div>

    {/* Subscriptions row */}
    <SubscriptionsCard transactions={transactions} />

    {/* AI Insights */}
    {insights && <AIInsights insights={insights} count={metrics.transaction_count} />}
  </div>
)

// ── Transaction row ───────────────────────────────────────────────────────────
const TransactionRow = ({ t }: { t: Transaction }) => {
  const [hov, setHov] = useState(false)
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "grid", gridTemplateColumns: "130px 1fr 150px 120px 40px",
        padding: "16px 24px", alignItems: "center",
        background: hov ? T.surfaceLow : T.surfaceLowest,
        borderTop: `1px solid rgba(198,198,205,.4)`,
        transition: "background .15s" }}>
      <span style={{ color: T.muted, fontSize: 12 }}>
        {new Date(t.date).toLocaleDateString("en-AU",
          { day: "2-digit", month: "short", year: "numeric" })}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
          background: hov ? T.surfaceLowest : T.surfaceHigh,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, boxShadow: hov ? "0 2px 8px rgba(15,23,42,.08)" : "none",
          transition: "all .15s" }}>
          <MI name={CATEGORY_ICONS[t.category]} size={16} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.onSurface, margin: 0,
            textTransform: "capitalize" }}>{t.merchant}</p>
          <p style={{ fontSize: 11, color: T.onSurfaceVariant, margin: 0 }}>Card</p>
        </div>
      </div>
      <span>
        <span style={{ background: `${CATEGORY_COLORS[t.category] ?? T.muted}18`,
          color: CATEGORY_COLORS[t.category] ?? T.muted,
          padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
          textTransform: "capitalize" }}>
          {t.category}
        </span>
      </span>
      <span style={{ textAlign: "right", fontWeight: 600, color: T.onSurface, fontSize: 13 }}>
        ${t.amount.toFixed(2)}
      </span>
      <span style={{ textAlign: "right", opacity: hov ? 1 : 0, transition: "opacity .15s" }}>
        <button style={{ background: "none", border: "none", cursor: "pointer",
          color: T.onSurfaceVariant, display: "flex", alignItems: "center", padding: 4 }}>
          <MI name="more_vert" size={16} />
        </button>
      </span>
    </div>
  )
}

// ── Transactions tab ──────────────────────────────────────────────────────────
const Transactions = ({ transactions }: { transactions: Transaction[] }) => {
  const [query, setQuery] = useState("")
  const [focus, setFocus] = useState(false)
  const filtered = transactions.filter(t => {
    const q = query.toLowerCase()
    return !q || t.merchant.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
  })

  const btnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
    border: `1px solid ${T.outlineVariant}`, borderRadius: 8,
    background: T.surfaceLowest, color: T.onSurfaceVariant,
    fontSize: 13, fontWeight: 500, cursor: "pointer",
  }

  return (
    <Card>
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.outlineVariant}`,
        display: "flex", flexWrap: "wrap", alignItems: "center",
        justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.onSurface }}>
            Past {transactions.length} Transactions
          </span>
          <Badge color="blue">Active Period</Badge>
          <div style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
            <MI name="refresh" size={11} /> Last updated just now
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 150px 120px 40px",
        padding: "10px 24px", fontSize: 11, fontWeight: 600, color: T.muted,
        textTransform: "uppercase", letterSpacing: 0.6,
        background: T.surfaceLow, borderBottom: `1px solid ${T.outlineVariant}` }}>
        <span style={{ cursor: "pointer" }}>Date ▾</span>
        <span>Vendor</span>
        <span>Category</span>
        <span style={{ textAlign: "right" }}>Amount</span>
        <span />
      </div>

      <div style={{ maxHeight: 580, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: T.muted, fontSize: 13 }}>
            {transactions.length === 0
              ? "No data available at the moment."
              : "No transactions match your search."}
          </div>
        ) : filtered.map(t => <TransactionRow key={t._id} t={t} />)}
      </div>

      <div style={{ padding: "28px 24px", textAlign: "center",
        borderTop: `1px solid ${T.outlineVariant}` }}>
        <svg width="120" height="48" viewBox="0 0 120 48" fill="none"
          style={{ opacity: 0.2, marginBottom: 12, display: "block", margin: "0 auto 12px" }}>
          <path d="M10 38C25 33 35 10 50 10C65 10 75 38 90 38C105 38 110 22 115 18"
            stroke={T.onSurface} strokeDasharray="4 4" strokeLinecap="round" strokeWidth="1.5" />
          <circle cx="10" cy="38" fill={T.onSurface} r="3" />
        </svg>
        <p style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>
          You've reached the end of the recent activity.
        </p>
        <button style={{ fontSize: 12, fontWeight: 600, color: T.secondary,
          background: "none", border: "none", cursor: "pointer" }}>
          Load older transactions
        </button>
      </div>
    </Card>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tab, setTab]               = useState("overview")
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [mlOpen, setMlOpen] = useState(false)
  const { user, logout }            = useAuth()
  const { transactions, metrics, anomalies, insights, loading, error, refetch } =
    useFinancialData(20)

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.surface }}>

      {/* Sidebar */}
      <Sidebar tab={tab} setTab={setTab} user={user} logout={logout}
        onViewInsights={() => setInsightsOpen(true)}
        onViewMLInsights={() => setMlOpen(true)} />
      {/* Main column */}
      <div style={{ flex: 1, marginLeft: 256, display: "flex", flexDirection: "column" }}>
        <Header tab={tab} setTab={setTab} user={user} refetch={refetch} />

        <main style={{ flex: 1, padding: "32px 40px 64px" }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 32, fontWeight: 600, color: T.onSurface,
              letterSpacing: "-0.01em", lineHeight: 1.25, margin: 0 }}>
              {tab === "overview" ? "Financial Overview" : "Transaction History"}
            </h1>
            <p style={{ fontSize: 15, color: T.onSurfaceVariant, marginTop: 6, lineHeight: 1.5 }}>
              {tab === "overview"
                ? `Good morning, ${user?.name ?? ""}. Here is your summary.`
                : "Review and manage your financial activity across all linked accounts."}
            </p>
          </div>

          {loading && <Spinner />}
          {!loading && error && <ErrorBanner message={error} onRetry={refetch} />}
          {!loading && !error && (
            <>
              {tab === "overview" && metrics && (
                <Overview
                  transactions={transactions}
                  metrics={metrics}
                  anomalies={anomalies}
                  insights={insights}
                  onViewAll={() => setTab("transactions")}
                  onReviewAll={() => setAlertsOpen(true)}
                />
              )}
              {tab === "overview" && !metrics && (
                <div style={{ padding: "48px 24px", textAlign: "center", color: T.muted }}>
                  <Squiggle width={80} color={T.muted} />
                  <p style={{ fontSize: 16, marginTop: 12, marginBottom: 8, color: T.onSurface }}>
                    No transactions yet.
                  </p>
                  <p style={{ fontSize: 13 }}>
                    Upload transactions via POST /transactions/upload to see your insights.
                  </p>
                </div>
              )}
              {tab === "transactions" && <Transactions transactions={transactions} />}
            </>
          )}
        </main>

        <footer style={{ background: T.surfaceLowest, borderTop: `1px solid ${T.outlineVariant}`,
          padding: "28px 40px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.onSurface }}>Ethos Finance</div>
              <p style={{ fontSize: 12, color: T.onSurfaceVariant, marginTop: 2 }}>
                © 2024 Ethos Finance Corp. Member FDIC.
              </p>
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              {["Privacy Policy", "Terms of Service", "Security Center"].map(link => (
                <a key={link} href="#" style={{ fontSize: 12, color: T.onSurfaceVariant,
                  textDecoration: "underline", textDecorationColor: T.secondary }}>
                  {link}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>

      {/* Modals */}
      {alertsOpen && (
        <AlertsModal anomalies={anomalies} onClose={() => setAlertsOpen(false)} />
      )}
      {insightsOpen && (
        <InsightsModal
          insights={insights}
          count={metrics?.transaction_count ?? 0}
          onClose={() => setInsightsOpen(false)}
        />
      )}
      

      <MLInsightsPanel metrics={metrics} isOpen={mlOpen} onClose={() => setMlOpen(false)} />
    </div>
  )
}