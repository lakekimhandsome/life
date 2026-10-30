import type { ObjectType } from '../core/types'
import { t, type MessageKey } from '../i18n'
import { formatDate, fromDateInputValue } from '../lib/format'

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
  enLabel: string
  label: string
  description: string
  titlePlaceholder: string
  bodyPlaceholder: string
  bodyLabel: string
  accent: string
  fields: MetaFieldSchema[]
}

type FieldDef = {
  key: string
  kind: FieldKind
  labelKey: MessageKey
  placeholderKey?: MessageKey
  placeholder?: string
  optionKeys?: Record<string, MessageKey>
  required?: boolean
}

type SchemaDef = {
  type: ObjectType
  enLabel: string
  descriptionKey?: MessageKey
  titlePlaceholderKey: MessageKey
  bodyPlaceholderKey: MessageKey
  bodyLabelKey: MessageKey
  accent: string
  fields: FieldDef[]
}

const SCHEMA_DEFS: Record<ObjectType, SchemaDef> = {
  journal: {
    type: 'journal',
    enLabel: 'Journal',
    titlePlaceholderKey: 'schema.journal.titlePlaceholder',
    bodyPlaceholderKey: 'schema.journal.bodyPlaceholder',
    bodyLabelKey: 'schema.journal.bodyLabel',
    accent: 'var(--accent-journal)',
    fields: [
      {
        key: 'mood',
        kind: 'select',
        labelKey: 'mood.label',
        optionKeys: {
          calm: 'mood.calm',
          good: 'mood.good',
          hard: 'mood.hard',
          grateful: 'mood.grateful',
        },
      },
    ],
  },
  project: {
    type: 'project',
    enLabel: 'Project',
    titlePlaceholderKey: 'schema.project.titlePlaceholder',
    bodyPlaceholderKey: 'schema.project.bodyPlaceholder',
    bodyLabelKey: 'schema.project.bodyLabel',
    accent: 'var(--accent-project)',
    fields: [
      {
        key: 'status',
        kind: 'select',
        labelKey: 'schema.status',
        optionKeys: {
          idea: 'status.idea',
          active: 'status.active',
          paused: 'status.paused',
          done: 'status.done',
        },
      },
    ],
  },
  note: {
    type: 'note',
    enLabel: 'Note',
    titlePlaceholderKey: 'schema.note.titlePlaceholder',
    bodyPlaceholderKey: 'schema.note.bodyPlaceholder',
    bodyLabelKey: 'schema.note.bodyLabel',
    accent: 'var(--accent-note)',
    fields: [],
  },
  plan: {
    type: 'plan',
    enLabel: 'Plan',
    descriptionKey: 'schema.plan.description',
    titlePlaceholderKey: 'schema.plan.titlePlaceholder',
    bodyPlaceholderKey: 'schema.plan.bodyPlaceholder',
    bodyLabelKey: 'schema.plan.bodyLabel',
    accent: 'var(--accent-plan)',
    fields: [
      {
        key: 'subject',
        kind: 'text',
        labelKey: 'schema.plan.subject',
        placeholderKey: 'schema.plan.subjectPlaceholder',
      },
    ],
  },
  goal: {
    type: 'goal',
    enLabel: 'Goal',
    titlePlaceholderKey: 'schema.goal.titlePlaceholder',
    bodyPlaceholderKey: 'schema.goal.bodyPlaceholder',
    bodyLabelKey: 'schema.goal.bodyLabel',
    accent: 'var(--accent-goal)',
    fields: [
      {
        key: 'status',
        kind: 'select',
        labelKey: 'schema.status',
        optionKeys: {
          active: 'status.active',
          achieved: 'status.achieved',
          paused: 'status.paused',
        },
      },
      {
        key: 'targetDate',
        kind: 'date',
        labelKey: 'schema.goal.targetDate',
      },
    ],
  },
  asset: {
    type: 'asset',
    enLabel: 'Asset',
    descriptionKey: 'schema.asset.description',
    titlePlaceholderKey: 'schema.asset.titlePlaceholder',
    bodyPlaceholderKey: 'schema.asset.bodyPlaceholder',
    bodyLabelKey: 'schema.asset.bodyLabel',
    accent: 'var(--accent-asset)',
    fields: [
      {
        key: 'kind',
        kind: 'select',
        labelKey: 'schema.asset.kind',
        optionKeys: {
          cash: 'assets.kind.cash',
          stock: 'assets.kind.stock',
          commodity: 'assets.kind.commodity',
          real_estate: 'assets.kind.real_estate',
          debt: 'assets.kind.debt',
        },
        required: true,
      },
      {
        key: 'symbol',
        kind: 'text',
        labelKey: 'schema.asset.symbol',
        placeholder: 'KRW, AAPL, GOLD…',
        required: true,
      },
      {
        key: 'quantity',
        kind: 'number',
        labelKey: 'schema.asset.quantity',
        placeholder: '1',
        required: true,
      },
    ],
  },
}

function localizeField(field: FieldDef): MetaFieldSchema {
  return {
    key: field.key,
    kind: field.kind,
    label: t(field.labelKey),
    placeholder: field.placeholderKey ? t(field.placeholderKey) : field.placeholder,
    options: field.optionKeys
      ? Object.entries(field.optionKeys).map(([value, key]) => ({
          value,
          label: t(key),
        }))
      : undefined,
    required: field.required,
  }
}

export const CREATE_ORDER: ObjectType[] = [
  'journal',
  'project',
  'note',
  'plan',
  'goal',
  'asset',
]

export function supportsMarkdownBody(type: ObjectType): boolean {
  return type === 'journal' || type === 'goal' || type === 'project' || type === 'note'
}

const OBJECT_LABEL_KEY: Record<ObjectType, MessageKey> = {
  journal: 'object.journal',
  project: 'object.project',
  note: 'object.note',
  plan: 'object.plan',
  goal: 'object.goal',
  asset: 'object.asset',
}

export function getSchema(type: ObjectType): ObjectTypeSchema {
  const def = SCHEMA_DEFS[type]
  return {
    type: def.type,
    enLabel: def.enLabel,
    label: t(OBJECT_LABEL_KEY[type]),
    description: def.descriptionKey ? t(def.descriptionKey) : '',
    titlePlaceholder: t(def.titlePlaceholderKey),
    bodyPlaceholder: t(def.bodyPlaceholderKey),
    bodyLabel: t(def.bodyLabelKey),
    accent: def.accent,
    fields: def.fields.map(localizeField),
  }
}

export function defaultMeta(type: ObjectType): Record<string, string | number | boolean | null> {
  switch (type) {
    case 'journal':
      return { mood: 'calm' }
    case 'project':
      return { status: 'active' }
    case 'note':
      return {}
    case 'plan':
      return { subject: '', done: false }
    case 'goal':
      return { status: 'active', targetDate: null, showOnHome: true }
    case 'asset':
      return { kind: 'cash', symbol: 'KRW', quantity: null }
  }
}

export function formatMetaValue(
  type: ObjectType,
  key: string,
  value: string | number | boolean | null,
): string | null {
  if (value === null || value === undefined || value === '') return null
  const field = getSchema(type).fields.find((item) => item.key === key)
  if (!field) return String(value)
  if (field.kind === 'select') {
    return field.options?.find((option) => option.value === value)?.label ?? String(value)
  }
  if (field.kind === 'date') {
    return formatDate(fromDateInputValue(String(value).slice(0, 10)))
  }
  if (type === 'asset' && key === 'quantity') {
    return String(value)
  }
  return String(value)
}
