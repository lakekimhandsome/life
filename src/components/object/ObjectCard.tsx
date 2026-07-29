import { ChevronRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../lib/format'
import { formatMetaValue, getSchema } from '../../domain/schemas'
import type { LifeObject } from '../../core/types'
import { TypeBadge } from '../ui/TypeBadge'

export function ObjectCard({ object }: { object: LifeObject }) {
  const schema = getSchema(object.type)
  const metaBits = schema.fields
    .map((field) => formatMetaValue(object.type, field.key, object.meta[field.key] ?? null))
    .filter(Boolean)
    .slice(0, 2)

  return (
    <Link
      to={`/object/${object.id}`}
      className="object-row"
      style={{ '--row-accent': schema.accent } as CSSProperties}
    >
      <div className="object-row-main">
        <div className="object-row-meta">
          <TypeBadge type={object.type} />
          <time dateTime={object.occurredAt}>{formatDate(object.occurredAt)}</time>
        </div>
        <h3>{object.title}</h3>
        {object.body ? <p>{object.body}</p> : null}
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
