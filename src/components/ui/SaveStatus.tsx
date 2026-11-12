import { SaveCheck } from 'lucide-react'
import { useT } from '../../state/LocaleContext'

export type SaveState = 'saving' | 'saved' | 'error'

export function SavingIcon({ size = 16, decorative = false }: { size?: number; decorative?: boolean }) {
  const t = useT()
  return (
    <>
      <span className="saving-spinner" aria-hidden="true">
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
          <circle cx="12" cy="12" r="9" pathLength="100" strokeDasharray="75 25" />
        </svg>
      </span>
      {!decorative && <span className="sr-only">{t('common.saving')}</span>}
    </>
  )
}

export function SaveStatus({ state }: { state: SaveState | 'loading' }) {
  const t = useT()
  return (
    <span
      className={`clipboard-save${state === 'saved' ? ' is-saved' : state === 'error' ? ' is-error' : ''}`}
      role="status"
      title={state === 'saving' ? t('common.saving') : state === 'saved' ? t('clipboard.saved') : undefined}
    >
      {state === 'saving' ? <SavingIcon /> : state === 'saved' ? (
        <>
          <SaveCheck size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">{t('clipboard.saved')}</span>
        </>
      ) : t(state === 'error' ? 'clipboard.saveError' : 'clipboard.loading')}
    </span>
  )
}
