const sizeMap = { md: 64, lg: 96 }
const strokeWidth = 6

export interface ProgressRingProps {
  value: number
  size?: keyof typeof sizeMap
}

export function ProgressRing({ value, size = 'md' }: ProgressRingProps) {
  const px = sizeMap[size]
  const radius = (px - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      className="rotate-[-90deg]"
      role="img"
      aria-label={`Progress: ${value}%`}
    >
      <title>Progress: {value}%</title>
      <circle
        cx={px / 2}
        cy={px / 2}
        r={radius}
        fill="none"
        stroke="var(--color-bg-subtle)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={px / 2}
        cy={px / 2}
        r={radius}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text
        x={px / 2}
        y={px / 2}
        dominantBaseline="middle"
        textAnchor="middle"
        className="rotate-[90deg]"
        style={{
          transform: `rotate(90deg) translate(0, 0)`,
          transformOrigin: `${px / 2}px ${px / 2}px`,
          fontSize: size === 'lg' ? '18px' : '12px',
          fontWeight: 600,
          fill: 'var(--color-text-primary)',
        }}
      >
        {value}%
      </text>
    </svg>
  )
}
