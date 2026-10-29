import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, markReviewed, type Book } from '../db.ts'
import Cover from '../components/Cover.tsx'

const DAY = 24 * 60 * 60 * 1000

/**
 * Shows books with notes, least recently reviewed first.
 * A book counts as "due" if it was never reviewed or not reviewed in the last 30 days.
 */
export default function Review() {
  const books = useLiveQuery(() => db.books.toArray())
  const [revealed, setRevealed] = useState(false)
  const [skipped, setSkipped] = useState<number[]>([])
  const [now] = useState(() => Date.now())

  if (!books) return null

  const withNotes = books.filter((b) => b.takeaways.length > 0 || b.quotes.length > 0)
  const queue = withNotes
    .filter((b) => !skipped.includes(b.id))
    .sort((a, b) => (a.lastReviewedAt ?? 0) - (b.lastReviewedAt ?? 0))
  const due = queue.filter((b) => !b.lastReviewedAt || now - b.lastReviewedAt > 30 * DAY)
  const current: Book | undefined = due[0]

  if (withNotes.length === 0) {
    return (
      <div className="empty">
        <h1>Nothing to review yet</h1>
        <p>Add key takeaways or quotes to a book and it will show up here.</p>
        <Link to="/" className="button">
          Go to library
        </Link>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="empty">
        <h1>All caught up 🎉</h1>
        <p>Every book has been reviewed in the last 30 days.</p>
        {queue[0] && (
          <p className="muted">
            Next up: <Link to={`/books/${queue[0].id}`}>{queue[0].title}</Link>
          </p>
        )}
      </div>
    )
  }

  const next = () => setRevealed(false)

  return (
    <div className="review">
      <p className="muted small">{due.length} book{due.length === 1 ? '' : 's'} due for review</p>
      <div className="review-card">
        <header className="book-header">
          <Cover book={current} size="sm" />
          <div>
            <h1>{current.title}</h1>
            <p className="muted">{current.author}</p>
            <p className="small muted">
              {current.lastReviewedAt
                ? `Last reviewed ${new Date(current.lastReviewedAt).toLocaleDateString()}`
                : 'Never reviewed'}
            </p>
          </div>
        </header>

        {!revealed ? (
          <div className="recall">
            <p>
              Before you look: <strong>what do you remember</strong> about this book?
            </p>
            <button className="primary" onClick={() => setRevealed(true)}>
              Show my notes
            </button>
          </div>
        ) : (
          <>
            {current.takeaways.length > 0 && (
              <ol className="takeaways">
                {current.takeaways.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            )}
            {current.quotes.slice(0, 3).map((q, i) => (
              <blockquote key={i} className="quote">
                {q.text}
              </blockquote>
            ))}
            <p>
              <Link to={`/books/${current.id}`}>Open full summary →</Link>
            </p>
          </>
        )}
      </div>

      <div className="actions">
        <button
          className="primary"
          onClick={async () => {
            await markReviewed(current.id)
            next()
          }}
        >
          Done, next book
        </button>
        <button
          onClick={() => {
            setSkipped([...skipped, current.id])
            next()
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
