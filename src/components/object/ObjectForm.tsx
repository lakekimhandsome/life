import { useMemo, useState, type FormEvent } from 'react'
import { defaultMeta, getSchema } from '../../domain/schemas'
import { fromDateInputValue, toDateInputValue } from '../../lib/format'
import type { LifeObject, ObjectType } from '../../core/types'
import { useLife } from '../../state/LifeContext'

interface ObjectFormProps {
  type: ObjectType
  initial?: LifeObject
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
  onSubmit,
  submitLabel,
}: ObjectFormProps) {
  const schema = getSchema(type)
  const { listByType } = useLife()
  const goals = listByType('goal')

  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [occurredAt, setOccurredAt] = useState(
    toDateInputValue(initial?.occurredAt ?? new Date().toISOString()),
  )
  const [meta, setMeta] = useState<LifeObject['meta']>(
    initial?.meta ?? defaultMeta(type),
  )
  const [linkedGoalId, setLinkedGoalId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canLinkGoal = type !== 'goal' && !initial

  const metaFields = useMemo(() => schema.fields, [schema.fields])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('제목을 입력해 주세요.')
      return
    }

    setSaving(true)
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
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="object-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="title">{schema.labelKo} 제목</label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={schema.titlePlaceholder}
          autoFocus
        />
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="occurredAt">날짜</label>
          <input
            id="occurredAt"
            type="date"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </div>

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

      <div className="field">
        <label htmlFor="body">{schema.bodyLabel}</label>
        <textarea
          id="body"
          rows={7}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={schema.bodyPlaceholder}
        />
      </div>

      {canLinkGoal ? (
        <div className="field">
          <label htmlFor="linkedGoal">연결된 목표 (선택)</label>
          <select
            id="linkedGoal"
            value={linkedGoalId}
            onChange={(event) => setLinkedGoalId(event.target.value)}
          >
            <option value="">연결하지 않음</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
          <p className="field-hint">
            기록은 목표와 연결될 수 있습니다. LIFE의 모든 객체는 서로 이어집니다.
          </p>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? '저장 중…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
