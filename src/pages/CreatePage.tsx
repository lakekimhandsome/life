import { useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  InlineMarkdownObject,
  type ObjectSaveState,
} from '../components/object/InlineMarkdownObject'
import { BackLink } from '../components/ui/BackLink'
import { OBJECT_TYPES, type LifeObject, type ObjectType } from '../core/types'
import { getModuleForObjectType } from '../domain/modules'
import { defaultMeta } from '../domain/schemas'
import { fromDateInputValue } from '../lib/format'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'

function isObjectType(value: string | undefined): value is ObjectType {
  return !!value && (OBJECT_TYPES as readonly string[]).includes(value)
}

export function CreatePage() {
  const t = useT()
  const { type } = useParams()
  const navigate = useNavigate()
  const { createObject, updateObject } = useLife()
  const [saveState, setSaveState] = useState<ObjectSaveState>('saved')
  const createdIdRef = useRef<string | null>(null)

  if (!isObjectType(type)) {
    return <Navigate to="/" replace />
  }

  const backTo = getModuleForObjectType(type)?.path ?? '/'
  const now = new Date().toISOString()
  const draft: LifeObject = {
    id: 'new',
    type,
    title: '',
    body: '',
    occurredAt: now,
    createdAt: now,
    updatedAt: now,
    meta: defaultMeta(type),
  }
  const saveLabel =
    saveState === 'saving'
      ? t('clipboard.saving')
      : saveState === 'error'
        ? t('clipboard.saveError')
        : t('clipboard.saved')

  return (
    <article className="detail">
      <div className="object-page-toolbar">
        <BackLink to={backTo} />
        <div className="object-header-actions">
          <span
            className={`clipboard-save${saveState === 'error' ? ' is-error' : ''}`}
            aria-live="polite"
          >
            {saveLabel}
          </span>
        </div>
      </div>

      <InlineMarkdownObject
        object={draft}
        onSaveStateChange={setSaveState}
        onSave={async ({ title, body, occurredAt, meta }) => {
          const input = {
            title,
            body,
            occurredAt: fromDateInputValue(occurredAt),
            meta,
          }
          if (createdIdRef.current) {
            await updateObject(createdIdRef.current, input)
            return
          }
          const created = await createObject({
            type,
            ...input,
          })
          createdIdRef.current = created.id
          navigate(`/object/${created.id}`, { replace: true })
        }}
      />
    </article>
  )
}
