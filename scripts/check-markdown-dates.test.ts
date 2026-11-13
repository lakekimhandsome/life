import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { dateListParagraphs, remarkCalendarDates } from '../src/lib/markdownDates.ts'

test('calendar dates preserve inline content and valid leap dates', () => {
  for (const input of ['2027. 1\\. 1. CMJ **75cm**', '2028. 2. 29. leap']) {
    const tree = fromMarkdown(input)
    const paragraphs = dateListParagraphs(tree.children[0])
    assert.equal(paragraphs?.[0].children[0].type, 'text')
    assert.equal(paragraphs?.[0].children.at(-1)?.type, input.includes('**') ? 'strong' : 'text')
  }
})

test('ordinary lists, invalid dates, nested lists and code remain intact', () => {
  for (const input of ['1. first', '2027. ordinary item', '2027. 2. 29. invalid', '2027. 13. 1. invalid', '2027. 1\\. 1. date\n       - child', '```\n2027. 1. 1. code\n```']) {
    const tree = fromMarkdown(input)
    const before = structuredClone(tree)
    remarkCalendarDates()(tree)
    assert.deepEqual(tree, before)
  }
})

test('dates inside quotes become paragraphs without rewriting the source', () => {
  const tree = fromMarkdown('> 2027. 1\\. 1. CMJ 75cm')
  remarkCalendarDates()(tree)
  const quote = tree.children[0]
  assert.equal(quote.type, 'blockquote')
  if (quote.type !== 'blockquote') throw new Error('expected quote')
  assert.deepEqual(quote.children[0].type, 'paragraph')
})
