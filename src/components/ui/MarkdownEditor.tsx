import {
  MDXEditor,
  $createTableNode,
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
import { STRIKETHROUGH } from '@lexical/markdown'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { MarkdownShortcutPlugin as LexicalMarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { Check, Copy } from 'lucide-react'
import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $setSelection,
  $isElementNode,
  $isRangeSelection,
  $isParagraphNode,
  COMMAND_PRIORITY_HIGH,
  INDENT_CONTENT_COMMAND,
  KEY_TAB_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  type ElementNode,
} from 'lexical'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../../state/LocaleContext'

const MAX_SWIPE_DURATION_MS = 500

function splitTableRow(value: string) {
  const trimmed = value.trim()
  if (!trimmed.includes('|')) return null
  const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
  return cells.length > 1 ? cells : null
}

function splitTableSeparator(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  const cells = splitTableRow(trimmed)
  return cells?.every((cell) => /^:?-{3,}:?$/.test(cell)) ? cells : null
}

function parseTableLines(lines: string[]) {
  const headers = splitTableRow(lines[0] ?? '')
  const separators = splitTableSeparator(lines[1] ?? '')
  if (!headers || !separators || headers.length !== separators.length) return null
  if (lines.length < 3 || !lines.at(-1)?.trim().endsWith('|')) return null

  const rows = lines.slice(2).map(splitTableRow)
  if (rows.length === 0 || rows.some((row) => row?.length !== headers.length)) return null
  return { headers, separators, rows: rows as string[][] }
}

function findTableMatch() {
  function visit(parent: ElementNode = $getRoot()): {
    nodeKeys: string[]
    table: NonNullable<ReturnType<typeof parseTableLines>>
  } | null {
    const children = parent.getChildren()

    for (let index = 0; index < children.length; index += 1) {
      const header = children[index]
      if (!$isParagraphNode(header)) continue

      const inlineTable = parseTableLines(header.getTextContent().split('\n'))
      if (inlineTable) return { nodeKeys: [header.getKey()], table: inlineTable }

      const headers = splitTableRow(header.getTextContent())
      const separator = children[index + 1]
      if (!headers || !$isParagraphNode(separator)) continue

      const lines = [header.getTextContent(), separator.getTextContent()]
      const nodeKeys = [header.getKey(), separator.getKey()]
      for (let rowIndex = index + 2; rowIndex < children.length; rowIndex += 1) {
        const row = children[rowIndex]
        if (
          !$isParagraphNode(row) ||
          !row.getTextContent().trim().endsWith('|') ||
          splitTableRow(row.getTextContent())?.length !== headers.length
        ) break
        lines.push(row.getTextContent())
        nodeKeys.push(row.getKey())
      }
      const table = parseTableLines(lines)
      if (table) return { nodeKeys, table }
    }

    for (const child of children) {
      if ($isElementNode(child)) {
        const match = visit(child)
        if (match) return match
      }
    }
    return null
  }

  return visit()
}

function TableMarkdownShortcutPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => editor.registerUpdateListener(({ editorState, tags }) => {
    if (tags.has('table-markdown-shortcut')) return
    if (!editorState.read(() => findTableMatch())) return

    editor.update(() => {
      const match = findTableMatch()
      if (!match) return
      const firstNode = $getNodeByKey(match.nodeKeys[0])
      if (!$isParagraphNode(firstNode)) return
      const { headers, separators, rows } = match.table

      $setSelection(null)

      const table = $createTableNode({
        type: 'table',
        align: separators.map((cell) =>
          cell.startsWith(':') && cell.endsWith(':')
            ? 'center'
            : cell.endsWith(':')
              ? 'right'
              : 'left',
        ),
        children: [headers, ...rows].map((values) => ({
          type: 'tableRow',
          children: values.map((value) => ({
            type: 'tableCell',
            children: value ? [{ type: 'text', value }] : [],
          })),
        })),
      })
      firstNode.replace(table)
      match.nodeKeys.slice(1).forEach((key) => $getNodeByKey(key)?.remove())
      window.setTimeout(() => table.select([1, 0]))
    }, { tag: 'table-markdown-shortcut' })
  }), [editor])

  return null
}

