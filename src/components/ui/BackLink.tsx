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
      <Link to={to} className="back-link" aria-label="홈">
        <House size={18} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    )
  }

  return (
    <Link to={to} className="back-link">
      <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </Link>
  )
}
