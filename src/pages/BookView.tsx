import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Markdown from '../components/Md.tsx'
import { headingsOf } from '../markdown.ts'
import { STATUS_LABELS, useBook, type Book } from '../api.ts'
import Cover from '../components/Cover.tsx'
import Stars from '../components/Stars.tsx'
import Icon from '../components/Icon.tsx'

export default function BookView() {
  const id = Number(useParams().id)
  const book = useBook(id)

  if (book === undefined) return null
  if (book === null) {
    return (
      <div className="empty">
        <h1>Entry not found</h1>
        <p>It may have been deleted.</p>
        <Link to="/" className="btn">
          Back to library
        </Link>
      </div>
    )
  }
  return <Entry book={book} />
}

function Entry({ book }: { book: Book }) {
  const isBook = Boolean(book.author || book.coverUrl || book.rating || book.startedAt || book.finishedAt)
  const hasNotes = book.summary.trim().length > 0

  // Table of contents: fixed sections plus the "## " headings inside the notes
  const toc = useMemo(() => {
    const items: { id: string; text: string }[] = []
    if (book.takeaways.length) items.push({ id: 'takeaways', text: 'Key takeaways' })
    if (hasNotes) {
      const hs = headingsOf(book.summary)
      if (hs.length) items.push(...hs)
      else items.push({ id: 'notes', text: 'Notes' })
    }
    if (book.quotes.length) items.push({ id: 'quotes', text: 'Quotes & highlights' })
    if (book.cards.length) items.push({ id: 'flashcards', text: 'Flashcards' })
    return items
  }, [book, hasNotes])

  const active = useActiveSection(toc.map((t) => t.id))
  const empty = !hasNotes && !book.takeaways.length && !book.quotes.length && !book.cards.length

  return (
    <div className="entry-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Library</Link>
        {book.group && (
          <>
            <span aria-hidden>/</span>
            <span>{book.group}</span>
          </>
        )}
      </nav>

      <header className="entry-header">
        <Cover book={book} size="lg" />
        <div className="grow">
          <h1>{book.title}</h1>
          <div className="entry-meta">
            {book.author && <span>{book.author}</span>}
            {book.rating ? <Stars value={book.rating} /> : null}
            {isBook && <span className={book.author ? 'dot' : ''}>{STATUS_LABELS[book.status]}</span>}
            {book.finishedAt && <span className="dot">finished {formatDate(book.finishedAt)}</span>}
            {book.tags.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
          <div className="entry-actions">
            {book.cards.length > 0 && (
              <Link to={`/books/${book.id}/study`} className="btn btn-primary btn-lg">
                <Icon name="cards" /> Study {book.cards.length} flashcard{book.cards.length === 1 ? '' : 's'}
              </Link>
            )}
            <Link to={`/books/${book.id}/edit`} className={`btn ${book.cards.length ? 'btn-lg' : 'btn-primary btn-lg'}`}>
              <Icon name="edit" /> Edit
            </Link>
          </div>
        </div>
      </header>

      <div className="entry-layout">
        <article>
          {book.takeaways.length > 0 && (
            <section id="takeaways" className="section takeaways-box">
              <h2 className="section-title">Key takeaways</h2>
              <ol className="takeaways">
                {book.takeaways.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            </section>
          )}

          {hasNotes && (
            <section id="notes" className="section">
              <div className="prose">
                <Markdown anchors>{book.summary}</Markdown>
              </div>
            </section>
          )}

          {book.quotes.length > 0 && (
            <section id="quotes" className="section">
              <h2>Quotes &amp; highlights</h2>
              {book.quotes.map((q, i) => (
                <figure key={i} className="quote">
                  <blockquote>{q.text}</blockquote>
                  {(q.page || q.note) && (
                    <figcaption className="small muted">
                      {q.page && `p. ${q.page}`}
                      {q.page && q.note && ' — '}
                      {q.note}
                    </figcaption>
                  )}
                </figure>
              ))}
            </section>
          )}

          {book.cards.length > 0 && (
            <section id="flashcards" className="section">
              <h2>Flashcards</h2>
              <details>
                <summary>
                  Show all {book.cards.length} questions and answers
                </summary>
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

          {empty && (
            <div className="panel panel-pad" style={{ textAlign: 'center' }}>
              <p className="muted">No notes yet.</p>
              <Link to={`/books/${book.id}/edit`} className="btn btn-primary">
                Write notes
              </Link>
            </div>
          )}
        </article>

        {toc.length > 2 && (
          <aside className="toc" aria-label="On this page">
            <div className="toc-title">On this page</div>
            <ol>
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className={active === t.id ? 'active' : ''}>
                    {t.text}
                  </a>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </div>
  )
}

/** Id of the section currently at the top of the viewport. */
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState('')
  const key = ids.join('|')

  useEffect(() => {
    if (!key) return
    const ids = key.split('|')

    function update() {
      // Look the sections up each time, in case the content re-rendered
      const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null)
      if (!els.length) return
      const offset = 120 // just below the sticky top bar
      let current = els[0].id
      for (const el of els) {
        if (el.getBoundingClientRect().top - offset <= 0) current = el.id
      }
      // At the very bottom, the last section is the one being read
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = els[els.length - 1].id
      setActive(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [key])

  return active
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
