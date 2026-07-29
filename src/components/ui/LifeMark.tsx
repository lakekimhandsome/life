const RIPPLES = [
  'M 67.046 26.539 A 29 29 0 1 0 76.065 37.287',
  'M 69.863 7.404 A 47 47 0 1 0 85.471 19.165',
]

export function LifeMark({
  size = 32,
  className,
  title,
}: {
  size?: number
  className?: string
  title?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-1 -1 102 102"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g stroke="currentColor" strokeWidth="8" strokeLinecap="round">
        <circle cx="50" cy="50" r="11" strokeWidth="7.33" />
        {RIPPLES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  )
}
