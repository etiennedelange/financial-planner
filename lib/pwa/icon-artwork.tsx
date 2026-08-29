const BARS = [
  { left: 9.4, height: 25 },
  { left: 28.1, height: 37.5 },
  { left: 46.9, height: 28.1 },
  { left: 65.6, height: 50 },
]

export function PwaIconArtwork({ rounded = false }: { rounded?: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: rounded ? 8 : 0,
        background: "#3b82f6",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "12.5%",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {BARS.map(({ left, height }) => (
        <div
          key={left}
          style={{
            position: "absolute",
            left: `${left}%`,
            bottom: "12.5%",
            width: "12.5%",
            height: `${height}%`,
            borderRadius: "3%",
            background: "rgba(255,255,255,0.35)",
          }}
        />
      ))}
      <svg
        width="100%"
        height="100%"
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
  )
}