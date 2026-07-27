import type { ObjectType } from '../core/types'

export type FieldKind = 'text' | 'number' | 'select' | 'date'

export interface MetaFieldSchema {
  key: string
  label: string
  kind: FieldKind
  placeholder?: string
  options?: { value: string; label: string }[]
  required?: boolean
}

export interface ObjectTypeSchema {
  type: ObjectType
  label: string
  labelKo: string
  description: string
  titlePlaceholder: string
  bodyPlaceholder: string
  bodyLabel: string
  accent: string
  fields: MetaFieldSchema[]
}

export const OBJECT_SCHEMAS: Record<ObjectType, ObjectTypeSchema> = {
  journal: {
    type: 'journal',
    label: 'Journal',
    labelKo: '일기',
    description: '하루의 기록과 감정',
    titlePlaceholder: '오늘의 한 줄',
    bodyPlaceholder: '무엇이 있었고, 어떻게 느꼈나요?',
    bodyLabel: '본문',
    accent: 'var(--accent-journal)',
    fields: [
      {
        key: 'mood',
        label: '기분',
        kind: 'select',
        options: [
          { value: 'calm', label: '평온' },
          { value: 'good', label: '좋음' },
          { value: 'hard', label: '힘듦' },
          { value: 'grateful', label: '감사' },
        ],
      },
    ],
  },
  project: {
    type: 'project',
    label: 'Project',
    labelKo: '프로젝트',
    description: '만들고 있는 것들',
    titlePlaceholder: '프로젝트 이름',
    bodyPlaceholder: '무엇을 만들고, 왜 중요한가요?',
    bodyLabel: '설명',
    accent: 'var(--accent-project)',
    fields: [
      {
        key: 'status',
        label: '상태',
        kind: 'select',
        options: [
          { value: 'idea', label: '아이디어' },
          { value: 'active', label: '진행 중' },
          { value: 'paused', label: '보류' },
          { value: 'done', label: '완료' },
        ],
      },
    ],
  },
  workout: {
    type: 'workout',
    label: 'Workout',
    labelKo: '운동',
    description: '몸에 남긴 흔적',
    titlePlaceholder: '예: 하체 근력, 러닝 5km',
    bodyPlaceholder: '세트, 느낌, 특이사항',
    bodyLabel: '메모',
    accent: 'var(--accent-workout)',
    fields: [
      {
        key: 'durationMin',
        label: '시간 (분)',
        kind: 'number',
        placeholder: '45',
      },
      {
        key: 'intensity',
        label: '강도',
        kind: 'select',
        options: [
          { value: 'low', label: '낮음' },
          { value: 'medium', label: '보통' },
          { value: 'high', label: '높음' },
        ],
      },
    ],
  },
  study: {
    type: 'study',
    label: 'Study',
    labelKo: '공부',
    description: '그날 해야 할 공부',
    titlePlaceholder: '예: 수학 문제집 10쪽',
    bodyPlaceholder: '메모 (선택)',
    bodyLabel: '메모',
    accent: 'var(--accent-study)',
    fields: [
      {
        key: 'subject',
        label: '과목',
        kind: 'text',
        placeholder: '과목 또는 주제',
      },
    ],
  },
  goal: {
    type: 'goal',
    label: 'Goal',
    labelKo: '목표',
    description: '삶이 향하는 방향',
    titlePlaceholder: '이루고 싶은 것',
    bodyPlaceholder: '왜 이 목표가 중요한가요?',
    bodyLabel: '동기',
    accent: 'var(--accent-goal)',
    fields: [
      {
        key: 'status',
        label: '상태',
        kind: 'select',
        options: [
          { value: 'active', label: '진행 중' },
          { value: 'achieved', label: '달성' },
          { value: 'paused', label: '보류' },
        ],
      },
      {
        key: 'targetDate',
        label: '목표일',
        kind: 'date',
      },
    ],
  },
}

export const CREATE_ORDER: ObjectType[] = [
  'journal',
  'project',
  'workout',
  'study',
  'goal',
]

export function getSchema(type: ObjectType): ObjectTypeSchema {
  return OBJECT_SCHEMAS[type]
}

export function defaultMeta(type: ObjectType): Record<string, string | number | boolean | null> {
  switch (type) {
    case 'journal':
      return { mood: 'calm' }
    case 'project':
      return { status: 'active' }
    case 'workout':
      return { durationMin: null, intensity: 'medium' }
    case 'study':
      return { subject: '', done: false }
    case 'goal':
      return { status: 'active', targetDate: null }
  }
}

export function formatMetaValue(
  type: ObjectType,
  key: string,
  value: string | number | boolean | null,
): string | null {
  if (value === null || value === undefined || value === '') return null
  const field = OBJECT_SCHEMAS[type].fields.find((item) => item.key === key)
  if (!field) return String(value)
  if (field.kind === 'select') {
    return field.options?.find((option) => option.value === value)?.label ?? String(value)
  }
  if (field.kind === 'number' && key === 'durationMin') {
    return `${value}분`
  }
  return String(value)
}
