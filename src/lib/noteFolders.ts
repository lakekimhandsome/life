import type { NoteFolder } from '../core/types'

export function notesUrl(folderId?: string | null): string {
  return folderId ? `/notes?folder=${encodeURIComponent(folderId)}` : '/notes'
}

export function folderPath(folders: NoteFolder[], folderId?: string | null): NoteFolder[] {
  const path: NoteFolder[] = []
  const visited = new Set<string>()
  let current = folderId
  while (current && !visited.has(current)) {
    visited.add(current)
    const folder = folders.find((item) => item.id === current)
    if (!folder) break
    path.unshift(folder)
    current = folder.parent_id
  }
  return path
}
