/**
 * components/SpendingBreakdown.tsx
 * =================================
 * Three sections:
 *  1. Category breakdown — click to expand top 3 merchants per category
 *  2. Top 5 merchants overall — ranked by total spend
 *  3. New & subscription transactions — first-time merchants + recurring charges
 */

import { useState } from "react"
import type { Transaction } from "../types/api"

// Ethos Finance tokens (kept in sync with Dashboard / Design.md)
const C = {
  // surfaces
  white:        "#ffffff",
  surfaceLow:   "#eff4ff",
  surfaceLowest:"#ffffff",
  // text on surface
  ink900:       "#0b1c30",
  ink700:       "#0b1c30",
  ink500:       "#45464d",
  ink300:       "#7a8694",
  ink100:       "#dce9ff",
  ink50:        "#f8f9ff",
  // outlines
  border:       "#c6c6cd",
  // accents
  secondary:    "#0051d5",
  secondarySoft:"#dbe1ff",
  amber600:     "#9a5b00",
}

const CATEGORY_COLORS: Record<string, string> = {
  groceries: "#0d8a4a", dining: "#0051d5", utilities: "#6845c4",
  transport: "#0c7b9e", entertainment: "#b8276a", shopping: "#9a5b00",
  healthcare: "#0a7a5d", subscription: "#4f55c4", other: "#7a8694",
}

const CATEGORY_ICONS: Record<string, string> = {
  groceries: "ti-shopping-cart", dining: "ti-tool-kitchen-2",
  utilities: "ti-bolt", transport: "ti-bus",
  entertainment: "ti-device-tv", shopping: "ti-shopping-bag",
  healthcare: "ti-pill", subscription: "ti-device-mobile",
  other: "ti-tag",
}

interface Props {
  transactions: Transaction[]
}

