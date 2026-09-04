import { useCallback, useEffect, useRef, useState } from 'react'
import type { LifeObject } from '../../core/types'
import { getSchema } from '../../domain/schemas'
import { formatDate, formatDateTime, fromDateInputValue, toDateInputValue } from '../../lib/format'
import { useLife } from '../../state/LifeContext'
import { useT } from '../../state/LocaleContext'
import { MarkdownEditor } from '../ui/MarkdownEditor'
import { TypeBadge } from '../ui/TypeBadge'

const SAVE_DEBOUNCE_MS = 500

export type ObjectSaveState = 'saved' | 'saving' | 'error'

interface Draft {
  title: string
  body: string
  occurredAt: string
  meta: LifeObject['meta']
}

interface InlineMarkdownObjectProps {
  object: LifeObject
  onSaveStateChange: (state: ObjectSaveState) => void
}

function InlineDateInput({
  value,
  label,
  includeTime = false,
  onChange,
  onBlur,
}: {
  value: string
  label: string
  includeTime?: boolean
  onChange: (value: string) => void
  onBlur: () => void
}) {
  const iso = value ? fromDateInputValue(value) : null
  return (
    <label className="inline-date-picker">
      <span>{iso ? (includeTime ? formatDateTime(iso) : formatDate(iso)) : '—'}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-label={label}
      />
    </label>
  )
}

export function InlineMarkdownObject({
  object,
  onSaveStateChange,
}: InlineMarkdownObjectProps) {
  const t = useT()
  const { updateObject } = useLife()
  const schema = getSchema(object.type)
  const initialOccurredAt = toDateInputValue(object.occurredAt)
  const draftRef = useRef<Draft>({
    title: object.title,
    body: object.body,
    occurredAt: initialOccurredAt,
    meta: object.meta,
  })
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const [title, setTitle] = useState(object.title)
  const [body, setBody] = useState(object.body)
  const [occurredAt, setOccurredAt] = useState(initialOccurredAt)
  const [meta, setMeta] = useState(object.meta)
  const [error, setError] = useState<string | null>(null)

  const persistNow = useCallback(async () => {
    if (!dirtyRef.current) return
    if (savingRef.current) {
      pendingSaveRef.current = true
      return
    }

    const draft = draftRef.current
    if (!draft.title.trim()) {
      onSaveStateChange('error')
      setError(t('form.needTitle'))
      return
    }

    savingRef.current = true
    pendingSaveRef.current = false
    dirtyRef.current = false
    onSaveStateChange('saving')

    let failed = false
    try {
      await updateObject(object.id, {
        title: draft.title.trim(),
        body: draft.body,
        occurredAt: fromDateInputValue(draft.occurredAt),
        meta: draft.meta,
      })
      onSaveStateChange('saved')
      setError(null)
    } catch (nextError) {
      failed = true
      dirtyRef.current = true
      onSaveStateChange('error')
      setError(nextError instanceof Error ? nextError.message : t('form.saveFailed'))
    } finally {
      savingRef.current = false
      if (!failed && (pendingSaveRef.current || dirtyRef.current)) {
        pendingSaveRef.current = false
        void persistNow()
      }
    }
  }, [object.id, onSaveStateChange, t, updateObject])

  const queueSave = useCallback(() => {
    dirtyRef.current = true
    onSaveStateChange('saving')
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void persistNow()
    }, SAVE_DEBOUNCE_MS)
  }, [onSaveStateChange, persistNow])

  const flushSave = useCallback(() => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (dirtyRef.current || pendingSaveRef.current) void persistNow()
  }, [persistNow])

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === 'hidden') flushSave()
    }
    window.addEventListener('pagehide', flushSave)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flushSave)
      document.removeEventListener('visibilitychange', onHide)
      flushSave()
    }
  }, [flushSave])

  function changeTitle(value: string) {
    draftRef.current = { ...draftRef.current, title: value }
    setTitle(value)
    queueSave()
  }

  function changeBody(value: string) {
    draftRef.current = { ...draftRef.current, body: value }
    setBody(value)
    queueSave()
  }

  function changeOccurredAt(value: string) {
    draftRef.current = { ...draftRef.current, occurredAt: value }
    setOccurredAt(value)
    queueSave()
  }

  function changeMeta(key: string, value: string | number | boolean | null) {
    const next = { ...draftRef.current.meta, [key]: value }
    draftRef.current = { ...draftRef.current, meta: next }
    setMeta(next)
    queueSave()
  }

  const goalTargetDate =
    object.type === 'goal' && typeof meta.targetDate === 'string' && meta.targetDate
      ? meta.targetDate
      : null

  return (
    <>
      <header className="detail-header">
        <div className="detail-meta">
          <TypeBadge type={object.type} />
          {object.type === 'goal' ? (
            goalTargetDate ? (
              <time dateTime={goalTargetDate}>
                {formatDate(fromDateInputValue(goalTargetDate.slice(0, 10)))}
              </time>
            ) : null
          ) : (
            <InlineDateInput
              value={occurredAt}
              onChange={changeOccurredAt}
              onBlur={flushSave}
              label={t('form.date')}
              includeTime
            />
          )}
        </div>
        <input
          className="inline-title-input"
          value={title}
          onChange={(event) => changeTitle(event.target.value)}
          onBlur={flushSave}
          placeholder={schema.titlePlaceholder}
          aria-label={t('form.title', { type: schema.label })}
        />
      </header>

      <section className="detail-body">
        <h2>{schema.bodyLabel}</h2>
        <MarkdownEditor
          value={body}
          onChange={changeBody}
          onBlur={flushSave}
          onError={(message) => {
            onSaveStateChange('error')
            setError(message)
          }}
          placeholder={schema.bodyPlaceholder}
        />
      </section>

      <section className="detail-fields">
        <h2>{t('detail.fields')}</h2>
        <dl>
          {schema.fields.map((field) => (
            <div key={field.key}>
              <dt>{field.label}</dt>
              <dd>
                {field.kind === 'select' ? (
                  <select
                    className="inline-meta-control"
                    value={String(meta[field.key] ?? '')}
                    onChange={(event) => changeMeta(field.key, event.target.value)}
                    onBlur={flushSave}
                    aria-label={field.label}
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.kind === 'date' ? (
                  <InlineDateInput
                    value={meta[field.key] == null ? '' : String(meta[field.key])}
                    onChange={(value) => changeMeta(field.key, value || null)}
                    onBlur={flushSave}
                    label={field.label}
                  />
                ) : (
                  <input
                    className="inline-meta-control"
                    type={field.kind}
                    min={field.kind === 'number' ? 0 : undefined}
                    value={meta[field.key] == null ? '' : String(meta[field.key])}
                    onChange={(event) =>
                      changeMeta(
                        field.key,
                        field.kind === 'number'
                          ? event.target.value === ''
                            ? null
                            : Number(event.target.value)
                          : event.target.value || null,
                      )
                    }
                    onBlur={flushSave}
                    placeholder={field.placeholder}
                    aria-label={field.label}
                  />
                )}
              </dd>
            </div>
          ))}
          {object.type !== 'goal' ? (
            <div>
              <dt>{t('detail.created')}</dt>
              <dd>{formatDateTime(object.createdAt)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
    </>
  )
}
