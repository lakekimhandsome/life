import { useRef, useState } from 'react'
import { FolderInput, Trash2 } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { InlineMarkdownObject } from '../components/object/InlineMarkdownObject'
import type { SaveState } from '../components/ui/SaveStatus'
import { BackLink } from '../components/ui/BackLink'
import { HeaderMenu } from '../components/ui/HeaderMenu'
import { TypeBadge } from '../components/ui/TypeBadge'
import { ObjectRelations } from '../components/object/ObjectRelations'
import { NoteFolderMoveDialog } from '../components/object/NoteFolderMoveDialog'
import { notesUrl } from '../lib/noteFolders'
import { ObjectShareControl } from '../components/object/ObjectShareControl'
import { isShareableObjectType, type LifeObject } from '../core/types'
import { getModuleForObjectType } from '../domain/modules'
import { formatMetaValue, getSchema, supportsMarkdownBody } from '../domain/schemas'
import { formatDate, formatDateTime, fromDateInputValue } from '../lib/format'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'

export function ObjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ready, getObject, deleteObject } = useLife()
  const t = useT()
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [deleting, setDeleting] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)

  const currentObject = id ? getObject(id) : undefined
  const lastObject = useRef<LifeObject | undefined>(undefined)
  if (currentObject) lastObject.current = currentObject
  // Keep the editor available to copy a draft if another client deletes its record.
  const object = currentObject ?? (lastObject.current?.id === id ? lastObject.current : undefined)

  if (ready && id && !object) {
    return <Navigate to="/" replace />
  }

  if (!object) {
    return <p className="empty-state">{t('common.loading')}</p>
  }

  const schema = getSchema(object.type)
  const { id: objectId, type, title } = object
  const module = getModuleForObjectType(object.type)
  const backTo = object.type === 'note' ? notesUrl(object.folderId) : module?.path ?? '/'
  const supportsMarkdown = supportsMarkdownBody(object.type)
  const goalTargetDate =
    object.type === 'goal' && typeof object.meta.targetDate === 'string' && object.meta.targetDate
      ? object.meta.targetDate
      : null
  const headerDate = object.type === 'goal' ? goalTargetDate : object.occurredAt
  async function handleDelete() {
    const movesToTrash = ['project', 'note', 'journal', 'goal'].includes(type)
    const message = movesToTrash
      ? t('detail.trashConfirm', { title })
      : t('detail.deleteConfirm')
    if (!window.confirm(message)) return
    setDeleting(true)
    navigate(backTo, { replace: true, flushSync: true })
    try {
      await deleteObject(objectId)
    } catch (error) {
      console.error('Failed to delete object', error)
      navigate(`/object/${objectId}`, { replace: true })
    } finally {
      setDeleting(false)
    }
  }

  const overflowActions = (
    <>
      {type === 'note' && <button type="button" disabled={!currentObject} onClick={() => setMovingId(objectId)}>
        <FolderInput size={16} aria-hidden="true" />
        {t('folders.move')}
      </button>}
      <button type="button" className="header-menu-danger"
        aria-label={t('detail.deleteAria', { type: schema.label })}
        disabled={deleting || !currentObject} onClick={() => void handleDelete()}>
        <Trash2 size={16} aria-hidden="true" />
        {t('common.delete')}
      </button>
    </>
  )

  const actions = (
    <div className="object-header-actions">
      {!supportsMarkdown && <Link to={`/object/${objectId}/edit`} className="object-edit-link">
        {t('common.edit')}
      </Link>}
      {isShareableObjectType(type) && supportsMarkdown ? (
        <ObjectShareControl key={objectId} object={object}>{overflowActions}</ObjectShareControl>
      ) : (
        <HeaderMenu label={t('common.moreActions')}>{overflowActions}</HeaderMenu>
      )}
    </div>
  )

  return (
    <article className="detail">
      {ready && !currentObject ? <p className="form-error" role="alert">{t('form.conflict')}</p> : null}
      {supportsMarkdown ? (
        <InlineMarkdownObject
          key={object.id}
          object={object}
          backTo={backTo}
          actions={actions}
          saveState={saveState}
          onSaveStateChange={setSaveState}
        />
      ) : (
        <>
          <header className="detail-header">
            <div className="object-title-bar">
              <BackLink to={backTo} />
              <h1>{object.title}</h1>
              {actions}
            </div>
            <div className="detail-meta">
              <TypeBadge type={object.type} />
              {headerDate ? (
                <time dateTime={headerDate}>
                  {object.type === 'goal'
                    ? formatDate(fromDateInputValue(headerDate.slice(0, 10)))
                    : formatDateTime(object.occurredAt)}
                </time>
              ) : null}
            </div>
            {schema.description ? <p className="detail-sub">{schema.description}</p> : null}
          </header>

          {object.body ? (
            <section className="detail-body" aria-label={schema.bodyLabel}>
              <p>{object.body}</p>
            </section>
          ) : null}

          <section className="detail-fields">
            <h2>{t('detail.fields')}</h2>
            <dl>
              {schema.fields.map((field) => {
                const formatted = formatMetaValue(
                  object.type,
                  field.key,
                  object.meta[field.key] ?? null,
                )
                if (!formatted) return null
                return (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>{formatted}</dd>
                  </div>
                )
              })}
              {object.type !== 'goal' ? (
                <div>
                  <dt>{t('detail.created')}</dt>
                  <dd>{formatDateTime(object.createdAt)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </>
      )}

      <ObjectRelations key={`relationships:${object.id}`} object={object} />

      {movingId === objectId && <NoteFolderMoveDialog object={object} onClose={() => setMovingId(null)} />}
    </article>
  )
}
