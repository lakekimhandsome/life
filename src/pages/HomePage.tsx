import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ObjectCard } from '../components/object/ObjectCard'
import { CREATE_ORDER, getSchema } from '../domain/schemas'
import { useLife } from '../state/LifeContext'

export function HomePage() {
  const { ready, objects, counts } = useLife()

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <p className="brand-hero">LIFE</p>
          <h1>한 곳에서 삶을 운영하다</h1>
          <p className="hero-lead">
            일기, 프로젝트, 운동, 공부, 목표 — 따로 놀지 않는 하나의 시스템.
          </p>
          <div className="hero-actions">
            <Link to="/create/journal" className="btn btn-primary">
              기록 시작
            </Link>
            <a href="#timeline" className="btn btn-ghost">
              최근 기록 보기
            </a>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit">
            {CREATE_ORDER.map((type, index) => (
              <span
                key={type}
                className="orbit-node"
                style={
                  {
                    '--i': index,
                    '--node-accent': getSchema(type).accent,
                  } as CSSProperties
                }
              >
                {getSchema(type).labelKo}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="pulse" aria-label="기록 현황">
        {CREATE_ORDER.map((type) => {
          const schema = getSchema(type)
          return (
            <Link
              key={type}
              to={`/create/${type}`}
              className="pulse-item"
              style={{ '--pulse-accent': schema.accent } as CSSProperties}
            >
              <span className="pulse-label">{schema.labelKo}</span>
              <strong>{ready ? counts[type] : '—'}</strong>
            </Link>
          )
        })}
      </section>

      <section id="timeline" className="timeline">
        <div className="section-heading">
          <h2>삶의 흐름</h2>
          <p>모든 기록이 하나의 타임라인으로 모입니다.</p>
        </div>

        {!ready ? (
          <p className="empty-state">불러오는 중…</p>
        ) : objects.length === 0 ? (
          <div className="empty-panel">
            <h3>아직 기록이 없습니다</h3>
            <p>첫 일기를 쓰거나, 목표를 하나 세워 보세요.</p>
            <div className="hero-actions">
              <Link to="/create/journal" className="btn btn-primary">
                일기 쓰기
              </Link>
              <Link to="/create/goal" className="btn btn-ghost">
                목표 만들기
              </Link>
            </div>
          </div>
        ) : (
          <div className="object-stream">
            {objects.map((object) => (
              <ObjectCard key={object.id} object={object} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
