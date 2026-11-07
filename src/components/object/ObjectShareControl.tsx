import { Check, Share } from 'lucide-react'
import { useState } from 'react'
import type { LifeObject, ObjectVisibility } from '../../core/types'
import { useLife } from '../../state/LifeContext'
import { useT } from '../../state/LocaleContext'

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
    <div className="object-share-control">
      <label className="object-visibility-field">
        <span className="sr-only">{t('share.visibility')}</span>
        <select
          value={object.visibility}
          disabled={saving}
          aria-label={t('share.visibility')}
          onChange={(event) =>
            void changeVisibility(event.target.value as ObjectVisibility)
          }
        >
          <option value="private">{t('share.private')}</option>
          <option value="unlisted">{t('share.unlisted')}</option>
        </select>
      </label>

      {object.visibility === 'unlisted' && object.shareToken ? (
        <button
          type="button"
          className="object-header-action"
          aria-label={copied ? t('share.copied') : t('share.copyLink')}
          title={copied ? t('share.copied') : t('share.copyLink')}
          onClick={() => void copyLink()}
        >
          {copied ? (
            <Check size={18} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Share size={18} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      ) : null}

      <span
        className={error ? 'object-share-feedback is-error' : 'sr-only'}
        aria-live="polite"
      >
        {error ?? (copied ? t('share.copied') : '')}
      </span>
    </div>
  )
}
