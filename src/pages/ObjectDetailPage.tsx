import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BackLink } from '../components/ui/BackLink'
import { MarkdownContent } from '../components/ui/MarkdownContent'
import { TypeBadge } from '../components/ui/TypeBadge'
import type { LifeObject, Relationship } from '../core/types'
import { getModuleForObjectType } from '../domain/modules'
import { formatMetaValue, getSchema, supportsMarkdownBody } from '../domain/schemas'
import { formatDate, formatDateTime, fromDateInputValue } from '../lib/format'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'

export function ObjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ready, getObject, deleteObject, getRelationships } = useLife()
  const t = useT()
  const [relationships, setRelationships] = useState<Relationship[]>([])

  const object = id ? getObject(id) : undefined

  useEffect(() => {
    if (!id) return
    let active = true
    ;(async () => {
      const next = await getRelationships(id)
      if (active) setRelationships(next)
    })()
    return () => {
      active = false
    }
  }, [id, getRelationships])

  if (ready && id && !object) {
    return <Navigate to="/" replace />
  }

  if (!object) {
    return <p className="empty-state">{t('common.loading')}</p>
  }

  const schema = getSchema(object.type)
  const module = getModuleForObjectType(object.type)
  const backTo = module?.path ?? '/'
  const supportsMarkdown = supportsMarkdownBody(object.type)
  const goalTargetDate =
    object.type === 'goal' && typeof object.meta.targetDate === 'string' && object.meta.targetDate
      ? object.meta.targetDate
      : null
  const headerDate = object.type === 'goal' ? goalTargetDate : object.occurredAt
  const related = relationships
    .map((rel) => {
      const otherId = rel.sourceId === object.id ? rel.targetId : rel.sourceId
      const other = getObject(otherId)
      return other ? { rel, other } : null
    })
    .filter((item): item is { rel: Relationship; other: LifeObject } => !!item)

  return (
    <article className="detail">
      <div className="object-page-toolbar">
        <BackLink to={backTo} />
        {supportsMarkdown ? (
          <div className="object-header-actions">
            <Link
              to={`/object/${object.id}/edit`}
              className="object-header-action"
              aria-label={t('detail.editAria', { type: schema.label })}
            >
              <Pencil size={20} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="object-header-action"
              aria-label={t('detail.deleteAria', { type: schema.label })}
              onClick={async () => {
                const confirmed = window.confirm(t('detail.deleteConfirm'))
                if (!confirmed) return
                await deleteObject(object.id)
                navigate(backTo)
              }}
            >
              <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

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
        <section className="detail-body">
          <h2>{schema.bodyLabel}</h2>
          {supportsMarkdown ? (
            <MarkdownContent className="markdown-content">{object.body}</MarkdownContent>
          ) : (
            <p>{object.body}</p>
          )}
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

      <section className="detail-relations">
        <h2>{t('detail.links')}</h2>
        {related.length === 0 ? (
          <p className="muted">
            {t('detail.noLinks')}
          </p>
        ) : (
          <ul className="relation-list">
            {related.map(({ rel, other }) => (
              <li key={rel.id}>
                <Link to={`/object/${other.id}`}>
                  <TypeBadge type={other.type} />
                  <span>{other.title}</span>
                  <em>{rel.kind}</em>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!supportsMarkdown ? (
        <div className="detail-actions">
          <Link to={`/object/${object.id}/edit`} className="btn btn-ghost">
            {t('common.edit')}
          </Link>
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              const confirmed = window.confirm(t('detail.deleteConfirm'))
              if (!confirmed) return
              await deleteObject(object.id)
              navigate(backTo)
            }}
          >
            {t('common.delete')}
          </button>
        </div>
      ) : null}
    </article>
  )
}