export default function SpendingBreakdown({ transactions }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!transactions.length) return null

  // ── compute category totals ──────────────────────────────────────────────
  const catMap: Record<string, { total: number; merchants: Record<string, number> }> = {}

  transactions.forEach(t => {
    const cat = t.category || "other"
    if (!catMap[cat]) catMap[cat] = { total: 0, merchants: {} }
    catMap[cat].total += t.amount
    catMap[cat].merchants[t.merchant] = (catMap[cat].merchants[t.merchant] ?? 0) + t.amount
  })

  const total = Object.values(catMap).reduce((s, c) => s + c.total, 0)
  const cats  = Object.entries(catMap).sort((a, b) => b[1].total - a[1].total)

  // ── top 5 merchants overall ──────────────────────────────────────────────
  const merchantMap: Record<string, { total: number; count: number; category: string }> = {}
  transactions.forEach(t => {
    if (!merchantMap[t.merchant])
      merchantMap[t.merchant] = { total: 0, count: 0, category: t.category }
    merchantMap[t.merchant].total += t.amount
    merchantMap[t.merchant].count += 1
  })
  const top5 = Object.entries(merchantMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)

  // ── subscriptions (small recurring amounts) ──────────────────────────────
  const subscriptions = transactions.filter(t =>
    t.category === "subscription" || t.amount < 30
  ).sort((a, b) => b.amount - a.amount).slice(0, 6)

  // ── first-time merchants (appears only once) ─────────────────────────────
  const firstTimers = Object.entries(merchantMap)
    .filter(([, v]) => v.count === 1)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)

  const toggle = (cat: string) => setExpanded(e => e === cat ? null : cat)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Section 1: Category breakdown ──────────────────────────────── */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`,
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 4px 20px rgba(15, 23, 42, 0.05)" }}>
        <div style={{ padding: "16px 20px 12px", display: "flex",
          justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.ink500,
            textTransform: "uppercase", letterSpacing: .8, margin: 0 }}>
            Spending by Category
          </p>
          <span style={{ fontSize: 11, color: C.ink300 }}>Click to expand</span>
        </div>

        {cats.map(([cat, data]) => {
          const pct        = total ? data.total / total * 100 : 0
          const color      = CATEGORY_COLORS[cat] ?? C.ink300
          const icon       = CATEGORY_ICONS[cat] ?? "ti-tag"
          const isOpen     = expanded === cat
          const top3       = Object.entries(data.merchants)
            .sort((a, b) => b[1] - a[1]).slice(0, 3)
          const maxMerch   = top3[0]?.[1] ?? 1

          return (
            <div key={cat} style={{ borderTop: `1px solid ${C.border}` }}>
              {/* Row */}
              <button onClick={() => toggle(cat)} style={{
                width: "100%", padding: "12px 20px", display: "flex",
                alignItems: "center", gap: 12, border: "none",
                cursor: "pointer", textAlign: "left",
                background: isOpen ? C.ink50 : "transparent",
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: `${color}18`, display: "flex",
                  alignItems: "center", justifyContent: "center" }}>
                  <i className={`ti ${icon}`}
                    style={{ fontSize: 15, color }} aria-hidden="true" />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    marginBottom: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.ink900,
                      textTransform: "capitalize" }}>{cat}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: C.ink300 }}>{pct.toFixed(1)}%</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.ink900 }}>
                        ${data.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: C.ink100 }}>
                    <div style={{ height: "100%", borderRadius: 99,
                      width: `${pct}%`, background: color, transition: "width .5s" }} />
                  </div>
                </div>

                <i className={`ti ${isOpen ? "ti-chevron-up" : "ti-chevron-down"}`}
                  style={{ fontSize: 14, color: C.ink300, flexShrink: 0 }}
                  aria-hidden="true" />
              </button>

              {/* Expanded: top 3 merchants */}
              {isOpen && (
                <div style={{ padding: "0 20px 14px 60px",
                  background: C.ink50, borderTop: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 11, color: C.ink300, margin: "10px 0 8px",
                    textTransform: "uppercase", letterSpacing: .6, fontWeight: 600 }}>
                    Top merchants
                  </p>
                  {top3.map(([merchant, amt]) => (
                    <div key={merchant} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                        marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: C.ink700,
                          textTransform: "capitalize" }}>{merchant}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink900 }}>
                          ${amt.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ height: 3, borderRadius: 99, background: C.ink100 }}>
                        <div style={{ height: "100%", borderRadius: 99,
                          width: `${amt / maxMerch * 100}%`,
                          background: color, opacity: .7 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Section 2: Top 5 merchants ─────────────────────────────────── */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: "20px 24px",
        boxShadow: "0 4px 20px rgba(15, 23, 42, 0.05)" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: C.ink500,
          textTransform: "uppercase", letterSpacing: .8, margin: "0 0 14px" }}>
          Top 5 merchants
        </p>
        {top5.map(([merchant, data], i) => (
          <div key={merchant} style={{ display: "flex", alignItems: "center",
            gap: 12, marginBottom: i < 4 ? 12 : 0 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6,
              background: C.secondarySoft, display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.secondary }}>
                {i + 1}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: C.ink900, fontWeight: 500,
                  textTransform: "capitalize" }}>{merchant}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.ink900 }}>
                  ${data.total.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: C.ink300,
                  textTransform: "capitalize" }}>{data.category}</span>
                <span style={{ fontSize: 11, color: C.ink300 }}>
                  {data.count} transaction{data.count > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 3: Subscriptions & first-time transactions ─────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* Subscriptions */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            marginBottom: 14 }}>
            <i className="ti ti-refresh" style={{ fontSize: 15, color: "#6366F1" }}
              aria-hidden="true" />
            <p style={{ fontSize: 12, fontWeight: 600, color: C.ink500,
              textTransform: "uppercase", letterSpacing: .8, margin: 0 }}>
              Subscriptions
            </p>
          </div>
          {subscriptions.length === 0 && (
            <p style={{ fontSize: 12, color: C.ink300 }}>None detected</p>
          )}
          {subscriptions.map((t, i) => (
            <div key={t._id} style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", paddingBottom: i < subscriptions.length - 1 ? 8 : 0,
              marginBottom: i < subscriptions.length - 1 ? 8 : 0,
              borderBottom: i < subscriptions.length - 1
                ? `1px solid ${C.border}` : "none" }}>
              <div>
                <p style={{ fontSize: 12, color: C.ink900, fontWeight: 500,
                  margin: 0, textTransform: "capitalize" }}>{t.merchant}</p>
                <p style={{ fontSize: 11, color: C.ink300, margin: 0 }}>
                  {new Date(t.date).toLocaleDateString("en-AU",
                    { day: "2-digit", month: "short" })}
                </p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600,
                color: "#6366F1" }}>${t.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* First-time transactions */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            marginBottom: 14 }}>
            <i className="ti ti-sparkles" style={{ fontSize: 15,
              color: C.amber600 }} aria-hidden="true" />
            <p style={{ fontSize: 12, fontWeight: 600, color: C.ink500,
              textTransform: "uppercase", letterSpacing: .8, margin: 0 }}>
              New merchants
            </p>
          </div>
          {firstTimers.length === 0 && (
            <p style={{ fontSize: 12, color: C.ink300 }}>None this period</p>
          )}
          {firstTimers.map(([merchant, data], i) => (
            <div key={merchant} style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: i < firstTimers.length - 1 ? 8 : 0,
              marginBottom: i < firstTimers.length - 1 ? 8 : 0,
              borderBottom: i < firstTimers.length - 1
                ? `1px solid ${C.border}` : "none" }}>
              <div>
                <p style={{ fontSize: 12, color: C.ink900, fontWeight: 500,
                  margin: 0, textTransform: "capitalize" }}>{merchant}</p>
                <p style={{ fontSize: 11, color: C.ink300, margin: 0,
                  textTransform: "capitalize" }}>{data.category}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 12, fontWeight: 600,
                  color: C.amber600, margin: 0 }}>${data.total.toFixed(2)}</p>
                <p style={{ fontSize: 10, color: C.ink300, margin: 0 }}>first time</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}