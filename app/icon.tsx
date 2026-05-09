import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#3b82f6",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "4px 4px 4px 4px",
          position: "relative",
        }}
      >
        {/* Bars */}
        {[
          { left: 3,  height: 8,  bottom: 4 },
          { left: 9,  height: 12, bottom: 4 },
          { left: 15, height: 9,  bottom: 4 },
          { left: 21, height: 16, bottom: 4 },
        ].map(({ left, height, bottom }) => (
          <div
            key={left}
            style={{
              position: "absolute",
              left,
              bottom,
              width: 4,
              height,
              borderRadius: 1,
              background: "rgba(255,255,255,0.35)",
            }}
          />
        ))}

        {/* Trend line rendered as a series of connected segments */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <polyline
            points="3,22 9,16 15,18 21,10 27,5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="27" cy="5" r="2" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
