import type { Book } from '../types.ts'

export default function Cover({ book, size = 'md' }: { book: Pick<Book, 'title' | 'coverUrl'>; size?: 'sm' | 'md' }) {
  if (book.coverUrl) {
    return <img className={`cover ${size}`} src={book.coverUrl} alt="" loading="lazy" />
  }
  return (
    <div className={`cover ${size} placeholder`} aria-hidden>
      {book.title.slice(0, 1).toUpperCase() || '?'}
    </div>
  )
}
