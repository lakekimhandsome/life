import { Link2, Share2 } from 'lucide-react'
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

  async function shareLink() {
    if (!object.shareToken) return
    const url = new URL(`/share/${object.shareToken}`, window.location.origin)
    const shareText = `Lake's Interface For Everything\n\n${url}`
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText })
        setError(null)
        return
      }

      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setError(null)
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === 'AbortError') return
      setError(t('share.shareFailed'))
    }
  }

  return (
    <div className="object-share-control">
      <label className="object-visibility-field">
        <Link2 size={16} aria-hidden="true" />
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
          aria-label={t('share.shareLink')}
          title={t('share.shareLink')}
          onClick={() => void shareLink()}
        >
          <Share2 size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}

      <span
        className={`object-share-feedback${error ? ' is-error' : ''}`}
        aria-live="polite"
      >
        {error ?? (copied ? t('share.copied') : '')}
      </span>
    </div>
  )
}
