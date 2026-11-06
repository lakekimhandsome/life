import { useRef, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import {
  InlineMarkdownObject,
  type ObjectSaveState,
} from '../components/object/InlineMarkdownObject'
import { BackLink } from '../components/ui/BackLink'
import { OBJECT_TYPES, type LifeObject, type ObjectType } from '../core/types'
import { getModuleForObjectType } from '../domain/modules'
import { defaultMeta } from '../domain/schemas'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'

function isObjectType(value: string | undefined): value is ObjectType {
  return !!value && (OBJECT_TYPES as readonly string[]).includes(value)
}

export function CreatePage() {
  const { type } = useParams()
  const [searchParams] = useSearchParams()
  const folderId = type === 'note' ? searchParams.get('folder') : null
  const { createObject, updateObject } = useLife()
  const [saveState, setSaveState] = useState<ObjectSaveState>('saved')
  const createdIdRef = useRef<string | null>(null)
  const createdVersionRef = useRef<string | undefined>(undefined)
  const t = useT()

  if (!isObjectType(type)) {
    return <Navigate to="/" replace />
  }

  const backTo = type === 'note' && folderId ? `/notes?folder=${encodeURIComponent(folderId)}` : getModuleForObjectType(type)?.path ?? '/'
  const now = new Date().toISOString()
  const draft: LifeObject = {
    id: 'new',
    type,
    title: '',
    body: '',
    occurredAt: now,
    createdAt: now,
    updatedAt: now,
    visibility: 'private',
    shareToken: null,
    meta: defaultMeta(type),
  }
  return (
    <article className="detail">
      <div className="object-page-toolbar">
        <BackLink to={backTo} />
      </div>

      <InlineMarkdownObject
        object={draft}
        saveState={saveState}
        onSaveStateChange={setSaveState}
        onSave={async ({ title, body, occurredAt, meta }) => {
          const input = {
            title,
            body,
            occurredAt,
            meta,
          }
          if (createdIdRef.current) {
            const updated = await updateObject(createdIdRef.current, { ...input, expectedUpdatedAt: createdVersionRef.current })
            if (!updated) throw new Error(t('form.conflict'))
            createdVersionRef.current = updated.updatedAt
            return
          }
          const created = await createObject({
            type,
            folderId,
            ...input,
          })
          createdIdRef.current = created.id
          createdVersionRef.current = created.updatedAt
          window.history.replaceState(window.history.state, '', `/object/${created.id}`)
        }}
      />
    </article>
  )
}
