import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ObjectForm } from '../components/object/ObjectForm'
import { BackLink } from '../components/ui/BackLink'
import { OBJECT_TYPES, type ObjectType } from '../core/types'
import { getSchema } from '../domain/schemas'
import { useLife } from '../state/LifeContext'

function isObjectType(value: string | undefined): value is ObjectType {
  return !!value && (OBJECT_TYPES as readonly string[]).includes(value)
}

export function CreatePage() {
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
        <BackLink to="/">홈</BackLink>
        <p className="eyebrow" style={{ color: schema.accent }}>
          {schema.label}
        </p>
        <h1>{schema.labelKo} 기록</h1>
        <p className="compose-lead">{schema.description}</p>
      </div>

      <ObjectForm
        type={type}
        submitLabel="저장"
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
