import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { LifeObject } from '../core/types'
import {
  addLocalDays,
  formatDayHeading,
  isSameLocalDay,
  noonOnLocalDay,
  startOfLocalDay,
} from '../lib/format'
import { useLife } from '../state/LifeContext'

function isDone(object: LifeObject): boolean {
  return object.meta.done === true
}

export function StudyPage() {
  const { ready, listByType, createObject, updateObject, deleteObject } = useLife()
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay())
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const todos = useMemo(() => {
    const items = listByType('study').filter((object) =>
      isSameLocalDay(object.occurredAt, selectedDay),
    )
    return items.sort((a, b) => {
      const doneDelta = Number(isDone(a)) - Number(isDone(b))
      if (doneDelta !== 0) return doneDelta
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }, [listByType, selectedDay])

  const remaining = todos.filter((todo) => !isDone(todo)).length

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const title = draft.trim()
    if (!title || saving) return

    setSaving(true)
    try {
      await createObject({
        type: 'study',
        title,
        occurredAt: noonOnLocalDay(selectedDay),
        meta: { subject: '', done: false },
      })
      setDraft('')
    } finally {
      setSaving(false)
    }
  }

  async function toggleDone(todo: LifeObject) {
    await updateObject(todo.id, {
      meta: {
        ...todo.meta,
        done: !isDone(todo),
      },
    })
  }

  return (
    <div className="module-page study-page">
      <div className="module-header">
        <Link to="/" className="back-link">
          ← 홈
        </Link>
        <div className="module-heading">
          <span className="module-icon" aria-hidden="true">
            📚
          </span>
          <h1>공부</h1>
        </div>
      </div>

      <div className="day-nav" aria-label="날짜 선택">
        <button
          type="button"
          className="day-nav-btn"
          aria-label="이전 날짜"
          onClick={() => setSelectedDay((day) => addLocalDays(day, -1))}
        >
          ‹
        </button>
        <div className="day-nav-label">
          <strong>{formatDayHeading(selectedDay)}</strong>
          {ready && todos.length > 0 ? (
            <span>
              {remaining === 0 ? '모두 완료' : `${remaining}개 남음`}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="day-nav-btn"
          aria-label="다음 날짜"
          onClick={() => setSelectedDay((day) => addLocalDays(day, 1))}
        >
          ›
        </button>
      </div>

      {!isSameLocalDay(selectedDay, new Date()) ? (
        <button
          type="button"
          className="day-today-link"
          onClick={() => setSelectedDay(startOfLocalDay())}
        >
          오늘로 이동
        </button>
      ) : null}

      <form className="todo-composer" onSubmit={handleAdd}>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="할 일 추가"
          aria-label="할 일 추가"
          disabled={!ready || saving}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!ready || saving || !draft.trim()}
        >
          추가
        </button>
      </form>

      {!ready ? (
        <p className="empty-state">불러오는 중…</p>
      ) : todos.length === 0 ? (
        <div className="empty-panel todo-empty">
          <h3>할 일이 없습니다</h3>
          <p>위에서 오늘의 공부를 추가해 보세요.</p>
        </div>
      ) : (
        <ul className="todo-list">
          {todos.map((todo) => {
            const done = isDone(todo)
            return (
              <li key={todo.id} className={`todo-item${done ? ' is-done' : ''}`}>
                <label className="todo-check">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => void toggleDone(todo)}
                  />
                  <span className="todo-box" aria-hidden="true" />
                  <span className="todo-title">{todo.title}</span>
                </label>
                <button
                  type="button"
                  className="todo-delete"
                  aria-label={`${todo.title} 삭제`}
                  onClick={() => void deleteObject(todo.id)}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
