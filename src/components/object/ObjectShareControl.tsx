import { Check, Copy, Share } from 'lucide-react'
import { useState } from 'react'
import { OBJECT_VISIBILITIES, type LifeObject, type ObjectVisibility } from '../../core/types'
import { useLife } from '../../state/LifeContext'
import { useT } from '../../state/LocaleContext'
import { HeaderMenu } from '../ui/HeaderMenu'

export function ObjectShareControl({ object }: { object: LifeObject }) {
  const { updateObject } = useLife()
  const t = useT()
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shareUrl = object.shareToken
    ? new URL(`/share/${object.shareToken}`, window.location.origin).href
    : null

  async function changeVisibility(visibility: ObjectVisibility) {
    if (saving || visibility === object.visibility) return
    setSaving(true)
    setCopied(false)
    setError(null)
    try {
      const updated = await updateObject(object.id, { visibility })
      if (!updated) throw new Error(t('share.saveFailed'))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('share.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function copyLink() {
    setCopied(false)
    if (!shareUrl || !navigator.clipboard?.writeText) {
      setError(t('share.copyFailed'))
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
      setError(null)
    } catch {
      setError(t('share.copyFailed'))
    }
  }

  return (
    <HeaderMenu label={t('share.actions')} icon={<Share size={20} strokeWidth={1.75} aria-hidden="true" />}>
      <div className="object-share-control" role="group" aria-label={t('share.visibility')}>
        {OBJECT_VISIBILITIES.map((visibility) => (
          <button key={visibility} type="button" aria-pressed={object.visibility === visibility}
            aria-disabled={saving} onClick={() => void changeVisibility(visibility)}>
            {t(`share.${visibility}`)}
            {object.visibility === visibility && <Check size={16} aria-hidden="true" />}
          </button>
        ))}

        {object.visibility === 'unlisted' && object.shareToken ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void copyLink()}
          >
            {copied ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {copied ? t('share.copied') : t('share.copyLink')}
          </button>
        ) : null}

        <span
          className={error ? 'object-share-feedback is-error' : 'sr-only'}
          aria-live="polite"
        >
          {error ?? (copied ? t('share.copied') : '')}
        </span>
      </div>
    </HeaderMenu>
  )
}
