import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BackLink } from '../components/ui/BackLink'
import { TypeBadge } from '../components/ui/TypeBadge'
import type { LifeObject, Relationship } from '../core/types'
import { formatMetaValue, getSchema } from '../domain/schemas'
import { formatDateTime } from '../lib/format'
import { useLife } from '../state/LifeContext'

export function ObjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ready, getObject, deleteObject, getRelationships } = useLife()
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
    return <p className="empty-state">불러오는 중…</p>
  }

  const schema = getSchema(object.type)
  const related = relationships
    .map((rel) => {
      const otherId = rel.sourceId === object.id ? rel.targetId : rel.sourceId
      const other = getObject(otherId)
      return other ? { rel, other } : null
    })
    .filter((item): item is { rel: Relationship; other: LifeObject } => !!item)

  return (
    <article className="detail">
      <BackLink to="/" />

      <header className="detail-header">
        <div className="detail-meta">
          <TypeBadge type={object.type} />
          <time dateTime={object.occurredAt}>{formatDateTime(object.occurredAt)}</time>
        </div>
        <h1>{object.title}</h1>
        <p className="detail-sub">{schema.description}</p>
      </header>

      {object.body ? (
        <section className="detail-body">
          <h2>{schema.bodyLabel}</h2>
          <p>{object.body}</p>
        </section>
      ) : null}

      <section className="detail-fields">
        <h2>세부 정보</h2>
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
          <div>
            <dt>생성</dt>
            <dd>{formatDateTime(object.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-relations">
        <h2>연결</h2>
        {related.length === 0 ? (
          <p className="muted">
            연결된 객체가 없습니다. 생성 시 목표와 연결할 수 있습니다.
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

      <div className="detail-actions">
        <Link to={`/object/${object.id}/edit`} className="btn btn-ghost">
          수정
        </Link>
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            const confirmed = window.confirm('이 기록을 삭제할까요?')
            if (!confirmed) return
            await deleteObject(object.id)
            navigate('/')
          }}
        >
          삭제
        </button>
      </div>
    </article>
  )
}
