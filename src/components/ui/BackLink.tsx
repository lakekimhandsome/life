import { ArrowLeft, House } from 'lucide-react'
import { Link } from 'react-router-dom'

export function BackLink({ to }: { to: string }) {
  const isHome = to === '/'

  return (
    <Link
      to={to}
      className={isHome ? 'back-link back-link--home' : 'back-link'}
      aria-label={isHome ? '홈' : '뒤로'}
    >
      {isHome ? (
        <House size={22} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
      )}
    </Link>
  )
}
