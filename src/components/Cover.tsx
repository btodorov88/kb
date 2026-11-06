import type { Book } from '../types.ts'

/** Book cover image. Renders nothing when there is no image (e.g. study topics). */
export default function Cover({ book, size = 'md' }: { book: Pick<Book, 'coverUrl'>; size?: 'sm' | 'md' | 'lg' }) {
  if (!book.coverUrl) return null
  return <img className={`cover ${size}`} src={book.coverUrl} alt="" loading="lazy" />
}
