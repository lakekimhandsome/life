import { useEffect, useState } from 'react'
import { initials } from '../../lib/userProfile'

type AvatarProps = {
  src: string | null
  name: string
  size?: number
  alt?: string
  className?: string
}

export function Avatar({ src, name, size = 36, alt, className }: AvatarProps) {
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [src])

  const showImage = Boolean(src) && !broken
  const decorative = alt === ''
  const classes = ['avatar', className].filter(Boolean).join(' ')

  return (
    <span
      className={classes}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : (alt ?? name)}
      aria-hidden={decorative ? true : undefined}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="avatar-fallback" aria-hidden="true">
          {initials(name)}
        </span>
      )}
    </span>
  )
}
