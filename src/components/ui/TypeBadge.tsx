import type { CSSProperties } from 'react'
import { getSchema } from '../../domain/schemas'
import type { ObjectType } from '../../core/types'

export function TypeBadge({ type }: { type: ObjectType }) {
  const schema = getSchema(type)
  return (
    <span
      className="type-badge"
      style={{ '--badge-accent': schema.accent } as CSSProperties}
    >
      {schema.labelKo}
    </span>
  )
}
