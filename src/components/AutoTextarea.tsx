import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

/** A textarea that grows with its content (from `rows` up to `maxRows`). */
export default function AutoTextarea({
  maxRows = 30,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { maxRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24
    const max = line * maxRows + 24
    el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
  }, [props.value, maxRows])

  return <textarea ref={ref} {...props} />
}
