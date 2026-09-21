import { useEffect, useState, type FormEvent } from 'react'
import { Link2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LifeObject, Relationship } from '../../core/types'
import { getSchema } from '../../domain/schemas'
import { useLife } from '../../state/LifeContext'
import { useT } from '../../state/LocaleContext'
import { TypeBadge } from '../ui/TypeBadge'

export function ObjectRelations({ object }: { object: LifeObject }) {
  const { objects, getObject, getRelationships, linkObjects } = useLife()
  const t = useT()
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [loaded, setLoaded] = useState(false)
  const [targetId, setTargetId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<'load' | 'save' | null>(null)

  useEffect(() => {
    let active = true
    getRelationships(object.id).then((next) => {
      if (!active) return
      setRelationships(next)
      setLoaded(true)
    }).catch(() => {
      if (active) setError('load')
    })
    return () => { active = false }
  }, [object.id, getRelationships])

  const linkedIds = new Set(relationships.flatMap((rel) => [rel.sourceId, rel.targetId]))
  const candidates = objects.filter((other) => other.type !== 'plan' && other.id !== object.id && !linkedIds.has(other.id))

  async function handleLink(event: FormEvent) {
    event.preventDefault()
    const target = candidates.find((other) => other.id === targetId)
    if (!loaded || saving || !target) return
    setSaving(true)
    setError(null)
    try {
      const relationship = await linkObjects(object.id, target.id, target.type === 'goal' ? 'supports' : 'related')
      setRelationships((previous) => [relationship, ...previous])
      setTargetId('')
    } catch {
      setError('save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="detail-relations">
      <h2>{t('detail.links')}</h2>
      {!loaded && !error ? <p className="muted">{t('common.loading')}</p> : null}
      {loaded && relationships.length === 0 ? <p className="muted">{t('detail.noLinks')}</p> : null}
      <ul className="relation-list">
        {relationships.map((rel) => {
          const other = getObject(rel.sourceId === object.id ? rel.targetId : rel.sourceId)
          return other ? (
            <li key={rel.id}>
              <Link to={`/object/${other.id}`}>
                <TypeBadge type={other.type} />
                <span>{other.title}</span>
                <em>{rel.kind}</em>
              </Link>
            </li>
          ) : null
        })}
      </ul>
      {loaded ? candidates.length > 0 ? (
        <form className="object-form" onSubmit={handleLink}>
          <div className="field">
            <label htmlFor="related-object">{t('detail.linkObject')}</label>
            <select id="related-object" value={targetId} disabled={saving} onChange={(event) => setTargetId(event.target.value)}>
              <option value="">{t('detail.selectObject')}</option>
              {candidates.map((other) => (
                <option key={other.id} value={other.id}>{getSchema(other.type).label} · {other.title}</option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="object-header-action"
              disabled={!targetId || saving}
              aria-label={saving ? t('common.saving') : t('detail.addLink')}
              title={saving ? t('common.saving') : t('detail.addLink')}
              aria-busy={saving}
            >
              <Link2 size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : <p className="muted">{t('detail.noCandidates')}</p> : null}
      {error ? <p className="form-error" role="alert">{t(error === 'load' ? 'detail.loadLinksError' : 'detail.linkError')}</p> : null}
    </section>
  )
}
