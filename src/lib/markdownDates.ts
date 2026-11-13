import type { Nodes, Paragraph, Root } from 'mdast'

// CommonMark reads the year in “2027. 1. 1.” as an ordered-list marker.
// Recognize only complete calendar dates, leaving ordinary numbered lists alone.
export function dateListParagraphs(node: Nodes): Paragraph[] | null {
  if (node.type !== 'list' || !node.ordered || !node.start || node.start < 1000 || node.start > 9999) return null
  const paragraphs: Paragraph[] = []
  for (const [index, item] of node.children.entries()) {
    let content = item.children[0]
    if (item.children.length !== 1) return null
    let prefix = ''
    // Unescaped month/day markers form nested lists on the same source line.
    while (content?.type === 'list') {
      if (!content.ordered || content.start == null || content.children.length !== 1
        || content.position?.start.line !== item.position?.start.line) return null
      const nestedItem = content.children[0]
      if (nestedItem.children.length !== 1) return null
      prefix += `${content.start}. `
      content = nestedItem.children[0]
    }
    if (content?.type !== 'paragraph') return null
    const paragraph: Paragraph = prefix ? { ...content, children: [
      { type: 'text', value: prefix + (content.children[0]?.type === 'text' ? content.children[0].value : '') },
      ...content.children.slice(content.children[0]?.type === 'text' ? 1 : 0),
    ] } : content
    const first = paragraph.children[0]
    if (first?.type !== 'text') return null
    const match = /^(\d{1,2})\.\s+(\d{1,2})\.(?:\s|$)/.exec(first.value)
    if (!match) return null
    const year = node.start + index
    const month = Number(match[1])
    const day = Number(match[2])
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
    paragraphs.push({ ...paragraph, children: [{ ...first, value: `${year}. ${first.value}` }, ...paragraph.children.slice(1)] })
  }
  return paragraphs
}

export function remarkCalendarDates() {
  return (tree: Root) => {
    function walk(node: Nodes) {
      if (!('children' in node)) return
      node.children = node.children.flatMap((child) => dateListParagraphs(child) ?? [child]) as typeof node.children
      for (const child of node.children) walk(child)
    }
    walk(tree)
  }
}
