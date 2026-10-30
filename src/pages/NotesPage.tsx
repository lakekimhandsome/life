import { useState, type FormEvent } from 'react'
import { ChevronRight, Folder, FolderPlus, FolderX, Plus } from 'lucide-react'
import type { NoteFolder } from '../core/types'
import { Link, useSearchParams } from 'react-router-dom'
import { ObjectCard } from '../components/object/ObjectCard'
import { BackLink } from '../components/ui/BackLink'
import { FolderDialog } from '../components/ui/FolderDialog'
import { folderPath, notesUrl } from '../lib/noteFolders'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'
import { useNoteFolders } from '../state/useNoteFolders'

export function NotesPage() {
  const t = useT()
  const [params] = useSearchParams()
  const folderId = params.get('folder') || null
  const { ready, listByType, refresh } = useLife()
  const { folders, loading, error, createFolder, deleteFolder } = useNoteFolders()
  const [deleting, setDeleting] = useState<NoteFolder | null>(null)
  const [deleteError, setDeleteError] = useState(false)
  const [refreshError, setRefreshError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const current = folders.find((folder) => folder.id === folderId)
  const path = folderPath(folders, folderId)
  const children = folders.filter((folder) => folder.parent_id === folderId)
  const notes = listByType('note').filter((note) => (note.folderId ?? null) === folderId)
  const missing = Boolean(folderId && !current && !loading && !error)

  async function removeFolder() {
    if (!deleting || saving) return
    setSaving(true)
    setDeleteError(false)
    try {
      await deleteFolder(deleting.id)
      setDeleting(null)
      setRefreshError(false)
      try { await refresh() } catch { setRefreshError(true) }
    } catch { setDeleteError(true) }
    finally { setSaving(false) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setSaveError(false)
    try {
      await createFolder(name, folderId)
      setCreating(false)
      setName('')
    } catch { setSaveError(true) }
    finally { setSaving(false) }
  }

  return (
    <div className="module-page">
      <div className="module-header module-heading--notes">
        <BackLink to={folderId ? notesUrl(current?.parent_id) : '/'} />
        <div className="module-heading module-heading--notes">
          <h1 className="notes-path"><Link to="/notes">{t('modules.notes')}</Link><span>
            {path.map((folder) => <span key={folder.id}>{' / '}<Link to={notesUrl(folder.id)}>{folder.name}</Link></span>)}
          </span></h1>
        </div>
        <div className="module-header-actions">
          <Link to={`/create/note${folderId ? `?folder=${encodeURIComponent(folderId)}` : ''}`}
            className="module-header-btn" aria-label={t('module.addAria', { type: t('object.note') })}>
            <Plus size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <button type="button" className="module-header-btn" aria-label={t('folders.create')}
            disabled={loading || error || missing} onClick={() => { setSaveError(false); setCreating(true) }}>
            <FolderPlus size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
      {refreshError && <p role="alert">{t('folders.refreshFailed')}</p>}
      {!ready || loading ? <p className="empty-state">{t('common.loading')}</p>
        : error ? <p role="alert">{t('folders.failed')}</p>
        : missing ? <p className="empty-state">{t('folders.notFound')}</p>
        : <>
          {children.length > 0 || notes.length > 0 ? <div className="object-stream">
            {children.map((folder) => <div key={folder.id} className="object-row note-folder-item">
              <Link to={notesUrl(folder.id)} className="note-folder-link">
                <div className="object-row-main"><h3><Folder size={20} strokeWidth={1.75} aria-hidden="true" /><span>{folder.name}</span></h3></div>
                <ChevronRight className="object-row-arrow" size={18} strokeWidth={2} aria-hidden="true" />
              </Link>
              <button type="button" className="object-header-action note-folder-delete"
                aria-label={t('folders.deleteNamed', { name: folder.name })} title={t('folders.delete')}
                disabled={saving} onClick={() => { setDeleteError(false); setDeleting(folder) }}>
                <FolderX size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>)}
            {notes.map((note) => <ObjectCard key={note.id} object={note} />)}
          </div> : <div className="empty-panel">
            <h3>{t('module.emptyTitle')}</h3><p>{t('module.emptyBody', { type: t('object.note') })}</p>
          </div>}
        </>}
      {deleting && <FolderDialog title={t('folders.delete')} onClose={() => { if (!saving) setDeleting(null) }}>
        <p>{t('folders.deleteConfirm', { name: deleting.name,
          parent: current?.name ?? t('modules.notes') })}</p>
        {deleteError && <p role="alert">{t('folders.failed')}</p>}
        <div className="folder-dialog-actions">
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setDeleting(null)}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-danger" disabled={saving} onClick={() => void removeFolder()}>
            {t(saving ? 'common.deleting' : 'common.delete')}
          </button>
        </div>
      </FolderDialog>}
      {creating && <FolderDialog title={t('folders.create')} onClose={() => { if (!saving) setCreating(false) }}>
        <form onSubmit={(event) => void submit(event)}>
          <label className="folder-name-field">{t('folders.name')}<input autoFocus required maxLength={200}
            value={name} onChange={(event) => setName(event.target.value)} disabled={saving} /></label>
          {saveError && <p role="alert">{t('folders.failed')}</p>}
          <div className="folder-dialog-actions">
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setCreating(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn" disabled={saving || !name.trim()}>{t(saving ? 'common.saving' : 'common.add')}</button>
          </div>
        </form>
      </FolderDialog>}
    </div>
  )
}