const tableMarkdownShortcutPlugin = realmPlugin({
  init(realm) {
    realm.pub(addComposerChild$, TableMarkdownShortcutPlugin)
  },
})

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

    let gesture: {
      pointerId: number
      x: number
      y: number
      startedAt: number
      itemKey: string
    } | null = null

    function hasTextSelection(root: Element) {
      const selection = root.ownerDocument.getSelection()
      return !!selection && !selection.isCollapsed && !!selection.anchorNode && root.contains(selection.anchorNode)
    }

    function onPointerDown(event: PointerEvent) {
      gesture = null
      if (!event.isPrimary || event.pointerType === 'mouse') return
      const target = event.target
      if (!(target instanceof Element)) return
      const listItem = target.closest('li')
      const root = event.currentTarget
      if (!(root instanceof Element) || !listItem || !root.contains(listItem)) return
      if (hasTextSelection(root)) return

      let itemKey: string | null = null
      editor.read(() => {
        let node = $getNearestNodeFromDOMNode(listItem)
        while (node && !$isListItemNode(node)) node = node.getParent()
        if ($isListItemNode(node)) itemKey = node.getKey()
      })
      if (!itemKey) return

      gesture = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startedAt: event.timeStamp,
        itemKey,
      }
    }

    function onPointerMove(event: PointerEvent) {
      const start = gesture
      if (!start || event.pointerId !== start.pointerId) return
      const root = event.currentTarget
      if (
        !(root instanceof Element) ||
        event.timeStamp - start.startedAt > MAX_SWIPE_DURATION_MS ||
        hasTextSelection(root)
      ) {
        gesture = null
        return
      }

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
      const cancelOnSelection = () => {
        if (hasTextSelection(root)) gesture = null
      }
      root.ownerDocument.addEventListener('selectionchange', cancelOnSelection)
      return () => {
        root.removeEventListener('pointerdown', onPointerDown, true)
        root.removeEventListener('pointermove', onPointerMove, true)
        root.removeEventListener('pointerup', cancelPointer, true)
        root.removeEventListener('pointercancel', cancelPointer, true)
        root.ownerDocument.removeEventListener('selectionchange', cancelOnSelection)
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

const strikethroughShortcutPlugin = realmPlugin({
  init(realm) {
    realm.pub(addComposerChild$, () => (
      <LexicalMarkdownShortcutPlugin transformers={[STRIKETHROUGH]} />
    ))
  },
})

function PlainTextCodeEditor({ code }: CodeBlockEditorProps) {
  const t = useT()
  const { setCode } = useCodeBlockEditorContext()
  const [draftCode, setDraftCode] = useState(code)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const fitHeight = () => {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
    fitHeight()
    let width = textarea.clientWidth
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth === width) return
      width = textarea.clientWidth
      fitHeight()
    })
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [draftCode])

  // Keep external edits (including undo/redo) in sync with the local input.
  useEffect(() => setDraftCode(code), [code])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(draftCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Keep the copy button available when clipboard permission is denied.
    }
  }

  return (
    <div className="inline-code-editor-wrap">
      <textarea
        ref={textareaRef}
        className="inline-code-editor"
        value={draftCode}
        onChange={(event) => {
          // Lexical publishes code later; React needs the new value immediately
          // to avoid restoring the old value and moving the caret to the end.
          setDraftCode(event.target.value)
          setCode(event.target.value)
        }}
        spellCheck={false}
      />
      <button
        type="button"
        className="inline-code-copy"
        onClick={() => void copyCode()}
        aria-label={copied ? t('clipboard.copied') : t('clipboard.copyCode')}
        title={copied ? t('clipboard.copied') : t('clipboard.copyCode')}
      >
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </button>
    </div>
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
      tableMarkdownShortcutPlugin(),
      codeBlockPlugin({ codeBlockEditorDescriptors: [plainTextCodeEditorDescriptor] }),
      markdownShortcutPlugin(),
      strikethroughShortcutPlugin(),
      listTabPlugin(),
    ],
    [],
  )

  return (
    <div onClickCapture={(event) => {
      const link = event.target instanceof Element ? event.target.closest('a') : null
      if (!(link instanceof HTMLAnchorElement)) return
      event.preventDefault()
      event.stopPropagation()
      window.open(link.href, '_blank', 'noopener,noreferrer')
    }}>
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
    </div>
  )
}
