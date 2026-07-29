import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function BackLink({
  to,
  children,
}: {
  to: string
  children: ReactNode
}) {
  return (
    <Link to={to} className="back-link">
      <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </Link>
  )
}
