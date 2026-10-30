import { useState, type FormEvent } from 'react'
import { Folder, FolderPlus, Plus } from 'lucide-react'
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
  const { ready, listByType } = useLife()
  const { folders, loading, error, createFolder } = useNoteFolders()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const current = folders.find((folder) => folder.id === folderId)
  const path = folderPath(folders, folderId)
  const children = folders.filter((folder) => folder.parent_id === folderId)
  const notes = listByType('note').filter((note) => (note.folderId ?? null) === folderId)
  const missing = Boolean(folderId && !current && !loading && !error)

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
            {path.map((folder) => <span key={folder.id}>/<Link to={notesUrl(folder.id)}>{folder.name}</Link></span>)}
          </span></h1>
        </div>
        <div className="module-header-actions">
          <button type="button" className="module-header-btn" aria-label={t('folders.create')}
            disabled={loading || error || missing} onClick={() => { setSaveError(false); setCreating(true) }}>
            <FolderPlus size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <Link to={`/create/note${folderId ? `?folder=${encodeURIComponent(folderId)}` : ''}`}
            className="module-header-btn" aria-label={t('module.addAria', { type: t('object.note') })}>
            <Plus size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      </div>
      {!ready || loading ? <p className="empty-state">{t('common.loading')}</p>
        : error ? <p role="alert">{t('folders.failed')}</p>
        : missing ? <p className="empty-state">{t('folders.notFound')}</p>
        : <>
          {children.length > 0 && <div className="note-folder-list">
            {children.map((folder) => <Link key={folder.id} to={notesUrl(folder.id)} className="note-folder-row">
              <Folder size={20} strokeWidth={1.75} aria-hidden="true" /><span>{folder.name}</span>
            </Link>)}
          </div>}
          {notes.length > 0 ? <div className="object-stream">
            {notes.map((note) => <ObjectCard key={note.id} object={note} />)}
          </div> : children.length === 0 && <div className="empty-panel">
            <h3>{t('module.emptyTitle')}</h3><p>{t('module.emptyBody', { type: t('object.note') })}</p>
          </div>}
        </>}
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
