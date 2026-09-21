import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  InlineMarkdownObject,
  type ObjectSaveState,
} from '../components/object/InlineMarkdownObject'
import { BackLink } from '../components/ui/BackLink'
import { TypeBadge } from '../components/ui/TypeBadge'
import { ObjectRelations } from '../components/object/ObjectRelations'
import { getModuleForObjectType } from '../domain/modules'
import { formatMetaValue, getSchema, supportsMarkdownBody } from '../domain/schemas'
import { formatDate, formatDateTime, fromDateInputValue } from '../lib/format'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'

export function ObjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ready, getObject, deleteObject } = useLife()
  const t = useT()
  const [saveState, setSaveState] = useState<ObjectSaveState>('saved')
  const [deleting, setDeleting] = useState(false)

  const object = id ? getObject(id) : undefined

  if (ready && id && !object) {
    return <Navigate to="/" replace />
  }

  if (!object) {
    return <p className="empty-state">{t('common.loading')}</p>
  }

  const schema = getSchema(object.type)
  const objectId = object.id
  const module = getModuleForObjectType(object.type)
  const backTo = module?.path ?? '/'
  const supportsMarkdown = supportsMarkdownBody(object.type)
  const goalTargetDate =
    object.type === 'goal' && typeof object.meta.targetDate === 'string' && object.meta.targetDate
      ? object.meta.targetDate
      : null
  const headerDate = object.type === 'goal' ? goalTargetDate : object.occurredAt
  const saveLabel =
    saveState === 'saving'
      ? t('clipboard.saving')
      : saveState === 'error'
        ? t('clipboard.saveError')
        : t('clipboard.saved')

  async function handleDelete() {
    const confirmed = window.confirm(t('detail.deleteConfirm'))
    if (!confirmed) return
    setDeleting(true)
    navigate(backTo, { replace: true, flushSync: true })
    try {
      await deleteObject(objectId)
    } catch (error) {
      console.error('Failed to delete object', error)
      navigate(`/object/${objectId}`, { replace: true })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <article className="detail">
      <div className="object-page-toolbar">
        <BackLink to={backTo} />
        {supportsMarkdown ? (
          <div className="object-header-actions">
            <span
              className={`clipboard-save${saveState === 'error' ? ' is-error' : ''}`}
              aria-live="polite"
            >
              {saveLabel}
            </span>
            <button
              type="button"
              className="object-header-action"
              aria-label={t('detail.deleteAria', { type: schema.label })}
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      {supportsMarkdown ? (
        <InlineMarkdownObject
          key={object.id}
          object={object}
          onSaveStateChange={setSaveState}
        />
      ) : (
        <>
          <header className="detail-header">
            <div className="detail-meta">
              <TypeBadge type={object.type} />
              {headerDate ? (
                <time dateTime={headerDate}>
                  {object.type === 'goal'
                    ? formatDate(fromDateInputValue(headerDate.slice(0, 10)))
                    : formatDateTime(object.occurredAt)}
                </time>
              ) : null}
            </div>
            <h1>{object.title}</h1>
            {schema.description ? <p className="detail-sub">{schema.description}</p> : null}
          </header>

          {object.body ? (
            <section className="detail-body" aria-label={schema.bodyLabel}>
              <p>{object.body}</p>
            </section>
          ) : null}

          <section className="detail-fields">
            <h2>{t('detail.fields')}</h2>
            <dl>
              {schema.fields.map((field) => {
                const formatted = formatMetaValue(
                  object.type,
                  field.key,
                  object.meta[field.key] ?? null,
                )
                if (!formatted) return null
                return (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>{formatted}</dd>
                  </div>
                )
              })}
              {object.type !== 'goal' ? (
                <div>
                  <dt>{t('detail.created')}</dt>
                  <dd>{formatDateTime(object.createdAt)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </>
      )}

      <ObjectRelations key={object.id} object={object} />

      {!supportsMarkdown ? (
        <div className="detail-actions">
          <Link to={`/object/${object.id}/edit`} className="btn btn-ghost">
            {t('common.edit')}
          </Link>
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            {t('common.delete')}
          </button>
        </div>
      ) : null}
    </article>
  )
}
