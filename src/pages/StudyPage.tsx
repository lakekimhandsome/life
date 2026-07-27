import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { ModuleIcon } from '../components/ui/ModuleIcon'
import * as repository from '../core/repository'
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

function orderValue(object: LifeObject): number {
  return typeof object.meta.order === 'number' ? object.meta.order : Number.MAX_SAFE_INTEGER
}

function sortTodos(items: LifeObject[]): LifeObject[] {
  return [...items].sort((a, b) => {
    const orderDelta = orderValue(a) - orderValue(b)
    if (orderDelta !== 0) return orderDelta
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

function StudyTodoItem({
  todo,
  dragging,
  onToggle,
  onDelete,
  onRename,
  onReorderStart,
}: {
  todo: LifeObject
  dragging: boolean
  onToggle: () => void
  onDelete: () => void
  onRename: (title: string) => void
  onReorderStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const done = isDone(todo)
  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef<'none' | 'x' | 'y'>('none')
  const swiping = useRef(false)
  const swiped = useRef(false)
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(todo.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraftTitle(todo.title)
  }, [todo.title, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function onSwipePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || editing || dragging) return
    swiping.current = true
    swiped.current = false
    axis.current = 'none'
    setAnimating(false)
    startX.current = event.clientX
    startY.current = event.clientY
  }

  function onSwipePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!swiping.current) return

    const deltaX = event.clientX - startX.current
    const deltaY = event.clientY - startY.current

    if (axis.current === 'none') {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
      axis.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
      if (axis.current === 'y') {
        swiping.current = false
        return
      }
      swiped.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    if (axis.current !== 'x') return
    setOffset(Math.max(-140, Math.min(0, deltaX)))
  }

  function finishSwipe(nextOffset: number) {
    if (!swiping.current && axis.current !== 'x') {
      swiping.current = false
      return
    }
    swiping.current = false
    setAnimating(true)

    if (axis.current === 'x' && nextOffset <= -SWIPE_DELETE_THRESHOLD) {
      setOffset(-140)
      window.setTimeout(() => {
        const confirmed = window.confirm(`「${todo.title}」 할 일을 삭제할까요?`)
        if (!confirmed) {
          setAnimating(true)
          setOffset(0)
          return
        }
        onDelete()
      }, 140)
      return
    }

    setOffset(0)
  }

  function onSwipePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (axis.current === 'x') {
      finishSwipe(event.clientX - startX.current)
      return
    }
    swiping.current = false
  }

  function onSwipePointerCancel() {
    if (axis.current === 'x') {
      finishSwipe(0)
      return
    }
    swiping.current = false
  }

  function commitEdit() {
    const next = draftTitle.trim()
    setEditing(false)
    if (!next || next === todo.title) {
      setDraftTitle(todo.title)
      return
    }
    onRename(next)
  }

  return (
    <li
      className={`todo-item${done ? ' is-done' : ''}${dragging ? ' is-dragging' : ''}`}
      data-todo-id={todo.id}
    >
      <div
        className={`todo-swipe-track${animating ? ' is-animating' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onSwipePointerDown}
        onPointerMove={onSwipePointerMove}
        onPointerUp={onSwipePointerUp}
        onPointerCancel={onSwipePointerCancel}
      >
        <div className="todo-row">
          <button
            type="button"
            className="todo-toggle"
            aria-pressed={done}
            aria-label={done ? `${todo.title} 완료 취소` : `${todo.title} 완료`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
          >
            <span className={`todo-box${done ? ' is-checked' : ''}`} aria-hidden="true" />
          </button>

          {editing ? (
            <input
              ref={inputRef}
              className="todo-title-input"
              value={draftTitle}
              aria-label="할 일 수정"
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={commitEdit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitEdit()
                }
                if (event.key === 'Escape') {
                  setDraftTitle(todo.title)
                  setEditing(false)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="todo-title"
              onClick={() => {
                if (swiped.current) return
                setEditing(true)
              }}
            >
              {todo.title}
            </button>
          )}

          <button
            type="button"
            className="todo-handle"
            aria-label={`${todo.title} 순서 변경`}
            onPointerDown={(event) => {
              event.stopPropagation()
              onReorderStart(event)
            }}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
        <div className="todo-swipe-action" aria-hidden="true">
          삭제
        </div>
      </div>
    </li>
  )
}

export function StudyPage() {
  const { ready, listByType, createObject, updateObject, deleteObject, refresh } = useLife()
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay())
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<LifeObject[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const itemsRef = useRef<LifeObject[]>([])
  const dragOrigin = useRef<LifeObject[] | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const sourceTodos = useMemo(() => {
    const dayItems = listByType('study').filter((object) =>
      isSameLocalDay(object.occurredAt, selectedDay),
    )
    return sortTodos(dayItems)
  }, [listByType, selectedDay])

  useEffect(() => {
    if (dragId) return
    setItems(sourceTodos)
  }, [sourceTodos, dragId])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const remaining = items.filter((todo) => !isDone(todo)).length

  async function persistOrder(next: LifeObject[]) {
    await Promise.all(
      next.map((todo, index) =>
        repository.updateObject(todo.id, {
          meta: { ...todo.meta, order: index },
        }),
      ),
    )
    await refresh()
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const title = draft.trim()
    if (!title || saving) return

    const nextOrder =
      items.reduce((max, todo) => {
        const value = typeof todo.meta.order === 'number' ? todo.meta.order : -1
        return Math.max(max, value)
      }, -1) + 1

    setSaving(true)
    try {
      await createObject({
        type: 'study',
        title,
        occurredAt: noonOnLocalDay(selectedDay),
        meta: { subject: '', done: false, order: nextOrder },
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

  async function renameTodo(todo: LifeObject, title: string) {
    await updateObject(todo.id, { title })
  }

  function moveDraggedToIndex(nextIndex: number) {
    const id = dragIdRef.current
    if (!id) return
    setItems((current) => {
      const fromIndex = current.findIndex((todo) => todo.id === id)
      if (fromIndex < 0 || fromIndex === nextIndex) return current
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(nextIndex, 0, moved)
      return next
    })
  }

  function onReorderStart(todoId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    event.preventDefault()

    dragOrigin.current = itemsRef.current
    dragIdRef.current = todoId
    setDragId(todoId)

    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)

    const onMove = (moveEvent: PointerEvent) => {
      const list = listRef.current
      if (!list) return
      const rows = [...list.querySelectorAll<HTMLElement>('[data-todo-id]')]
      const y = moveEvent.clientY
      let targetIndex = rows.length - 1
      for (let index = 0; index < rows.length; index += 1) {
        const rect = rows[index].getBoundingClientRect()
        if (y < rect.top + rect.height / 2) {
          targetIndex = index
          break
        }
      }
      moveDraggedToIndex(targetIndex)
    }

    const finish = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', finish)
      handle.removeEventListener('pointercancel', finish)

      const current = itemsRef.current
      const origin = dragOrigin.current
      dragOrigin.current = null
      dragIdRef.current = null
      setDragId(null)

      const changed =
        !origin ||
        origin.length !== current.length ||
        origin.some((todo, index) => todo.id !== current[index]?.id)

      if (changed) void persistOrder(current)
    }

    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', finish)
    handle.addEventListener('pointercancel', finish)
  }

  return (
    <div className="module-page study-page">
      <div className="module-header">
        <Link to="/" className="back-link">
          ← 홈
        </Link>
        <div className="module-heading module-heading--study">
          <span className="module-icon" aria-hidden="true">
            <ModuleIcon id="study" />
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
          {ready && items.length > 0 ? (
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
      ) : items.length === 0 ? (
        <div className="empty-panel todo-empty">
          <h3>할 일이 없습니다</h3>
          <p>위에서 오늘의 공부를 추가해 보세요.</p>
        </div>
      ) : (
        <ul className="todo-list" ref={listRef}>
          {items.map((todo) => (
            <StudyTodoItem
              key={todo.id}
              todo={todo}
              dragging={dragId === todo.id}
              onToggle={() => void toggleDone(todo)}
              onDelete={() => void deleteObject(todo.id)}
              onRename={(title) => void renameTodo(todo, title)}
              onReorderStart={(event) => onReorderStart(todo.id, event)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
