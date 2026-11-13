import { $isQuoteNode, QuoteNode } from '@lexical/rich-text'
import { $splitNode, mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode, $getSelection, $isElementNode, $isParagraphNode,
  $isRangeSelection, $isTextNode, COMMAND_PRIORITY_HIGH,
  DELETE_CHARACTER_COMMAND, INSERT_PARAGRAPH_COMMAND, KEY_ARROW_RIGHT_COMMAND,
  type LexicalEditor, type ParagraphNode,
} from 'lexical'

function exitQuote(paragraph: ParagraphNode) {
  const quote = paragraph.getParent()
  if (!$isQuoteNode(quote)) return false
  const following = paragraph.getNextSibling()
  if (following) {
    const [, trailingQuote] = $splitNode(quote, paragraph.getIndexWithinParent() + 1)
    trailingQuote.insertBefore(paragraph)
  } else {
    quote.insertAfter(paragraph)
  }
  if (quote.isEmpty()) quote.remove()
  paragraph.selectStart()
  return true
}

export function registerFormatExit(editor: LexicalEditor) {
  return mergeRegister(
    // Imported quotes contain paragraphs; normalize shortcut-created quotes to the same structure.
    editor.registerNodeTransform(QuoteNode, (quote) => {
      // Lists can exit empty items only when their container is a root or shadow root.
      if (!quote.isShadowRoot()) quote.setIsShadowRoot(true)
      let paragraph: ParagraphNode | null = null
      for (const child of quote.getChildren()) {
        if ($isElementNode(child) && !child.isInline()) {
          paragraph = null
        } else {
          if (!paragraph) {
            paragraph = $createParagraphNode()
            child.insertBefore(paragraph)
          }
          paragraph.append(child)
        }
      }
    }),
    editor.registerCommand(INSERT_PARAGRAPH_COMMAND, () => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return false
      if (selection.hasFormat('code')) selection.toggleFormat('code')
      if (!selection.isCollapsed()) return false
      const node = selection.anchor.getNode()
      const paragraph = $isParagraphNode(node) ? node : node.getParent()
      return $isParagraphNode(paragraph) && paragraph.isEmpty() && exitQuote(paragraph)
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(DELETE_CHARACTER_COMMAND, (backward) => {
      const selection = $getSelection()
      if (!backward || !$isRangeSelection(selection) || !selection.isCollapsed() || selection.anchor.offset !== 0) return false
      const node = selection.anchor.getNode()
      const paragraph = $isParagraphNode(node) ? node : node.getParent()
      if (!$isParagraphNode(paragraph) || paragraph.getPreviousSibling() || (node !== paragraph && node.getPreviousSibling())) return false
      return exitQuote(paragraph)
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_ARROW_RIGHT_COMMAND, (event) => {
      const selection = $getSelection()
      if (event.shiftKey || !$isRangeSelection(selection) || !selection.isCollapsed() || !selection.hasFormat('code')) return false
      const node = selection.anchor.getNode()
      if (!$isTextNode(node) || selection.anchor.offset !== node.getTextContentSize() || node.getNextSibling()) return false
      selection.toggleFormat('code')
      event.preventDefault()
      return true
    }, COMMAND_PRIORITY_HIGH),
  )
}
