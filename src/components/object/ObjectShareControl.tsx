import { Check, Link2, Lock, Share } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { LifeObject } from '../../core/types'
import { useLife } from '../../state/LifeContext'
import { useT } from '../../state/LocaleContext'
import { HeaderMenu } from '../ui/HeaderMenu'

export function ObjectShareControl({ object, children }: { object: LifeObject; children: ReactNode }) {
  const { updateObject } = useLife()
  const t = useT()
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shared = object.visibility === 'unlisted'
  const shareUrl = shared && object.shareToken
    ? new URL(`/share/${object.shareToken}`, window.location.origin).href
    : null

  async function changeVisibility() {
    if (saving) return
    setSaving(true)
    setCopied(false)
    setError(null)
    try {
      const updated = await updateObject(object.id, { visibility: shared ? 'private' : 'unlisted' })
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

  const copyLabel = t(copied ? 'share.copied' : 'share.copyLink')
  return <>
    {shareUrl && (
      <button type="button" className="object-header-action" disabled={saving}
        aria-label={copyLabel} title={copyLabel} onClick={() => void copyLink()}>
        {copied ? <Check size={20} aria-hidden="true" /> : <Share size={20} strokeWidth={1.75} aria-hidden="true" />}
      </button>
    )}
    <HeaderMenu label={t('common.moreActions')}>
      <button type="button" disabled={saving} onClick={() => void changeVisibility()}>
        {shared ? <Lock size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
        {t(shared ? 'share.makePrivate' : 'share.enableLink')}
      </button>
      {children}
    </HeaderMenu>
    <span className={error ? 'object-share-feedback' : 'sr-only'} aria-live="polite">
      {error ?? (copied ? t('share.copied') : '')}
    </span>
  </>
}
