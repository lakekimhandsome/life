import { useState } from 'react'
import { ArrowUp, Check, ChevronRight, Folder, FolderInput } from 'lucide-react'
import type { LifeObject } from '../../core/types'
import { folderPath } from '../../lib/noteFolders'
import { useLife } from '../../state/LifeContext'
import { useT } from '../../state/LocaleContext'
import { useNoteFolders } from '../../state/useNoteFolders'
import { FolderDialog } from '../ui/FolderDialog'

function MoveDialog({ object, onClose }: { object: LifeObject; onClose: () => void }) {
  const t = useT()
  const { updateObject } = useLife()
  const { folders, loading, error } = useNoteFolders()
  const [location, setLocation] = useState<string | null>(object.folderId ?? null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const current = folders.find((folder) => folder.id === location)
  const path = folderPath(folders, location)
  const children = folders.filter((folder) => folder.parent_id === location)
  const same = location === (object.folderId ?? null)
  async function move() {
    setSaving(true)
    setFailed(false)
    try {
      const updated = await updateObject(object.id, { folderId: location })
      if (!updated) throw new Error('Note not found')
      onClose()
    } catch { setFailed(true) }
    finally { setSaving(false) }
  }
  return <FolderDialog title={t('folders.move')} onClose={() => { if (!saving) onClose() }}>
    <nav className="folder-picker-path" aria-label={t('folders.move')}>
      <button type="button" disabled={saving} onClick={() => setLocation(null)}>{t('modules.notes')}</button>
      {path.map((folder) => <span key={folder.id}>/<button type="button" disabled={saving}
        onClick={() => setLocation(folder.id)}>{folder.name}</button></span>)}
    </nav>
    {loading ? <p>{t('common.loading')}</p> : error ? <p role="alert">{t('folders.failed')}</p> : <>
      <div className="folder-picker-list">
        {location && <button type="button" className="note-folder-row" disabled={saving}
          onClick={() => setLocation(current?.parent_id ?? null)}><ArrowUp size={18} />{t('folders.up')}</button>}
        {children.map((folder) => <button type="button" key={folder.id} className="note-folder-row" disabled={saving}
          onClick={() => setLocation(folder.id)}><Folder size={20} /><span>{folder.name}</span><ChevronRight size={18} /></button>)}
        {children.length === 0 && <p className="folder-picker-empty">{t('folders.empty')}</p>}
      </div>
      {failed && <p role="alert">{t('folders.failed')}</p>}
      <div className="folder-dialog-actions"><button type="button" className="btn btn-ghost" disabled={saving} onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="btn" disabled={saving || same || Boolean(location && !current)} onClick={() => void move()}>
          {same && <Check size={16} />}{t(saving ? 'common.saving' : 'folders.moveHere')}
        </button></div>
    </>}
  </FolderDialog>
}

export function NoteFolderControl({ object }: { object: LifeObject }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="object-header-action" aria-label={t('folders.move')}
      title={t('folders.move')} onClick={() => setOpen(true)}><FolderInput size={20} strokeWidth={1.75} aria-hidden="true" /></button>
    {open && <MoveDialog object={object} onClose={() => setOpen(false)} />}
  </>
}
