import { flushSync } from 'react-dom'

type VerticalReorderOptions = {
  handle: HTMLElement
  pointerId: number
  startY: number
  rows: HTMLElement[]
  draggedIndex: number
  onDrop: (nextIndex: number) => void
}

export function startVerticalReorder({
  handle,
  pointerId,
  startY,
  rows,
  draggedIndex,
  onDrop,
}: VerticalReorderOptions) {
  const draggedRow = rows[draggedIndex]
  if (!draggedRow) return

  const rects = rows.map((row) => row.getBoundingClientRect())
  const draggedRect = rects[draggedIndex]
  const height = draggedRect.height
  const gap = rows.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0
  const displacedOffset = height + gap
  const centers = rects.map((rect) => rect.top + rect.height / 2)
  let targetIndex = draggedIndex

  const moveRows = (dragOffset: number) => {
    rows.forEach((row, index) => {
      let offset = 0
      if (index === draggedIndex) offset = dragOffset
      else if (draggedIndex < index && index <= targetIndex) offset = -displacedOffset
      else if (targetIndex <= index && index < draggedIndex) offset = displacedOffset
      row.style.transform = `translate3d(0, ${offset}px, 0)`
    })
  }

  const onMove = (event: PointerEvent) => {
    targetIndex = rows.length - 1
    for (let index = 0; index < rows.length; index += 1) {
      if (index === draggedIndex) continue
      if (event.clientY < centers[index]) {
        targetIndex = index > draggedIndex ? index - 1 : index
        break
      }
    }
    moveRows(event.clientY - startY)
  }

  const finish = (event: PointerEvent) => {
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', finish)
    handle.removeEventListener('pointercancel', finish)

    if (event.type === 'pointercancel') targetIndex = draggedIndex
    const destinationTop =
      targetIndex < draggedIndex
        ? rects[targetIndex].top
        : targetIndex > draggedIndex
          ? rects[targetIndex].bottom - height
          : draggedRect.top

    draggedRow.style.transition = 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1)'
    moveRows(destinationTop - draggedRect.top)

    window.setTimeout(() => {
      rows.forEach((row) => {
        row.style.transition = 'none'
        row.style.transform = ''
      })
      flushSync(() => onDrop(targetIndex))
      window.requestAnimationFrame(() => {
        rows.forEach((row) => {
          row.style.transition = ''
        })
      })
    }, 160)
  }

  handle.setPointerCapture(pointerId)
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', finish)
  handle.addEventListener('pointercancel', finish)
}
