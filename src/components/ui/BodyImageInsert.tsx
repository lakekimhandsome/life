import { $createImageNode, addComposerChild$, realmPlugin } from '@mdxeditor/editor'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createParagraphNode, $getNodeByKey, $getSelection, $isRangeSelection, $insertNodes, $isRootOrShadowRoot, $setSelection } from 'lexical'
import { useEffect, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { imageFilesFromDataTransfer } from '../../lib/clipboard'
import { uploadBodyImage } from '../../lib/bodyImages'
import { useT } from '../../state/LocaleContext'

// oxlint-disable-next-line react/only-export-components
function BodyImageInsert() {
  const [editor] = useLexicalComposerContext()
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const selection = useRef<ReturnType<typeof $getSelection>>(null)
  const mounted = useRef(true)
  const busy = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function rememberSelection() {
    editor.getEditorState().read(() => { selection.current = $getSelection()?.clone() ?? null })
  }

  async function insert(files: File[]) {
    if (!files.length) return
    if (busy.current) { setError(t('bodyImage.wait')); return }
    busy.current = true
    setUploading(true)
    setError('')
    const target = selection.current
    const uploaded: string[] = []
    try {
      for (const file of files) uploaded.push(await uploadBodyImage(file))
    } catch (nextError) {
      if (mounted.current) setError(nextError instanceof Error ? nextError.message : t('clipboard.uploadFailed'))
    } finally {
      if (mounted.current && uploaded.length) {
        editor.update(() => {
          if ($isRangeSelection(target) && $getNodeByKey(target.anchor.key) && $getNodeByKey(target.focus.key)) $setSelection(target)
          for (const src of uploaded) {
            const image = $createImageNode({ src, altText: '' })
            $insertNodes([image])
            if ($isRootOrShadowRoot(image.getParentOrThrow())) {
              const paragraph = $createParagraphNode()
              image.replace(paragraph)
              paragraph.append(image).selectEnd()
            }
          }
        })
      }
      busy.current = false
      if (mounted.current) setUploading(false)
    }
  }

  const insertRef = useRef(insert)
  insertRef.current = insert
  useEffect(() => {
    mounted.current = true
    const paste = (event: ClipboardEvent) => {
      const files = imageFilesFromDataTransfer(event.clipboardData)
      if (!files.length) return
      event.preventDefault()
      event.stopImmediatePropagation()
      editor.getEditorState().read(() => { selection.current = $getSelection()?.clone() ?? null })
      void insertRef.current(files)
    }
    const unregister = editor.registerRootListener((root, previous) => {
      previous?.removeEventListener('paste', paste, true)
      root?.addEventListener('paste', paste, true)
    })
    return () => {
      mounted.current = false
      editor.getRootElement()?.removeEventListener('paste', paste, true)
      unregister()
    }
  }, [editor])

  return <div className="body-image-insert" contentEditable={false}>
    <button type="button" className="btn" disabled={uploading}
      onPointerDown={(event) => { event.preventDefault(); rememberSelection() }}
      onClick={() => { rememberSelection(); input.current?.click() }}>
      <ImagePlus size={16} aria-hidden="true" /> {t(uploading ? 'bodyImage.uploading' : 'bodyImage.insert')}
    </button>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden
      onChange={(event) => { void insert([...event.target.files ?? []]); event.target.value = '' }} />
    {error && <span role="alert" className="form-error">{error}</span>}
  </div>
}

export const bodyImageInsertPlugin = realmPlugin({
  init(realm) { realm.pub(addComposerChild$, BodyImageInsert) },
})
