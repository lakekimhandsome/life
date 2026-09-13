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

  const height = draggedRow.getBoundingClientRect().height
  const centers = rows.map((row) => {
    const rect = row.getBoundingClientRect()
    return rect.top + rect.height / 2
  })
  let targetIndex = draggedIndex

  const resetTransforms = () => {
    rows.forEach((row) => {
      row.style.transform = ''
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

    rows.forEach((row, index) => {
      let offset = 0
      if (index === draggedIndex) offset = event.clientY - startY
      else if (draggedIndex < index && index <= targetIndex) offset = -height
      else if (targetIndex <= index && index < draggedIndex) offset = height
      row.style.transform = `translate3d(0, ${offset}px, 0)`
    })
  }

  const finish = (event: PointerEvent) => {
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', finish)
    handle.removeEventListener('pointercancel', finish)
    resetTransforms()
    onDrop(event.type === 'pointercancel' ? draggedIndex : targetIndex)
  }

  handle.setPointerCapture(pointerId)
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', finish)
  handle.addEventListener('pointercancel', finish)
}
