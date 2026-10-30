import { useEffect, useState } from 'react'
import type { NoteFolder } from '../core/types'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export function useNoteFolders() {
  const { user } = useAuth()
  const userId = user?.id
  const [folders, setFolders] = useState<NoteFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    if (!userId) { setFolders([]); setLoading(false); return }
    void supabase.from('life_note_folders').select('id,name,parent_id')
      .eq('user_id', userId).order('name').then(({ data, error }) => {
        if (!active) return
        setFolders(data ?? [])
        setError(Boolean(error))
        setLoading(false)
      }, () => {
        if (active) { setError(true); setLoading(false) }
      })
    return () => { active = false }
  }, [userId])

  async function createFolder(name: string, parentId: string | null) {
    if (!user) throw new Error('Authentication required')
    const folder: NoteFolder = { id: crypto.randomUUID(), name: name.trim(), parent_id: parentId }
    const { error } = await supabase.from('life_note_folders').insert({ ...folder, user_id: user.id })
    if (error) throw error
    setFolders((items) => [...items, folder].sort((a, b) => a.name.localeCompare(b.name)))
  }
  return { folders, loading, error, createFolder }
}
