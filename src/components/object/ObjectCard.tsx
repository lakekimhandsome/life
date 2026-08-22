import { ChevronRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, fromDateInputValue } from '../../lib/format'
import { stripMarkdown } from '../../lib/markdown'
import { formatMetaValue, getSchema, supportsMarkdownBody } from '../../domain/schemas'
import type { LifeObject } from '../../core/types'
import { TypeBadge } from '../ui/TypeBadge'

export function ObjectCard({ object }: { object: LifeObject }) {
  const schema = getSchema(object.type)
  const goalTargetDate =
    object.type === 'goal' && typeof object.meta.targetDate === 'string' && object.meta.targetDate
      ? object.meta.targetDate
      : null
  const shownDate = object.type === 'goal' ? goalTargetDate : object.occurredAt
  const metaBits = schema.fields
    .filter((field) => object.type !== 'goal' || field.key !== 'targetDate')
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
    <Link
      to={`/object/${object.id}`}
      className="object-row"
      style={{ '--row-accent': schema.accent } as CSSProperties}
    >
      <div className="object-row-main">
        <div className="object-row-meta">
          <TypeBadge type={object.type} />
          {shownDate ? (
            <time dateTime={shownDate}>
              {object.type === 'goal'
                ? formatDate(fromDateInputValue(shownDate.slice(0, 10)))
                : formatDate(shownDate)}
            </time>
          ) : null}
        </div>
        <h3>{object.title}</h3>
        {bodyPreview ? <p>{bodyPreview}</p> : null}
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
  )
}
