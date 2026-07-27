import type { ReactNode } from 'react'
import type { ModuleId } from '../../domain/modules'

const SIZE = 24

function IconShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <svg
      className={className}
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** 펼친 책 */
function StudyIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
        {...stroke}
      />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"
        {...stroke}
      />
      <path d="M8 7h8M8 11h6" {...stroke} />
    </IconShell>
  )
}

/** 덤벨 */
function WorkoutIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M6.5 6.5v11M17.5 6.5v11" {...stroke} />
      <path d="M4 9v6M20 9v6" {...stroke} />
      <path d="M6.5 12h11" {...stroke} />
      <path d="M4 9h2.5M17.5 9H20M4 15h2.5M17.5 15H20" {...stroke} />
    </IconShell>
  )
}

/** 코인 */
function AssetsIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="7.25" {...stroke} />
      <path
        d="M12 8v8M14.2 9.7c-.5-.7-1.25-1-2.2-1-1.45 0-2.45.85-2.45 2.05 0 1.15.85 1.75 2.35 2.05l.5.1c1.35.3 2.1.75 2.1 1.85 0 1.15-1 2-2.5 2-.95 0-1.75-.3-2.3-1"
        {...stroke}
      />
    </IconShell>
  )
}

/** 노트 */
function JournalIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path
        d="M8 3.75h9.25A1.75 1.75 0 0 1 19 5.5v13a1.75 1.75 0 0 1-1.75 1.75H8A2.25 2.25 0 0 1 5.75 18V6A2.25 2.25 0 0 1 8 3.75Z"
        {...stroke}
      />
      <path d="M5.75 8H8M5.75 12H8M5.75 16H8" {...stroke} />
      <path d="M10.5 9h5M10.5 12.5h5M10.5 16h3" {...stroke} />
    </IconShell>
  )
}

/** 타깃 */
function GoalsIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="7.25" {...stroke} />
      <circle cx="12" cy="12" r="4" {...stroke} />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
    </IconShell>
  )
}

/** 폴더 */
function ProjectsIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path
        d="M3.75 8.25A1.75 1.75 0 0 1 5.5 6.5h3.1l1.4 1.75H18.5A1.75 1.75 0 0 1 20.25 10v7.25A1.75 1.75 0 0 1 18.5 19H5.5A1.75 1.75 0 0 1 3.75 17.25V8.25Z"
        {...stroke}
      />
    </IconShell>
  )
}

const ICONS: Record<ModuleId, (props: { className?: string }) => ReactNode> = {
  study: StudyIcon,
  workout: WorkoutIcon,
  assets: AssetsIcon,
  journal: JournalIcon,
  goals: GoalsIcon,
  projects: ProjectsIcon,
}

export function ModuleIcon({
  id,
  className,
}: {
  id: ModuleId
  className?: string
}) {
  const Icon = ICONS[id]
  return <Icon className={className} />
}
