import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LifeMark } from '../components/ui/LifeMark'
import { MarkdownContent } from '../components/ui/MarkdownContent'
import { TypeBadge } from '../components/ui/TypeBadge'
import { getSharedObject } from '../core/repository'
import type { SharedLifeObject } from '../core/types'
import { formatMetaValue, getSchema } from '../domain/schemas'
import { formatDateTime } from '../lib/format'
import { useT } from '../state/LocaleContext'

export function SharedObjectPage() {
  const { token } = useParams()
  const t = useT()
  const [object, setObject] = useState<SharedLifeObject | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setFailed(false)

    getSharedObject(token ?? '')
      .then((next) => {
        if (active) setObject(next ?? null)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const previous = existing?.content
    const meta = existing ?? document.createElement('meta')
    if (!existing) {
      meta.name = 'robots'
      document.head.append(meta)
    }
    meta.content = 'noindex,nofollow'

    return () => {
      if (!existing) meta.remove()
      else meta.content = previous ?? ''
    }
  }, [])

  if (loading) {
    return <main className="shared-object-state">{t('common.loading')}</main>
  }

  if (failed) {
    return <main className="shared-object-state">{t('share.loadFailed')}</main>
  }

  if (!object) {
    return (
      <main className="shared-object-state">
        <LifeMark size={42} />
        <h1>{t('share.notFoundTitle')}</h1>
        <p>{t('share.notFoundBody')}</p>
      </main>
    )
  }

  const schema = getSchema(object.type)
  const fields = schema.fields.flatMap((field) => {
    const value = formatMetaValue(object.type, field.key, object.meta[field.key] ?? null)
    return value ? [{ key: field.key, label: field.label, value }] : []
  })

  return (
    <main className="shared-object-shell">
      <Link to="/" className="shared-object-brand" aria-label={t('nav.lifeHome')}>
        <LifeMark size={28} />
        <span>LIFE</span>
      </Link>

      <article className="detail shared-object">
        <header className="detail-header">
          <div className="detail-meta">
            <TypeBadge type={object.type} />
            <time dateTime={object.occurredAt}>{formatDateTime(object.occurredAt)}</time>
            <span>{t('share.readOnly')}</span>
          </div>
          <h1>{object.title}</h1>
        </header>

        {object.body ? (
          <section className="detail-body" aria-label={schema.bodyLabel}>
            <MarkdownContent className="markdown-content">{object.body}</MarkdownContent>
          </section>
        ) : null}

        {fields.length ? (
          <section className="detail-fields">
            <h2>{t('detail.fields')}</h2>
            <dl>
              {fields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <p className="shared-object-note">{t('share.unlistedHint')}</p>
      </article>
    </main>
  )
}
