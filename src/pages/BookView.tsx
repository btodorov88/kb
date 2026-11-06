import { Link, useNavigate, useParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import { deleteBook, markReviewed, STATUS_LABELS, useBook } from '../api.ts'
import Cover from '../components/Cover.tsx'
import Stars from '../components/Stars.tsx'

export default function BookView() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const book = useBook(id)

  if (book === undefined) return null
  if (book === null) return <p>Book not found. <Link to="/">Back to library</Link></p>

  async function handleDelete() {
    if (!confirm(`Delete "${book!.title}"? This cannot be undone.`)) return
    await deleteBook(id)
    navigate('/')
  }

  return (
    <article className="book-view">
      <header className="book-header">
        <Cover book={book} />
        <div className="grow">
          <h1>{book.title}</h1>
          {(book.author || book.group) && (
            <p className="muted">
              {book.author}
              {book.author && book.group && ' · '}
              {book.group && <span className="group-label">{book.group}</span>}
            </p>
          )}
          <Stars value={book.rating} />
          <p className="small muted">
            {STATUS_LABELS[book.status]}
            {book.startedAt && ` · started ${book.startedAt}`}
            {book.finishedAt && ` · finished ${book.finishedAt}`}
            {book.lastReviewedAt && ` · last reviewed ${new Date(book.lastReviewedAt).toLocaleDateString()}`}
          </p>
          {book.tags.length > 0 && (
            <div className="tags">
              {book.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="actions">
            <Link to={`/books/${id}/edit`} className="button primary">
              Edit
            </Link>
            {book.cards.length > 0 && (
              <Link to={`/books/${id}/study`} className="button">
                Study {book.cards.length} flashcard{book.cards.length === 1 ? '' : 's'}
              </Link>
            )}
            <button onClick={() => markReviewed(id)}>Mark reviewed</button>
            <button className="danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      </header>

      {book.takeaways.length > 0 && (
        <section>
          <h2>Key takeaways</h2>
          <ol className="takeaways">
            {book.takeaways.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </section>
      )}

      {book.summary.trim() && (
        <section>
          <h2>Summary</h2>
          <div className="prose">
            <Markdown>{book.summary}</Markdown>
          </div>
        </section>
      )}

      {book.quotes.length > 0 && (
        <section>
          <h2>Quotes &amp; highlights</h2>
          {book.quotes.map((q, i) => (
            <figure key={i} className="quote">
              <blockquote>{q.text}</blockquote>
              {q.page && <figcaption className="small muted">p. {q.page}</figcaption>}
              {q.note && <p className="small">{q.note}</p>}
            </figure>
          ))}
        </section>
      )}

      {book.cards.length > 0 && (
        <section>
          <h2>Flashcards</h2>
          <details>
            <summary className="muted small">Show all {book.cards.length} (questions and answers)</summary>
            <dl className="card-list">
              {book.cards.map((c, i) => (
                <div key={i}>
                  <dt className="prose">
                    <Markdown>{c.front}</Markdown>
                  </dt>
                  <dd className="prose">
                    <Markdown>{c.back}</Markdown>
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </section>
      )}

      {!book.summary.trim() && book.takeaways.length === 0 && book.quotes.length === 0 && book.cards.length === 0 && (
        <p className="muted">
          No notes yet. <Link to={`/books/${id}/edit`}>Add a summary</Link>.
        </p>
      )}
    </article>
  )
}
