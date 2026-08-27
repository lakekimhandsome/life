import type { LifeObject, ObjectType } from '../core/types'
import { formatKrw } from './assets'
import { t, type MessageKey } from '../i18n'
import { isSameLocalDay } from '../lib/format'

export type ModuleId =
  | 'study'
  | 'workout'
  | 'assets'
  | 'journal'
  | 'goals'
  | 'projects'
  | 'notes'
  | 'clipboard'

export interface LifeModule {
  id: ModuleId
  path: string
  /** Linked object type, if any. */
  objectType?: ObjectType
}

const MODULE_TITLE_KEY: Record<ModuleId, MessageKey> = {
  study: 'modules.study',
  workout: 'modules.workout',
  assets: 'modules.assets',
  journal: 'modules.journal',
  goals: 'modules.goals',
  projects: 'modules.projects',
  notes: 'modules.notes',
  clipboard: 'modules.clipboard',
}

export const LIFE_MODULES: LifeModule[] = [
  {
    id: 'study',
    path: '/study',
    objectType: 'study',
  },
  {
    id: 'workout',
    path: '/workout',
    objectType: 'workout',
  },
  {
    id: 'assets',
    path: '/assets',
    objectType: 'asset',
  },
  {
    id: 'journal',
    path: '/journal',
    objectType: 'journal',
  },
  {
    id: 'goals',
    path: '/goals',
    objectType: 'goal',
  },
  {
    id: 'projects',
    path: '/projects',
    objectType: 'project',
  },
  {
    id: 'notes',
    path: '/notes',
    objectType: 'note',
  },
  {
    id: 'clipboard',
    path: '/clipboard',
  },
]

export function moduleTitle(id: ModuleId): string {
  return t(MODULE_TITLE_KEY[id])
}

export function getModuleForObjectType(
  type: LifeObject['type'],
): LifeModule | undefined {
  return LIFE_MODULES.find((item) => item.objectType === type)
}

function ofType(objects: LifeObject[], type: LifeObject['type']): LifeObject[] {
  return objects.filter((object) => object.type === type)
}

export function getModuleStatus(
  moduleId: ModuleId,
  objects: LifeObject[],
  extras?: {
    assetsTotalKrw?: number | null
    clipboard?: { body: string; imageCount: number } | null
  },
): string {
  const now = new Date()

  switch (moduleId) {
    case 'study': {
      const today = ofType(objects, 'study').filter((object) =>
        isSameLocalDay(object.occurredAt, now),
      )
      if (today.length === 0) return t('hub.study.none')
      const remaining = today.filter((object) => object.meta.done !== true)
      if (remaining.length === 0) return t('hub.study.done')
      return t('hub.study.remaining', { count: remaining.length })
    }
    case 'workout': {
      const today = ofType(objects, 'workout').filter((object) =>
        isSameLocalDay(object.occurredAt, now),
      )
      if (today.length === 0) return t('hub.workout.none')
      return today[0].title
    }
    case 'assets': {
      const assets = ofType(objects, 'asset')
      if (assets.length === 0) return t('hub.assets.none')
      if (extras?.assetsTotalKrw == null) return '…'
      return t('hub.assets.net', { value: formatKrw(extras.assetsTotalKrw) })
    }
    case 'journal': {
      const today = ofType(objects, 'journal').some((object) =>
        isSameLocalDay(object.occurredAt, now),
      )
      return today ? t('hub.journal.written') : t('hub.journal.none')
    }
    case 'goals': {
      const active = ofType(objects, 'goal').filter(
        (object) => object.meta.status === 'active' || !object.meta.status,
      )
      if (active.length === 0) return t('hub.progress.none')
      return t('hub.progress.count', { count: active.length })
    }
    case 'projects': {
      const active = ofType(objects, 'project').filter(
        (object) => object.meta.status === 'active' || !object.meta.status,
      )
      if (active.length === 0) return t('hub.progress.none')
      if (active.length === 1) return t('hub.progress.one', { title: active[0].title })
      return t('hub.progress.count', { count: active.length })
    }
    case 'notes': {
      const notes = ofType(objects, 'note')
      if (notes.length === 0) return t('hub.notes.none')
      return t('hub.notes.count', { count: notes.length })
    }
    case 'clipboard': {
      if (extras?.clipboard == null) return '…'
      const text = extras.clipboard.body.trim()
      const imageCount = extras.clipboard.imageCount
      if (!text && imageCount === 0) return t('hub.clipboard.empty')
      if (!text) {
        return imageCount === 1
          ? t('hub.clipboard.imageOne')
          : t('hub.clipboard.imageMany', { count: imageCount })
      }
      const firstLine = text.split('\n')[0] ?? ''
      const preview = firstLine.length > 16 ? `${firstLine.slice(0, 16)}…` : firstLine
      if (imageCount === 0) return preview
      return t('hub.clipboard.previewWithImages', { preview, count: imageCount })
    }
  }
}
