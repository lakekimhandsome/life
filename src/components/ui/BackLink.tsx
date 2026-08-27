import { ArrowLeft, House } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useT } from '../../state/LocaleContext'

export function BackLink({ to }: { to: string }) {
  const t = useT()
  const isHome = to === '/'

  return (
    <Link
      to={to}
      className={isHome ? 'back-link back-link--home' : 'back-link'}
      aria-label={isHome ? t('common.home') : t('common.back')}
    >
      {isHome ? (
        <House size={22} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
      )}
    </Link>
  )
}
