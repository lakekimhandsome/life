import type { CSSProperties } from 'react'
import { getSchema } from '../../domain/schemas'
import type { ObjectType } from '../../core/types'
import { useT } from '../../state/LocaleContext'

export function TypeBadge({ type }: { type: ObjectType }) {
  useT()
  const schema = getSchema(type)
  return (
    <span
      className="type-badge"
      style={{ '--badge-accent': schema.accent } as CSSProperties}
    >
      {schema.label}
    </span>
  )
}
