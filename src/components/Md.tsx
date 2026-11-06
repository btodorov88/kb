import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Markdown with GitHub extensions (tables, strikethrough, task lists). */
export default function Markdown({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
}
