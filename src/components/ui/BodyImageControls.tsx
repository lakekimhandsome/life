import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey } from 'lexical'
import { Image as ImageIcon, Trash2 } from 'lucide-react'
import { useT } from '../../state/LocaleContext'

export function BodyImageToolbar({ nodeKey }: { nodeKey?: string }) {
  const [editor] = useLexicalComposerContext()
  const t = useT()

  return <button
    type="button"
    className="body-image-delete"
    aria-label={t('clipboard.deleteImage')}
    title={t('clipboard.deleteImage')}
    onClick={(event) => {
      event.preventDefault()
      event.stopPropagation()
      if (!nodeKey || !window.confirm(t('bodyImage.deleteConfirm'))) return
      editor.update(() => $getNodeByKey(nodeKey)?.remove())
    }}
  >
    <span className="body-image-delete-icon"><Trash2 size={15} strokeWidth={1.8} aria-hidden="true" /></span>
  </button>
}

export function BodyImagePlaceholder() {
  const t = useT()
  return <span className="body-image-placeholder" role="status" aria-label={t('common.loading')}>
    <ImageIcon size={22} strokeWidth={1.5} aria-hidden="true" />
  </span>
}
