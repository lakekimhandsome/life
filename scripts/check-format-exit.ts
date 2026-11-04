import assert from 'node:assert/strict'
import { createEditor, $getRoot, $createParagraphNode, $createTextNode, $getSelection, $isRangeSelection, INSERT_PARAGRAPH_COMMAND, DELETE_CHARACTER_COMMAND } from 'lexical'
import { QuoteNode, $createQuoteNode, registerRichText } from '@lexical/rich-text'
import { registerFormatExit } from '../src/components/ui/formatExit.ts'

const editor = createEditor({ nodes: [QuoteNode], onError: (error) => { throw error } })
const stopRichText = registerRichText(editor)
const stopExit = registerFormatExit(editor)
function check(run: () => void) { editor.update(run, { discrete: true }) }
check(() => {
  const quote = $createQuoteNode().append($createTextNode('quote'))
  $getRoot().append(quote)
})
check(() => {
  const quote = $getRoot().getFirstChildOrThrow() as QuoteNode
  assert.equal(quote.getFirstChildOrThrow().getType(), 'paragraph')
  quote.getFirstChildOrThrow().selectEnd()
  editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined)
  editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined)
  assert.deepEqual($getRoot().getChildren().map(n => n.getType()), ['quote', 'paragraph'])
  assert.equal(quote.getTextContent(), 'quote')
})
check(() => {
  $getRoot().clear()
  const middle = $createParagraphNode()
  $getRoot().append($createQuoteNode().append(
    $createParagraphNode().append($createTextNode('before')), middle,
    $createParagraphNode().append($createTextNode('after')),
  ))
  middle.selectStart()
  editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined)
  assert.deepEqual($getRoot().getChildren().map(n => [n.getType(), n.getTextContent()]), [['quote', 'before'], ['paragraph', ''], ['quote', 'after']])
})
check(() => {
  $getRoot().clear()
  const paragraph = $createParagraphNode().append($createTextNode('preserved'))
  $getRoot().append($createQuoteNode().append(paragraph))
  paragraph.selectStart()
  editor.dispatchCommand(DELETE_CHARACTER_COMMAND, true)
  assert.equal($getRoot().getFirstChildOrThrow().getType(), 'paragraph')
  assert.equal($getRoot().getTextContent(), 'preserved')
})
check(() => {
  $getRoot().clear()
  const code = $createTextNode('code').toggleFormat('code')
  $getRoot().append($createParagraphNode().append(code))
  code.selectEnd()
  editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined)
  const selection = $getSelection()
  assert.ok($isRangeSelection(selection))
  assert.equal(selection.hasFormat('code'), false)
  selection.insertText('plain')
  assert.equal(code.hasFormat('code'), true)
  assert.equal($getRoot().getLastChildOrThrow().getTextContent(), 'plain')
})
stopExit()
stopRichText()
console.log('PASS: quote normalization, empty exit, middle split, backspace, inline code Enter')
