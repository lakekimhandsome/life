import {
  MDXEditor,
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
import { useMemo } from 'react'

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
