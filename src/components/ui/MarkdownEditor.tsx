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

  useEffect(
    () =>
      editor.registerCommand(
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
      ),
    [editor],
  )

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
