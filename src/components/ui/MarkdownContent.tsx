import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { bodyImageResolver } from '../../lib/bodyImages'
import { ImageGallery } from './ImageGallery'
import { useT } from '../../state/LocaleContext'

function BodyImage({ src, resolve, ...props }: ComponentProps<'img'> & { resolve: (source: string) => Promise<string> }) {
  const t = useT()
  const [url, setUrl] = useState<string>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    setUrl(undefined)
    setFailed(false)
    if (typeof src === 'string') void resolve(src).then((next) => { if (active) setUrl(next) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [src, resolve])
  if (failed) return <span role="alert">{t('clipboard.imageFetchFailed')}</span>
  return url ? <img {...props} src={url} /> : <span>{t('common.loading')}</span>
}

interface MarkdownContentProps {
  children: string
  className?: string
  shareToken?: string
}

export function MarkdownContent({ children, className, shareToken }: MarkdownContentProps) {
  const resolve = useMemo(() => bodyImageResolver(shareToken), [shareToken])
  const components = useMemo(() => ({
    img: ({ node: _node, ...props }: ComponentProps<'img'> & { node?: unknown }) => <BodyImage {...props} resolve={resolve} />,
  }), [resolve])
  return <ImageGallery><div className={className}>
    <Markdown remarkPlugins={[remarkGfm]} components={components}>{children}</Markdown>
  </div></ImageGallery>
}
