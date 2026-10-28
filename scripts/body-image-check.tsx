// Local mobile regression fixture: open /body-image-check.html via npm run dev.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '../src/state/AuthContext'
import { LocaleProvider } from '../src/state/LocaleContext'
import { MarkdownEditor } from '../src/components/ui/MarkdownEditor'
import { MarkdownContent } from '../src/components/ui/MarkdownContent'
import '@mdxeditor/editor/style.css'
import '../src/index.css'

export function Check() {
  const [body, setBody] = useState(
    'before\n\n![landscape](https://example.test/landscape.png)\n\n![portrait](https://example.test/portrait.png)\n\nafter',
  )
  return (
    <AuthProvider>
      <LocaleProvider>
        <main style={{ padding: 16 }}>
          <MarkdownEditor value={body} onChange={setBody} />
          <pre id="markdown" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{body}</pre>
          <section id="preview"><MarkdownContent className="markdown-content">{body}</MarkdownContent></section>
        </main>
      </LocaleProvider>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Check />)
