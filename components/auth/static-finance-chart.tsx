// Static version of the finance animation — bars at full height, trend line fully drawn

interface StaticFinanceChartProps {
  className?: string
  width?: number
  height?: number
}

export function StaticFinanceChart({ className, width = 80, height = 65 }: StaticFinanceChartProps) {
  const bars = [
    { x: 4,  h: 20 },
    { x: 16, h: 30 },
    { x: 28, h: 22 },
    { x: 40, h: 38 },
    { x: 52, h: 46 },
  ]

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 52"
      fill="none"
      className={className}
      aria-hidden
    >
      {bars.map(({ x, h }) => (
        <rect
          key={x}
          x={x}
          y={52 - h}
          width={8}
          height={h}
          rx={2}
          className="fill-primary/25"
        />
      ))}

      <path
        d="M 4 44 C 16 40, 20 28, 32 22 S 50 8, 60 4"
        className="stroke-primary"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <circle cx="60" cy="4" r="3.5" className="fill-primary" />
    </svg>
  )
}
