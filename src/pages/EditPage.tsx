import { useState } from 'react'
import { Check } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ObjectForm } from '../components/object/ObjectForm'
import { BackLink } from '../components/ui/BackLink'
import { getSchema } from '../domain/schemas'
import { useLife } from '../state/LifeContext'

export function EditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ready, getObject, updateObject } = useLife()
  const [saving, setSaving] = useState(false)

  const object = id ? getObject(id) : undefined

  if (ready && id && !object) {
    return <Navigate to="/" replace />
  }

  if (!object) {
    return <p className="empty-state">불러오는 중…</p>
  }

  const schema = getSchema(object.type)
  const usesHeaderSubmit =
    object.type === 'journal' || object.type === 'goal' || object.type === 'project'
  const formId = usesHeaderSubmit ? 'object-edit-form' : undefined

  return (
    <div className="compose">
      <div className="compose-header">
        <div className="object-page-toolbar">
          <BackLink to={`/object/${object.id}`}>돌아가기</BackLink>
          {usesHeaderSubmit ? (
            <button
              type="submit"
              form={formId}
              className="object-header-action"
              aria-label={`${schema.labelKo} 수정 저장`}
              disabled={saving}
            >
              <Check size={22} strokeWidth={1.9} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <p className="eyebrow" style={{ color: schema.accent }}>
          {schema.label}
        </p>
        <h1>{schema.labelKo} 수정</h1>
        <p className="compose-lead">{schema.description}</p>
      </div>

      <ObjectForm
        type={object.type}
        initial={object}
        formId={formId}
        showSubmitButton={!usesHeaderSubmit}
        onSavingChange={setSaving}
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
