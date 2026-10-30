import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useT } from '../../state/LocaleContext'

export function FolderDialog({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const t = useT()
  useEffect(() => { ref.current?.showModal() }, [])
  return (
    <dialog ref={ref} className="folder-dialog" aria-label={title} onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <header><h2>{title}</h2><button type="button" className="object-header-action"
        aria-label={t('common.close')} onClick={onClose}><X size={20} /></button></header>
      {children}
    </dialog>
  )
}
