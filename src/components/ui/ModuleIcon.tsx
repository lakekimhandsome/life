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

function StudyIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M4.5 6.25c2.1-1.1 4.35-1.65 7.5-1.65s5.4.55 7.5 1.65v11.1c-2.1-1.05-4.35-1.55-7.5-1.55s-5.4.5-7.5 1.55V6.25Z" {...stroke} />
      <path d="M12 4.6v11.2" {...stroke} />
    </IconShell>
  )
}

function WorkoutIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M7.25 9.25v5.5M16.75 9.25v5.5" {...stroke} />
      <path d="M5 10.5v3M19 10.5v3" {...stroke} />
      <path d="M7.25 12h9.5" {...stroke} />
      <path d="M5 10.5h2.25M16.75 10.5H19M5 13.5h2.25M16.75 13.5H19" {...stroke} />
    </IconShell>
  )
}

function AssetsIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="7.25" {...stroke} />
      <path d="M12 8.25v7.5M9.75 10.1c.45-.7 1.2-1.1 2.25-1.1 1.35 0 2.35.7 2.35 1.85S13.35 12.6 12 12.6s-2.35.55-2.35 1.85c0 1.15 1 1.85 2.35 1.85 1.05 0 1.8-.4 2.25-1.1" {...stroke} />
    </IconShell>
  )
}

function JournalIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M7.5 4.75h8.25a1.5 1.5 0 0 1 1.5 1.5v11.5a1.5 1.5 0 0 1-1.5 1.5H7.5a2 2 0 0 1-2-2V6.75a2 2 0 0 1 2-2Z" {...stroke} />
      <path d="M9.25 9h5.5M9.25 12h5.5M9.25 15h3.25" {...stroke} />
    </IconShell>
  )
}

function GoalsIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="7.25" {...stroke} />
      <circle cx="12" cy="12" r="3.75" {...stroke} />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </IconShell>
  )
}

function ProjectsIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M5.5 8.25h13v9.5a1.5 1.5 0 0 1-1.5 1.5h-10a1.5 1.5 0 0 1-1.5-1.5v-9.5Z" {...stroke} />
      <path d="M9 8.25V6.9A1.65 1.65 0 0 1 10.65 5.25h2.7A1.65 1.65 0 0 1 15 6.9v1.35" {...stroke} />
      <path d="M5.5 12h13" {...stroke} />
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
