import {
  BookOpen,
  Wallet,
  Dumbbell,
  Folder,
  Notebook,
  Target,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleId } from '../../domain/modules'

const ICONS: Record<ModuleId, LucideIcon> = {
  study: BookOpen,
  workout: Dumbbell,
  assets: Wallet,
  journal: Notebook,
  goals: Target,
  projects: Folder,
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
