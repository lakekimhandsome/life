import { ChevronRight, Pin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, fromDateInputValue } from '../../lib/format'
import { stripMarkdown } from '../../lib/markdown'
import { formatMetaValue, getSchema, supportsMarkdownBody } from '../../domain/schemas'
import type { LifeObject } from '../../core/types'
import { useLife } from '../../state/LifeContext'
import { useT } from '../../state/LocaleContext'

export function ObjectCard({ object }: { object: LifeObject }) {
  const t = useT()
  const { updateObject } = useLife()
  const [savingPin, setSavingPin] = useState(false)
  const [pinError, setPinError] = useState(false)
  const pinned = object.meta.pinned === true
  const pinLabel = t(pinned ? 'object.unpin' : 'object.pin')

  async function togglePin() {
    setSavingPin(true)
    setPinError(false)
    try {
      const updated = await updateObject(object.id, {
        expectedUpdatedAt: object.updatedAt,
        meta: { ...object.meta, pinned: !pinned, pinnedAt: pinned ? null : new Date().toISOString() },
      })
      if (!updated) setPinError(true)
    } catch {
      setPinError(true)
    } finally {
      setSavingPin(false)
    }
  }
  const schema = getSchema(object.type)
  const goalTargetDate =
    object.type === 'goal' && typeof object.meta.targetDate === 'string' && object.meta.targetDate
      ? object.meta.targetDate
      : null
  const shownDate = object.type === 'goal' ? goalTargetDate : object.occurredAt
  const metaBits = schema.fields
    .filter((field) => object.type !== 'goal' || field.key !== 'targetDate')
    .filter((field) => object.type !== 'project' || field.key !== 'status')
    .map((field) => formatMetaValue(object.type, field.key, object.meta[field.key] ?? null))
    .filter(Boolean)
    .slice(0, 2)
  const supportsMarkdown = supportsMarkdownBody(object.type)
  const bodyPreview = object.body
    ? supportsMarkdown
      ? stripMarkdown(object.body)
      : object.body
    : null

  return (
    <div className="object-card">
      <Link to={`/object/${object.id}`} className="object-row">
        <div className="object-row-main">
          <h3>{object.title}</h3>
          {bodyPreview ? <p>{bodyPreview}</p> : null}
          {shownDate ? (
            <div className="object-row-tags">
              <time dateTime={shownDate}>
                {object.type === 'goal'
                  ? formatDate(fromDateInputValue(shownDate.slice(0, 10)))
                  : formatDate(shownDate)}
              </time>
            </div>
          ) : null}
          {metaBits.length > 0 ? (
            <div className="object-row-tags">
              {metaBits.map((bit) => (
                <span key={bit}>{bit}</span>
              ))}
            </div>
          ) : null}
        </div>
        <ChevronRight
          className="object-row-arrow"
          size={18}
          strokeWidth={2}
          aria-hidden="true"
        />
      </Link>
      <button
        type="button"
        className="object-header-action object-pin"
        aria-label={t('object.pinNamed', { title: object.title })}
        aria-pressed={pinned}
        data-tooltip={pinLabel}
        disabled={savingPin}
        onClick={() => void togglePin()}
      >
        <Pin size={18} strokeWidth={1.75} fill={pinned ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
      {pinError ? <p className="form-error object-pin-error" role="alert">{t('object.pinFailed')}</p> : null}
    </div>
  )
}
