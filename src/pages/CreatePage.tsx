import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ObjectForm } from '../components/object/ObjectForm'
import { BackLink } from '../components/ui/BackLink'
import { OBJECT_TYPES, type ObjectType } from '../core/types'
import { getSchema } from '../domain/schemas'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'

function isObjectType(value: string | undefined): value is ObjectType {
  return !!value && (OBJECT_TYPES as readonly string[]).includes(value)
}

export function CreatePage() {
  const t = useT()
  const { type } = useParams()
  const navigate = useNavigate()
  const { createObject, linkObjects } = useLife()

  if (!isObjectType(type)) {
    return <Navigate to="/" replace />
  }

  const schema = getSchema(type)

  return (
    <div className="compose">
      <div className="compose-header">
        <BackLink to="/" />
        <p className="eyebrow" style={{ color: schema.accent }}>
          {schema.enLabel}
        </p>
        <h1>{t('create.heading', { type: schema.label })}</h1>
        {schema.description ? <p className="compose-lead">{schema.description}</p> : null}
      </div>

      <ObjectForm
        type={type}
        submitLabel={t('common.save')}
        onSubmit={async ({ title, body, occurredAt, meta, linkedGoalId }) => {
          const created = await createObject({
            type,
            title,
            body,
            occurredAt,
            meta,
          })
          if (linkedGoalId) {
            await linkObjects(created.id, linkedGoalId, 'supports')
          }
          navigate(`/object/${created.id}`)
        }}
      />
    </div>
  )
}
