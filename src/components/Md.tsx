import { Children, isValidElement, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { slugify } from '../markdown.ts'

/** Plain text of rendered children, used to build heading anchors. */
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((c) =>
      typeof c === 'string' || typeof c === 'number'
        ? String(c)
        : isValidElement<{ children?: ReactNode }>(c)
          ? textOf(c.props.children)
          : '',
    )
    .join('')
}

// Defined once: an inline component would be a new type on every render, which makes React
// recreate the heading elements (and breaks anything holding on to them, like the TOC tracker).
const withAnchors: Components = {
  h2: ({ children }) => <h2 id={slugify(textOf(children))}>{children}</h2>,
}
const plugins = [remarkGfm]

/** Markdown with GitHub extensions (tables, strikethrough, task lists). */
export default function Markdown({ children, anchors = false }: { children: string; anchors?: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={plugins}
      components={anchors ? withAnchors : undefined}
    >
      {children}
    </ReactMarkdown>
  )
}
