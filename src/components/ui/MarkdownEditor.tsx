import {
  MDXEditor,
  addComposerChild$,
  realmPlugin,
  codeBlockPlugin,
  headingsPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  useCodeBlockEditorContext,
  type CodeBlockEditorDescriptor,
  type CodeBlockEditorProps,
} from '@mdxeditor/editor'
import { $isListItemNode } from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  INDENT_CONTENT_COMMAND,
  KEY_TAB_COMMAND,
  OUTDENT_CONTENT_COMMAND,
} from 'lexical'
import { useEffect, useMemo } from 'react'

function ListTabAnywherePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const unregisterTab = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false

        let node = selection.anchor.getNode()
        while (node && !$isListItemNode(node)) {
          const parent = node.getParent()
          if (!parent) return false
          node = parent
        }

        event.preventDefault()
        return editor.dispatchCommand(
          event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND,
          undefined,
        )
      },
      COMMAND_PRIORITY_HIGH,
    )

    let gesture: { pointerId: number; x: number; y: number; itemKey: string } | null = null

    function onPointerDown(event: PointerEvent) {
      gesture = null
      if (!event.isPrimary || event.pointerType === 'mouse') return
      const target = event.target
      if (!(target instanceof Element)) return
      const listItem = target.closest('li')
      const root = event.currentTarget
      if (!(root instanceof Element) || !listItem || !root.contains(listItem)) return

      let itemKey: string | null = null
      editor.read(() => {
        let node = $getNearestNodeFromDOMNode(listItem)
        while (node && !$isListItemNode(node)) node = node.getParent()
        if ($isListItemNode(node)) itemKey = node.getKey()
      })
      if (!itemKey) return

      gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, itemKey }
    }

    function onPointerMove(event: PointerEvent) {
      const start = gesture
      if (!start || event.pointerId !== start.pointerId) return

      const deltaX = event.clientX - start.x
      const deltaY = event.clientY - start.y
      if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return

      gesture = null
      event.preventDefault()
      editor.update(() => {
        const item = $getNodeByKey(start.itemKey)
        if (!$isListItemNode(item)) return
        item.setIndent(Math.max(0, item.getIndent() + (deltaX > 0 ? 1 : -1)))
      })
    }

    function cancelPointer() {
      gesture = null
    }

    const unregisterRoot = editor.registerRootListener((root) => {
      gesture = null
      if (!root) return
      root.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
      root.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
      root.addEventListener('pointerup', cancelPointer, true)
      root.addEventListener('pointercancel', cancelPointer, true)
      return () => {
        root.removeEventListener('pointerdown', onPointerDown, true)
        root.removeEventListener('pointermove', onPointerMove, true)
        root.removeEventListener('pointerup', cancelPointer, true)
        root.removeEventListener('pointercancel', cancelPointer, true)
      }
    })

    return () => {
      unregisterTab()
      unregisterRoot()
    }
  }, [editor])

  return null
}

const listTabPlugin = realmPlugin({
  init(realm) {
    realm.pub(addComposerChild$, ListTabAnywherePlugin)
  },
})

function PlainTextCodeEditor({ code }: CodeBlockEditorProps) {
  const { setCode } = useCodeBlockEditorContext()
  return (
    <textarea
      className="inline-code-editor"
      value={code}
      onChange={(event) => setCode(event.target.value)}
      spellCheck={false}
    />
  )
}

const plainTextCodeEditorDescriptor: CodeBlockEditorDescriptor = {
  priority: 0,
  match: () => true,
  Editor: PlainTextCodeEditor,
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  onError?: (message: string) => void
  placeholder?: string
}

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  onError,
  placeholder,
}: MarkdownEditorProps) {
  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      tablePlugin(),
      codeBlockPlugin({ codeBlockEditorDescriptors: [plainTextCodeEditorDescriptor] }),
      markdownShortcutPlugin(),
      listTabPlugin(),
    ],
    [],
  )

  return (
    <MDXEditor
      className="inline-markdown-editor"
      contentEditableClassName="markdown-content inline-markdown-content"
      markdown={value}
      placeholder={placeholder}
      onChange={(markdown, initialMarkdownNormalize) => {
        if (!initialMarkdownNormalize) onChange(markdown)
      }}
      onBlur={onBlur}
      onError={({ error }) => onError?.(error)}
      plugins={plugins}
    />
  )
}
