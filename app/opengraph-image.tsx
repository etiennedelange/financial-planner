import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const FONT_SIZE_TITLE = 56
const FONT_SIZE_SUB = 28

function SocialCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0c1220",
        color: "#f8fafc",
        padding: "72px 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Brand mark */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "#3b82f6",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "6px",
            position: "relative",
          }}
        >
          {[
            { left: 5, height: 10, bottom: 5 },
            { left: 12, height: 16, bottom: 5 },
            { left: 19, height: 13, bottom: 5 },
            { left: 26, height: 20, bottom: 5 },
          ].map(({ left, height, bottom }) => (
            <div
              key={left}
              style={{
                position: "absolute",
                left,
                bottom,
                width: 5,
                height,
                borderRadius: 2,
                background: "rgba(255,255,255,0.35)",
              }}
            />
          ))}
          <svg
            width="44"
            height="44"
            viewBox="0 0 44 44"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <polyline
              points="5,31 13,22 21,25 29,14 37,7"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            SA Financial Planner
          </span>
          <span
            style={{
              fontSize: 16,
              color: "#94a3b8",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Plan your retirement with Monte Carlo certainty
          </span>
        </div>
      </div>

      {/* Headline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginTop: "auto",
          marginBottom: "auto",
          maxWidth: 920,
        }}
      >
        <span style={{ fontSize: FONT_SIZE_TITLE, fontWeight: 700, lineHeight: 1.15 }}>
          Will your savings last 30 years?
        </span>
        <span style={{ fontSize: FONT_SIZE_SUB, color: "#cbd5e1", lineHeight: 1.4 }}>
          1,000 market scenarios. South African tax rules. Pension funds, RAs,
          TFSAs and discretionary portfolios — modelled together.
        </span>
      </div>

      {/* Bottom rule */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(148,163,184,0.25)",
          paddingTop: 24,
        }}
      >
        <span style={{ fontSize: 20, color: "#94a3b8" }}>
          South Africa · Tax-aware · Rand-based
        </span>
        <span style={{ fontSize: 20, color: "#60a5fa", fontWeight: 500 }}>
          Try the free calculator →
        </span>
      </div>
    </div>
  )
}

export default function OpengraphImage() {
  return new ImageResponse(<SocialCard />, { ...size })
}
