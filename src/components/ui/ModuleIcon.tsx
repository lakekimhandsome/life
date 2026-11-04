import {
  ListTodo,
  Clipboard,
  Wallet,
  FolderKanban,
  Notebook,
  StickyNote,
  Target,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleId } from '../../domain/modules'

const ICONS: Record<ModuleId, LucideIcon> = {
  plans: ListTodo,
  assets: Wallet,
  journal: Notebook,
  goals: Target,
  projects: FolderKanban,
  notes: StickyNote,
  clipboard: Clipboard,
}

export function ModuleIcon({
  id,
  className,
}: {
  id: ModuleId
  className?: string
}) {
  const Icon = ICONS[id]
  return <Icon className={className} size={24} strokeWidth={1.5} aria-hidden="true" />
}
