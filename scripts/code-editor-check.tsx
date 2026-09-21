// Local regression check: npm run dev, then open /code-editor-check.html.
// Edit the middle of the code; each input checks its value and selection after React/Lexical settle.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MarkdownEditor } from '../src/components/ui/MarkdownEditor'
import { AuthProvider } from '../src/state/AuthContext'
import { LocaleProvider } from '../src/state/LocaleContext'
import '@mdxeditor/editor/style.css'
import '../src/index.css'

export function Check() {
  const [value, setValue] = useState('```\nabcdef\nsecond line\n```')
  const [tableValue, setTableValue] = useState('')
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
  </>
}
createRoot(document.getElementById('root')!).render(<AuthProvider><LocaleProvider><Check /></LocaleProvider></AuthProvider>)
