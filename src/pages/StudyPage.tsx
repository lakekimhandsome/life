import { useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
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

const SWIPE_DELETE_THRESHOLD = 88

function isDone(object: LifeObject): boolean {
  return object.meta.done === true
}

function StudyTodoItem({
  todo,
  onToggle,
  onDelete,
}: {
  todo: LifeObject
  onToggle: () => void
  onDelete: () => void
}) {
  const done = isDone(todo)
  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef<'none' | 'x' | 'y'>('none')
  const dragging = useRef(false)
  const swiped = useRef(false)
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    dragging.current = true
    swiped.current = false
    axis.current = 'none'
    setAnimating(false)
    startX.current = event.clientX
    startY.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return

    const deltaX = event.clientX - startX.current
    const deltaY = event.clientY - startY.current

    if (axis.current === 'none') {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
      axis.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
      if (axis.current === 'y') return
    }

    if (axis.current !== 'x') return

    swiped.current = true
    setOffset(Math.max(-140, Math.min(0, deltaX)))
  }

  function finishSwipe(nextOffset: number) {
    dragging.current = false
    setAnimating(true)

    if (axis.current === 'x' && nextOffset <= -SWIPE_DELETE_THRESHOLD) {
      setOffset(-140)
      window.setTimeout(() => onDelete(), 140)
      return
    }

    setOffset(0)
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return
    finishSwipe(event.clientX - startX.current)
  }

  function onPointerCancel() {
    if (!dragging.current) return
    finishSwipe(0)
  }

  function onClick() {
    if (swiped.current) return
    onToggle()
  }

  return (
    <li className={`todo-item${done ? ' is-done' : ''}`}>
      <div className="todo-swipe-action" aria-hidden="true">
        삭제
      </div>
      <button
        type="button"
        className={`todo-check${animating ? ' is-animating' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        aria-pressed={done}
        aria-label={done ? `${todo.title} 완료 취소` : `${todo.title} 완료`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onClick}
      >
        <span className={`todo-box${done ? ' is-checked' : ''}`} aria-hidden="true" />
        <span className="todo-title">{todo.title}</span>
      </button>
    </li>
  )
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
          {todos.map((todo) => (
            <StudyTodoItem
              key={todo.id}
              todo={todo}
              onToggle={() => void toggleDone(todo)}
              onDelete={() => void deleteObject(todo.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
