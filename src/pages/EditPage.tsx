import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ObjectForm } from '../components/object/ObjectForm'
import { BackLink } from '../components/ui/BackLink'
import { getSchema, supportsMarkdownBody } from '../domain/schemas'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'

export function EditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ready, getObject, updateObject } = useLife()

  const t = useT()
  const object = id ? getObject(id) : undefined

  if (ready && id && !object) {
    return <Navigate to="/" replace />
  }

  if (!object) {
    return <p className="empty-state">{t('common.loading')}</p>
  }

  if (supportsMarkdownBody(object.type)) {
    return <Navigate to={`/object/${object.id}`} replace />
  }

  const schema = getSchema(object.type)

  return (
    <div className="compose">
      <div className="compose-header">
        <div className="object-page-toolbar">
          <BackLink to={`/object/${object.id}`} />
        </div>
        <p className="eyebrow" style={{ color: schema.accent }}>
          {schema.enLabel}
        </p>
        <h1>{t('edit.heading', { type: schema.label })}</h1>
        {schema.description ? <p className="compose-lead">{schema.description}</p> : null}
      </div>

      <ObjectForm
        type={object.type}
        initial={object}
        submitLabel={t('edit.save')}
        onSubmit={async ({ title, body, occurredAt, meta }) => {
          await updateObject(object.id, {
            title,
            body,
            occurredAt,
            meta,
          })
          navigate(`/object/${object.id}`)
        }}
      />
    </div>
  )
}
