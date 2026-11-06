import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Markdown from '../components/Md.tsx'
import { emptyDraft, getBook, saveBook, STATUS_LABELS, useBooks, type BookDraft, type ReadingStatus } from '../api.ts'
import { searchBooks, type BookLookupResult } from '../openLibrary.ts'
import Stars from '../components/Stars.tsx'
import Cover from '../components/Cover.tsx'

export default function BookEdit() {
  const params = useParams()
  const id = params.id ? Number(params.id) : undefined
  const navigate = useNavigate()
  const [draft, setDraft] = useState<BookDraft | null>(id === undefined ? emptyDraft() : null)
  const [tagText, setTagText] = useState('')
  const [preview, setPreview] = useState(false)
  const [saveError, setSaveError] = useState('')
  const { books } = useBooks()
  const groups = [...new Set((books ?? []).map((b) => b.group).filter(Boolean))] as string[]

  useEffect(() => {
    if (id === undefined) return
    getBook(id)
      .then((book) => {
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = book
        setDraft(rest)
        setTagText(book.tags.join(', '))
      })
      .catch(() => navigate('/', { replace: true }))
  }, [id, navigate])

  if (!draft) return null

  const set = <K extends keyof BookDraft>(key: K, value: BookDraft[K]) => setDraft({ ...draft, [key]: value })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError('')
    const tags = [...new Set(tagText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
    const cleaned: BookDraft = {
      ...draft!,
      title: draft!.title.trim(),
      author: draft!.author.trim(),
      tags,
      takeaways: draft!.takeaways.map((t) => t.trim()).filter(Boolean),
      quotes: draft!.quotes.filter((q) => q.text.trim()),
      cards: draft!.cards.filter((c) => c.front.trim() || c.back.trim()).map((c) => ({ ...c, front: c.front.trim() || '?' })),
    }
    try {
      const savedId = await saveBook(cleaned, id)
      navigate(`/books/${savedId}`)
    } catch (err) {
      setSaveError(`Couldn't save: ${(err as Error).message}`)
    }
  }

  return (
    <form className="edit-form" onSubmit={handleSubmit}>
      <h1>{id === undefined ? 'Add a book or topic' : `Edit ${draft.title || 'entry'}`}</h1>

      {id === undefined && (
        <BookLookup
          onPick={(r) => setDraft({ ...draft, title: r.title, author: r.author, coverUrl: r.coverUrl ?? draft.coverUrl })}
        />
      )}

      <div className="row">
        <Cover book={draft} />
        <div className="grow fields">
          <label>
            Title
            <input required value={draft.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label>
            Author / source <span className="muted small">(optional)</span>
            <input value={draft.author} onChange={(e) => set('author', e.target.value)} />
          </label>
          <label>
            Group <span className="muted small">(e.g. PhD exam)</span>
            <input
              list="group-options"
              value={draft.group ?? ''}
              onChange={(e) => set('group', e.target.value || undefined)}
              placeholder="No group"
            />
            <datalist id="group-options">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <label>
            Cover image URL
            <input
              type="url"
              value={draft.coverUrl ?? ''}
              onChange={(e) => set('coverUrl', e.target.value || undefined)}
              placeholder="https://…"
            />
          </label>
        </div>
      </div>

      <div className="row wrap">
        <label>
          Status
          <select value={draft.status} onChange={(e) => set('status', e.target.value as ReadingStatus)}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Started
          <input type="date" value={draft.startedAt ?? ''} onChange={(e) => set('startedAt', e.target.value || undefined)} />
        </label>
        <label>
          Finished
          <input
            type="date"
            value={draft.finishedAt ?? ''}
            onChange={(e) => set('finishedAt', e.target.value || undefined)}
          />
        </label>
        <div className="label">
          Rating
          <Stars value={draft.rating} onChange={(v) => set('rating', v)} />
        </div>
      </div>

      <label>
        Tags <span className="muted small">(comma separated)</span>
        <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="productivity, psychology" />
      </label>

      <fieldset>
        <legend>Key takeaways</legend>
        <p className="muted small">The main ideas you most want to remember. These show up in Review.</p>
        {draft.takeaways.map((t, i) => (
          <div key={i} className="row">
            <input
              className="grow"
              value={t}
              onChange={(e) => set('takeaways', draft.takeaways.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Takeaway ${i + 1}`}
            />
            <button
              type="button"
              title="Add a flashcard with this as the answer"
              disabled={!t.trim()}
              onClick={() => set('cards', [...draft.cards, { front: '', back: t.trim() }])}
            >
              Make card
            </button>
            <button type="button" onClick={() => set('takeaways', draft.takeaways.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => set('takeaways', [...draft.takeaways, ''])}>
          + Add takeaway
        </button>
      </fieldset>

      <fieldset>
        <legend>
          Summary{' '}
          <button type="button" className="link small" onClick={() => setPreview(!preview)}>
            {preview ? 'Edit' : 'Preview'}
          </button>
        </legend>
        {preview ? (
          <div className="prose preview">
            <Markdown>{draft.summary || '*Nothing yet.*'}</Markdown>
          </div>
        ) : (
          <textarea
            rows={14}
            value={draft.summary}
            onChange={(e) => set('summary', e.target.value)}
            placeholder={'Supports Markdown:\n\n## Chapter 1\n- point one\n- **important** point'}
          />
        )}
      </fieldset>

      <fieldset>
        <legend>Quotes &amp; highlights</legend>
        {draft.quotes.map((q, i) => {
          const update = (patch: Partial<typeof q>) =>
            set('quotes', draft.quotes.map((x, j) => (j === i ? { ...x, ...patch } : x)))
          return (
            <div key={i} className="quote-edit">
              <textarea rows={3} value={q.text} onChange={(e) => update({ text: e.target.value })} placeholder="Quote" />
              <div className="row">
                <input
                  className="page"
                  value={q.page ?? ''}
                  onChange={(e) => update({ page: e.target.value || undefined })}
                  placeholder="Page"
                />
                <input
                  className="grow"
                  value={q.note ?? ''}
                  onChange={(e) => update({ note: e.target.value || undefined })}
                  placeholder="Your note (optional)"
                />
                <button type="button" onClick={() => set('quotes', draft.quotes.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            </div>
          )
        })}
        <button type="button" onClick={() => set('quotes', [...draft.quotes, { text: '' }])}>
          + Add quote
        </button>
      </fieldset>

      <fieldset>
        <legend>Flashcards</legend>
        <p className="muted small">Question on the front, answer on the back. Both support Markdown.</p>
        {draft.cards.map((c, i) => {
          const update = (patch: Partial<typeof c>) =>
            set('cards', draft.cards.map((x, j) => (j === i ? { ...x, ...patch } : x)))
          return (
            <div key={i} className="card-edit">
              <span className="muted small card-num">{i + 1}</span>
              <textarea rows={2} value={c.front} onChange={(e) => update({ front: e.target.value })} placeholder="Question" />
              <textarea rows={2} value={c.back} onChange={(e) => update({ back: e.target.value })} placeholder="Answer" />
              <button type="button" onClick={() => set('cards', draft.cards.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          )
        })}
        <button type="button" onClick={() => set('cards', [...draft.cards, { front: '', back: '' }])}>
          + Add flashcard
        </button>
      </fieldset>

      <div className="actions sticky">
        <button type="submit" className="primary">
          Save
        </button>
        <Link to={id === undefined ? '/' : `/books/${id}`} className="button">
          Cancel
        </Link>
        {saveError && <span className="error-text">{saveError}</span>}
      </div>
    </form>
  )
}

function BookLookup({ onPick }: { onPick: (r: BookLookupResult) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<BookLookupResult[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  // Debounced search as you type
  useEffect(() => {
    if (q.trim().length < 3) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setState('loading')
      try {
        setResults(await searchBooks(q, ctrl.signal))
        setState('idle')
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setState('error')
      }
    }, 400)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q])

  return (
    <div className="lookup">
      <label>
        Find book details <span className="muted small">(via Open Library — optional, skip for topics)</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or author…" />
      </label>
      {state === 'loading' && <p className="muted small">Searching…</p>}
      {state === 'error' && <p className="muted small">Lookup failed. You can fill in the details by hand.</p>}
      {q.trim().length >= 3 && results.length > 0 && (
        <ul className="lookup-results">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onPick(r)
                  setResults([])
                  setQ('')
                }}
              >
                <Cover book={r} size="sm" />
                <span>
                  <strong>{r.title}</strong>
                  <br />
                  <span className="muted small">
                    {r.author}
                    {r.year && ` · ${r.year}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
