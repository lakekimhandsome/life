import { Circle, SaveCheck } from 'lucide-react'
import { useT } from '../../state/LocaleContext'

export type SaveState = 'saving' | 'saved' | 'error'

export function SavingIcon({ size = 16, decorative = false }: { size?: number; decorative?: boolean }) {
  const t = useT()
  return (
    <>
      <span className="saving-spinner" aria-hidden="true">
        <Circle size={size} strokeWidth={1.75} />
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
