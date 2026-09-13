import { useState } from 'react'
import { Save } from 'lucide-react'
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
  const [saving, setSaving] = useState(false)

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
          <div className="object-header-actions">
            <button
              type="submit"
              form="edit-object-form"
              className="object-header-action"
              disabled={saving}
              aria-label={saving ? t('common.saving') : t('edit.save')}
            >
              <Save size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
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
        formId="edit-object-form"
        showSubmitButton={false}
        onSavingChange={setSaving}
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
