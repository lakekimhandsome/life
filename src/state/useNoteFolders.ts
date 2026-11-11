import { useEffect, useState } from 'react'
import type { NoteFolder } from '../core/types'
import { supabase } from '../lib/supabase'
import { useLife } from './LifeContext'
import { useAuth } from './AuthContext'

export function useNoteFolders() {
  const { user } = useAuth()
  const { dataRevision } = useLife()
  const userId = user?.id
  const [result, setResult] = useState<{ userId: string; folders: NoteFolder[] | null }>()
  const current = result?.userId === userId ? result : undefined
  useEffect(() => {
    if (!userId) return
    let active = true
    const loadFailed = () => {
      if (!active) return
      setResult((previous) => previous?.userId === userId && previous.folders
        ? previous : { userId, folders: null })
    }
    void supabase.from('life_note_folders').select('id,name,parent_id')
      .eq('user_id', userId).order('name').then(({ data, error }) => {
        if (!active) return
        if (error) loadFailed()
        else setResult({ userId, folders: data ?? [] })
      }, loadFailed)
    return () => { active = false }
  }, [userId, dataRevision])

  async function createFolder(name: string, parentId: string | null) {
    if (!user) throw new Error('Authentication required')
    const folder: NoteFolder = { id: crypto.randomUUID(), name: name.trim(), parent_id: parentId }
    const { error } = await supabase.from('life_note_folders').insert({ ...folder, user_id: user.id })
    if (error) throw error
    setResult((previous) => previous?.userId === user.id && previous.folders ? {
      ...previous,
      folders: [...previous.folders.filter((item) => item.id !== folder.id), folder]
        .sort((a, b) => a.name.localeCompare(b.name)),
    } : previous)
  }
  async function deleteFolder(id: string) {
    if (!user) throw new Error('Authentication required')
    const { data: parentId, error } = await supabase.rpc('delete_life_note_folder', { target_id: id })
    if (error) throw error
    setResult((previous) => previous?.userId === user.id && previous.folders ? {
      ...previous,
      folders: previous.folders.filter((folder) => folder.id !== id)
        .map((folder) => folder.parent_id === id ? { ...folder, parent_id: parentId } : folder),
    } : previous)
  }
  return {
    folders: current?.folders ?? [],
    loading: Boolean(userId && !current),
    error: current?.folders === null,
    createFolder,
    deleteFolder,
  }
}
