import type { LifeObject } from '../core/types'

export function comparePinnedObjects(a: LifeObject, b: LifeObject): number {
  const aPinned = a.meta.pinned === true
  const bPinned = b.meta.pinned === true
  if (!aPinned || !bPinned) return Number(bPinned) - Number(aPinned)

  // Pins saved before timestamps were recorded keep their order above newer pins.
  const aPinnedAt = typeof a.meta.pinnedAt === 'string' ? a.meta.pinnedAt : ''
  const bPinnedAt = typeof b.meta.pinnedAt === 'string' ? b.meta.pinnedAt : ''
  return aPinnedAt.localeCompare(bPinnedAt)
}
