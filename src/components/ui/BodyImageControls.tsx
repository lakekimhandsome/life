import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey } from 'lexical'
import { Image as ImageIcon } from 'lucide-react'
import { useContext, useLayoutEffect, useRef } from 'react'
import { ImageRemovalContext } from './imageRemovalContext'
import { useT } from '../../state/LocaleContext'

export function BodyImageToolbar({ nodeKey }: { nodeKey?: string }) {
  const [editor] = useLexicalComposerContext()
  const removals = useContext(ImageRemovalContext)
  const marker = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const image = marker.current?.parentElement?.querySelector<HTMLImageElement>('img[src]')
    if (!image || !nodeKey || !removals) return
    removals.set(image, () => { editor.update(() => $getNodeByKey(nodeKey)?.remove()) })
    return () => { removals.delete(image) }
  }, [editor, nodeKey, removals])

  return <span hidden ref={marker} />
}

export function BodyImagePlaceholder() {
  const t = useT()
  return <span className="body-image-placeholder" role="status" aria-label={t('common.loading')}>
    <ImageIcon size={22} strokeWidth={1.5} aria-hidden="true" />
  </span>
}
