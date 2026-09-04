import { useMemo, useState, type FormEvent } from 'react'
import { defaultMeta, getSchema, supportsMarkdownBody } from '../../domain/schemas'
import { fromDateInputValue, toDateInputValue } from '../../lib/format'
import type { LifeObject, ObjectType } from '../../core/types'
import { useLife } from '../../state/LifeContext'
import { useT } from '../../state/LocaleContext'
import { MarkdownEditor } from '../ui/MarkdownEditor'

interface ObjectFormProps {
  type: ObjectType
  initial?: LifeObject
  formId?: string
  showSubmitButton?: boolean
  onSavingChange?: (saving: boolean) => void
  onSubmit: (payload: {
    title: string
    body: string
    occurredAt: string
    meta: LifeObject['meta']
    linkedGoalId: string | null
  }) => Promise<void>
  submitLabel: string
}

export function ObjectForm({
  type,
  initial,
  formId,
  showSubmitButton = true,
  onSavingChange,
  onSubmit,
  submitLabel,
}: ObjectFormProps) {
  const t = useT()
  const schema = getSchema(type)
  const { listByType } = useLife()
  const goals = listByType('goal')

  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [occurredAt, setOccurredAt] = useState(
    toDateInputValue(initial?.occurredAt ?? new Date().toISOString()),
  )
  const [meta, setMeta] = useState<LifeObject['meta']>(() => {
    const base = initial?.meta ?? defaultMeta(type)
    if (type === 'goal' && initial) {
      return { ...base, showOnHome: base.showOnHome !== false }
    }
    return base
  })
  const [linkedGoalId, setLinkedGoalId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canLinkGoal = type !== 'goal' && !initial
  const supportsMarkdown = supportsMarkdownBody(type)

  const metaFields = useMemo(() => schema.fields, [schema.fields])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError(t('form.needTitle'))
      return
    }

    setSaving(true)
    onSavingChange?.(true)
    setError(null)
    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        occurredAt: fromDateInputValue(occurredAt),
        meta,
        linkedGoalId: canLinkGoal && linkedGoalId ? linkedGoalId : null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('form.saveFailed'))
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  return (
    <form id={formId} className="object-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="title">{t('form.title', { type: schema.label })}</label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={schema.titlePlaceholder}
          autoFocus
        />
      </div>

      <div className={`field-grid${supportsMarkdown ? ' field-grid--inline' : ''}`}>
        {type !== 'goal' ? (
          <div className="field">
            <label htmlFor="occurredAt">{t('form.date')}</label>
            <input
              id="occurredAt"
              type="date"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </div>
        ) : null}

        {metaFields.map((field) => (
          <div className="field" key={field.key}>
            <label htmlFor={field.key}>{field.label}</label>
            {field.kind === 'select' ? (
              <select
                id={field.key}
                value={String(meta[field.key] ?? '')}
                onChange={(event) =>
                  setMeta((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              >
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.kind === 'number' ? (
              <input
                id={field.key}
                type="number"
                min={0}
                placeholder={field.placeholder}
                value={meta[field.key] === null || meta[field.key] === undefined ? '' : String(meta[field.key])}
                onChange={(event) => {
                  const raw = event.target.value
                  setMeta((prev) => ({
                    ...prev,
                    [field.key]: raw === '' ? null : Number(raw),
                  }))
                }}
              />
            ) : (
              <input
                id={field.key}
                type={field.kind === 'date' ? 'date' : 'text'}
                placeholder={field.placeholder}
                value={
                  meta[field.key] === null || meta[field.key] === undefined
                    ? ''
                    : String(meta[field.key])
                }
                onChange={(event) =>
                  setMeta((prev) => ({
                    ...prev,
                    [field.key]: event.target.value || null,
                  }))
                }
              />
            )}
          </div>
        ))}
      </div>

      {type === 'goal' && initial ? (
        <label className="field-check" htmlFor="showOnHome">
          <input
            id="showOnHome"
            type="checkbox"
            checked={meta.showOnHome !== false}
            onChange={(event) =>
              setMeta((prev) => ({ ...prev, showOnHome: event.target.checked }))
            }
          />
          <span>
            {t('form.showOnHome')}
            <em>{t('form.showOnHomeHint')}</em>
          </span>
        </label>
      ) : null}

      <div className="field">
        <label htmlFor="body">{schema.bodyLabel}</label>
        {supportsMarkdown ? (
          <MarkdownEditor
            value={body}
            onChange={setBody}
            onError={setError}
            placeholder={schema.bodyPlaceholder}
          />
        ) : (
          <textarea
            id="body"
            rows={type === 'note' ? 14 : 7}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={schema.bodyPlaceholder}
          />
        )}
        {supportsMarkdown ? (
          <p className="field-hint">
            {t('form.markdownHint')}
          </p>
        ) : null}
      </div>

      {canLinkGoal ? (
        <div className="field">
          <label htmlFor="linkedGoal">{t('form.linkedGoal')}</label>
          <select
            id="linkedGoal"
            value={linkedGoalId}
            onChange={(event) => setLinkedGoalId(event.target.value)}
          >
            <option value="">{t('form.noLink')}</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
          <p className="field-hint">
            {t('form.linkHint')}
          </p>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      {showSubmitButton ? (
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : submitLabel}
          </button>
        </div>
      ) : null}
    </form>
  )
}
