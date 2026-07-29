import { ArrowLeft, House } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function BackLink({
  to,
  children,
}: {
  to: string
  children?: ReactNode
}) {
  if (to === '/') {
    return (
      <Link to={to} className="back-link back-link--home" aria-label="홈">
        <House size={24} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    )
  }

  return (
    <Link to={to} className="back-link" aria-label={children ? undefined : '뒤로'}>
      <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
      {children ? <span>{children}</span> : null}
    </Link>
  )
}
