// Local regression check: npm run dev, then open /code-editor-check.html.
// Edit the middle of the code; each input checks its value and selection after React/Lexical settle.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MarkdownContent } from '../src/components/ui/MarkdownContent'
import { MarkdownEditor } from '../src/components/ui/MarkdownEditor'
import { AuthProvider } from '../src/state/AuthContext'
import { LocaleProvider } from '../src/state/LocaleContext'
import '@mdxeditor/editor/style.css'
import '../src/index.css'

export function Check() {
  const [value, setValue] = useState('```\nabcdef\nsecond line\n```')
  const [tableValue, setTableValue] = useState('')
  const [quoteValue, setQuoteValue] = useState('> 2027. 1\\. 1. CMJ 75cm\n\n> 2027. 6\\. 1. CMJ 80cm')
  const [listQuoteValue, setListQuoteValue] = useState('> 1. real list item')
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState('Edit the middle of the code block.')
  return <>
    <div onInputCapture={(event) => {
      const target = event.target
      if (!(target instanceof HTMLTextAreaElement)) return
      const expected = { value: target.value, start: target.selectionStart, end: target.selectionEnd }
      requestAnimationFrame(() => {
        const passed = target.scrollHeight <= target.clientHeight + 1 && target.value === expected.value && target.selectionStart === expected.start && target.selectionEnd === expected.end
        setResult(`${passed ? 'PASS' : 'FAIL'}: expected cursor ${expected.start}, got ${target.selectionStart}; height ${target.clientHeight}/${target.scrollHeight}`)
      })
    }}>
      <MarkdownEditor value={value} onChange={setValue} />
    </div>
    <output>{result}</output>
    <pre aria-label="Serialized markdown">{value}</pre>
    <section aria-label="Table shortcut check">
      <MarkdownEditor value={tableValue} onChange={setTableValue} />
      <pre aria-label="Serialized table markdown">{tableValue}</pre>
    </section>
    <section aria-label="Quote check">
      <MarkdownEditor key={reloadKey} value={quoteValue} onChange={setQuoteValue} />
      <button onClick={() => setReloadKey((key) => key + 1)}>Reload quote markdown</button>
      <pre aria-label="Serialized quote markdown">{quoteValue}</pre>
    </section>
    <section aria-label="Quote preview">
      <MarkdownContent>{'> 2027. 1\\. 1. CMJ 75cm'}</MarkdownContent>
    </section>
    <section aria-label="List quote check">
      <MarkdownEditor value={listQuoteValue} onChange={setListQuoteValue} />
    </section>
    <section aria-label="Comparison check">
      <MarkdownEditor value={'η<0.3이면 x>1.5W\n\nx<3.75W → η>0.15'} onChange={() => {}} onError={setResult} />
    </section>
  </>
}
createRoot(document.getElementById('root')!).render(<AuthProvider><LocaleProvider><Check /></LocaleProvider></AuthProvider>)
