import { useRef, useState, type TouchList } from 'react'

type Point = { x: number; y: number }
type Zoom = { scale: number; x: number; y: number }
const initialZoom: Zoom = { scale: 1, x: 0, y: 0 }
const points = (touches: TouchList): Point[] => Array.from(touches, (touch) => ({ x: touch.clientX, y: touch.clientY }))
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function ZoomableImage({ src, alt, onSwipe }: { src: string; alt: string; onSwipe: (delta: number) => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const [zoom, setZoom] = useState(initialZoom)
  const current = useRef(initialZoom)
  const gesture = useRef<{ points: Point[]; zoom: Zoom; center: Point } | null>(null)
  const multiTouch = useRef(false)
  const suppressClick = useRef(false)

  function start(touches: TouchList) {
    const rect = stage.current!.getBoundingClientRect()
    gesture.current = { points: points(touches), zoom: current.current, center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } }
  }

  function update(next: Zoom) {
    const limitX = Math.max(0, (image.current!.offsetWidth * next.scale - stage.current!.clientWidth) / 2)
    const limitY = Math.max(0, (image.current!.offsetHeight * next.scale - stage.current!.clientHeight) / 2)
    current.current = { scale: next.scale, x: Math.max(-limitX, Math.min(limitX, next.x)), y: Math.max(-limitY, Math.min(limitY, next.y)) }
    setZoom(current.current)
  }

  return <div ref={stage} className="gallery-image-stage" data-zoom={zoom.scale}
    onTouchStart={(event) => {
      if (!gesture.current) { multiTouch.current = false; suppressClick.current = false }
      if (event.touches.length > 1) { multiTouch.current = true; suppressClick.current = true }
      start(event.touches)
    }}
    onTouchMove={(event) => {
      const before = gesture.current
      const after = points(event.touches)
      if (!before || before.points.length !== after.length) return
      if (after.length === 2) {
        const scale = Math.max(1, Math.min(5, before.zoom.scale * distance(after[0], after[1]) / Math.max(1, distance(before.points[0], before.points[1]))))
        const from = midpoint(before.points[0], before.points[1])
        const to = midpoint(after[0], after[1])
        const ratio = scale / before.zoom.scale
        update({ scale,
          x: to.x - before.center.x - (from.x - before.center.x - before.zoom.x) * ratio,
          y: to.y - before.center.y - (from.y - before.center.y - before.zoom.y) * ratio,
        })
      } else if (after.length === 1) {
        const dx = after[0].x - before.points[0].x
        const dy = after[0].y - before.points[0].y
        if (Math.hypot(dx, dy) > 8) suppressClick.current = true
        if (before.zoom.scale > 1) update({ scale: before.zoom.scale, x: before.zoom.x + dx, y: before.zoom.y + dy })
      }
    }}
    onTouchEnd={(event) => {
      const before = gesture.current
      if (event.touches.length) { start(event.touches); return }
      gesture.current = null
      if (!before || multiTouch.current || before.zoom.scale > 1 || before.points.length !== 1) return
      const end = event.changedTouches[0]
      const dx = end.clientX - before.points[0].x
      const dy = end.clientY - before.points[0].y
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.25) onSwipe(dx < 0 ? 1 : -1)
    }}
    onTouchCancel={() => { gesture.current = null; suppressClick.current = true }}
    onClickCapture={(event) => {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation() }
    }}>
    <img ref={image} src={src} alt={alt} draggable={false}
      style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }} />
  </div>
}
