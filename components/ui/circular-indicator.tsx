interface CircularIndicatorProps {
  percentage: number
  size?: number
  strokeWidth?: number
}

export function CircularIndicator({ percentage, size = 40, strokeWidth = 4 }: CircularIndicatorProps) {
  const clamped = Math.max(0, Math.min(1, percentage))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="hsl(var(--muted-foreground))"
        strokeWidth={strokeWidth}
        fill="none"
        opacity={0.25}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="hsl(var(--primary))"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
      />
    </svg>
  )
}

