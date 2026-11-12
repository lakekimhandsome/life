import { useState, type FormEvent } from 'react'
import { ChevronRight, Folder, FolderPlus, Plus } from 'lucide-react'
import type { NoteFolder } from '../core/types'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ObjectCard } from '../components/object/ObjectCard'
import { BackLink } from '../components/ui/BackLink'
import { FolderDialog } from '../components/ui/FolderDialog'
import { HeaderMenu } from '../components/ui/HeaderMenu'
import { SavingIcon } from '../components/ui/SaveStatus'
import { folderPath, notesUrl } from '../lib/noteFolders'
import { comparePinnedObjects } from '../lib/pinnedObjects'
import { useLife } from '../state/LifeContext'
import { useT } from '../state/LocaleContext'
import { useNoteFolders } from '../state/useNoteFolders'

export function NotesPage() {
  const t = useT()
  const navigate = useNavigate()
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
  const ancestors = path.slice(0, -1)
  const children = folders.filter((folder) => folder.parent_id === folderId)
  const allNotes = listByType('note')
  const notes = allNotes.filter((note) => (note.folderId ?? null) === folderId)
  const missing = Boolean(folderId && !current && !loading && !error)

  async function removeFolder() {
    if (!deleting || saving) return
    setSaving(true)
    setDeleteError(false)
    try {
      await deleteFolder(deleting.id)
      navigate(notesUrl(deleting.parent_id))
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

  function openCreateFolder() {
    setSaveError(false)
    setCreating(true)
  }

  return (
    <div className="module-page">
      <div className="module-header module-heading--notes">
        <BackLink to={folderId ? notesUrl(current?.parent_id) : '/'} />
        <div className={`module-heading notes-path${ancestors.length > 0 ? ' notes-path--deep' : ''}`}>
          {current && <>
            <Link className="notes-path-root" to="/notes">{t('modules.notes')}</Link>
            <span className="notes-path-root" aria-hidden="true">/</span>
            {ancestors.length > 0 && <>
              <HeaderMenu alignStart orientation="horizontal" label={t('folders.ancestors')}>
                <Link className="notes-path-root-compact" to="/notes">{t('modules.notes')}</Link>
                {ancestors.map((folder) => <Link key={folder.id} to={notesUrl(folder.id)}>{folder.name}</Link>)}
              </HeaderMenu>
              <span aria-hidden="true">/</span>
            </>}
          </>}
          <h1 title={current?.name}>{current?.name ?? t('modules.notes')}</h1>
        </div>
        <div className="module-header-actions">
          <Link to={`/create/note${folderId ? `?folder=${encodeURIComponent(folderId)}` : ''}`}
            className="module-header-btn" aria-label={t('module.addAria', { type: t('object.note') })}>
            <Plus size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <button type="button" className={`module-header-btn${current ? ' notes-folder-create' : ''}`} aria-label={t('folders.create')}
            disabled={loading || error || missing} onClick={openCreateFolder}>
            <FolderPlus size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {current && <HeaderMenu label={t('common.moreActions')}>
            <button type="button" className="notes-folder-create-compact" disabled={loading || error} onClick={openCreateFolder}>
              {t('folders.create')}
            </button>
            <button type="button" className="header-menu-danger" aria-label={t('folders.deleteNamed', { name: current.name })}
              disabled={saving || loading || error} onClick={() => { setDeleteError(false); setDeleting(current) }}>
              {t('folders.delete')}
            </button>
          </HeaderMenu>}
        </div>
      </div>
      {refreshError && <p role="alert">{t('folders.refreshFailed')}</p>}
      {!ready || loading ? <p className="empty-state">{t('common.loading')}</p>
        : error ? <p role="alert">{t('folders.failed')}</p>
        : missing ? <p className="empty-state">{t('folders.notFound')}</p>
        : <>
          {children.length > 0 || notes.length > 0 ? <div className="object-stream">
            {[
              ...children.map((folder) => {
                const preview = [...folders.filter((item) => item.parent_id === folder.id).map((item) => item.name),
                  ...allNotes.filter((note) => note.folderId === folder.id).map((note) => note.title)].join(', ')
                return <Link key={folder.id} to={notesUrl(folder.id)} className="object-row note-folder-item">
                  <div className="object-row-main">
                    <h3><Folder size={20} strokeWidth={1.5} aria-hidden="true" />
                      <span><span className="sr-only">{t('folders.label')}{' '}</span>{folder.name}</span>
                    </h3>
                    {preview && <p>{preview}</p>}
                  </div>
                  <ChevronRight className="object-row-arrow" size={18} strokeWidth={2} aria-hidden="true" />
                </Link>
              }),
              ...notes.sort(comparePinnedObjects).map((note) => <ObjectCard key={note.id} object={note} />),
            ]}
          </div> : <div className="empty-panel">
            <h3>{t('module.emptyTitle')}</h3><p>{t('module.emptyBody', { type: t('object.note') })}</p>
          </div>}
        </>}
      {deleting && <FolderDialog title={t('folders.delete')} onClose={() => { if (!saving) setDeleting(null) }}>
        <p>{t('folders.deleteConfirm', { name: deleting.name,
          parent: folders.find((folder) => folder.id === deleting.parent_id)?.name ?? t('modules.notes') })}</p>
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
            <button type="submit" className="btn" disabled={saving || !name.trim()}>
              {saving ? <SavingIcon /> : t('common.add')}
            </button>
          </div>
        </form>
      </FolderDialog>}
    </div>
  )
}
