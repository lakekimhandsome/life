import type { LifeObject } from '../core/types'

export type ModuleId =
  | 'study'
  | 'workout'
  | 'assets'
  | 'journal'
  | 'goals'
  | 'projects'

export interface LifeModule {
  id: ModuleId
  icon: string
  title: string
  path: string
  /** Linked object type, if any. Assets has no object type yet. */
  objectType?: 'study' | 'workout' | 'journal' | 'goal' | 'project'
}

export const LIFE_MODULES: LifeModule[] = [
  {
    id: 'study',
    icon: '📚',
    title: '공부',
    path: '/study',
    objectType: 'study',
  },
  {
    id: 'workout',
    icon: '🏋',
    title: '운동',
    path: '/workout',
    objectType: 'workout',
  },
  {
    id: 'assets',
    icon: '💰',
    title: '자산',
    path: '/assets',
  },
  {
    id: 'journal',
    icon: '📔',
    title: '일기',
    path: '/journal',
    objectType: 'journal',
  },
  {
    id: 'goals',
    icon: '🎯',
    title: '목표',
    path: '/goals',
    objectType: 'goal',
  },
  {
    id: 'projects',
    icon: '🚀',
    title: '프로젝트',
    path: '/projects',
    objectType: 'project',
  },
]

function isSameLocalDay(iso: string, now = new Date()): boolean {
  const date = new Date(iso)
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function ofType(objects: LifeObject[], type: LifeObject['type']): LifeObject[] {
  return objects.filter((object) => object.type === type)
}

export function getModuleStatus(
  moduleId: ModuleId,
  objects: LifeObject[],
): string {
  const now = new Date()

  switch (moduleId) {
    case 'study': {
      const today = ofType(objects, 'study').filter((object) =>
        isSameLocalDay(object.occurredAt, now),
      )
      if (today.length === 0) return '오늘 미기록'
      return `오늘 기록 ${today.length}개`
    }
    case 'workout': {
      const today = ofType(objects, 'workout').filter((object) =>
        isSameLocalDay(object.occurredAt, now),
      )
      if (today.length === 0) return '오늘 미기록'
      return today[0].title
    }
    case 'assets':
      return '기록 없음'
    case 'journal': {
      const today = ofType(objects, 'journal').some((object) =>
        isSameLocalDay(object.occurredAt, now),
      )
      return today ? '오늘 작성됨' : '오늘 미작성'
    }
    case 'goals': {
      const active = ofType(objects, 'goal').filter(
        (object) => object.meta.status === 'active' || !object.meta.status,
      )
      if (active.length === 0) return '진행 중 없음'
      return `진행 중 ${active.length}개`
    }
    case 'projects': {
      const active = ofType(objects, 'project').filter(
        (object) => object.meta.status === 'active' || !object.meta.status,
      )
      if (active.length === 0) return '진행 중 없음'
      if (active.length === 1) return `${active[0].title} 진행 중`
      return `진행 중 ${active.length}개`
    }
  }
}
