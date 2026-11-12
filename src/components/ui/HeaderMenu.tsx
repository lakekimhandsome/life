import { useEffect, useRef, type ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'

export function HeaderMenu({ label, children, alignStart = false }: {
  label: string
  children: ReactNode
  alignStart?: boolean
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      const menu = ref.current
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  return (
    <details
      ref={ref}
      className={`header-menu${alignStart ? ' header-menu--start' : ''}`}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !event.currentTarget.open) return
        event.currentTarget.open = false
        event.currentTarget.querySelector('summary')?.focus()
      }}
    >
      <summary className="module-header-btn" aria-label={label} title={label}>
        <Ellipsis size={22} aria-hidden="true" />
      </summary>
      <div className="header-menu-panel" onClick={(event) => {
        const action = event.target instanceof Element && event.target.closest('a, button:not(:disabled)')
        if (!action || action.parentElement !== event.currentTarget) return
        if (ref.current) ref.current.open = false
        ref.current?.querySelector('summary')?.focus()
      }}>
        {children}
      </div>
    </details>
  )
}
