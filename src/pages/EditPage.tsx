import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ObjectForm } from '../components/object/ObjectForm'
import { getSchema } from '../domain/schemas'
import { useLife } from '../state/LifeContext'

export function EditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ready, getObject, updateObject } = useLife()

  const object = id ? getObject(id) : undefined

  if (ready && id && !object) {
    return <Navigate to="/" replace />
  }

  if (!object) {
    return <p className="empty-state">불러오는 중…</p>
  }

  const schema = getSchema(object.type)

  return (
    <div className="compose">
      <div className="compose-header">
        <Link to={`/object/${object.id}`} className="back-link">
          ← 돌아가기
        </Link>
        <p className="eyebrow" style={{ color: schema.accent }}>
          {schema.label}
        </p>
        <h1>{schema.labelKo} 수정</h1>
        <p className="compose-lead">{schema.description}</p>
      </div>

      <ObjectForm
        type={object.type}
        initial={object}
        submitLabel="수정 저장"
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
