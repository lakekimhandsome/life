const RIPPLES = [
  'M 62.343 33.011 A 21 21 0 1 0 68.875 40.794',
  'M 64.369 19.186 A 34 34 0 1 0 75.66 27.694',
  'M 61.37 4.396 A 47 47 0 1 0 76.282 11.035',
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
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g stroke="currentColor" strokeWidth="6" strokeLinecap="round">
        <circle cx="50" cy="50" r="8" strokeWidth="5.5" />
        {RIPPLES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  )
}
