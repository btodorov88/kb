import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Markdown from '../components/Md.tsx'
import {
  deleteBook,
  emptyDraft,
  getBook,
  saveBook,
  STATUS_LABELS,
  useBooks,
  type BookDraft,
  type ReadingStatus,
} from '../api.ts'
import { searchBooks, type BookLookupResult } from '../openLibrary.ts'
import Stars from '../components/Stars.tsx'
import Cover from '../components/Cover.tsx'
import Icon from '../components/Icon.tsx'
import AutoTextarea from '../components/AutoTextarea.tsx'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export default function BookEdit() {
  const params = useParams()
  const id = params.id ? Number(params.id) : undefined
  const isNew = id === undefined
  const navigate = useNavigate()
  const { books } = useBooks()

  const [draft, setDraft] = useState<BookDraft | null>(isNew ? emptyDraft() : null)
  const [tagText, setTagText] = useState('')
  // Snapshot of the last saved state, for "unsaved changes"
  const [saved, setSaved] = useState(isNew ? JSON.stringify([emptyDraft(), '']) : '')
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [focusKey, setFocusKey] = useState('') // e.g. "card-3": focus that field after it's added

  const groups = [...new Set((books ?? []).map((b) => b.group).filter(Boolean))] as string[]
  const allTags = [...new Set((books ?? []).flatMap((b) => b.tags))]

  useEffect(() => {
    if (isNew) return
    getBook(id)
      .then((book) => {
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = book
        setDraft(rest)
        setTagText(book.tags.join(', '))
        setSaved(JSON.stringify([rest, book.tags.join(', ')]))
      })
      .catch(() => navigate('/', { replace: true }))
  }, [id, isNew, navigate])

  const dirty = draft !== null && saved !== '' && JSON.stringify([draft, tagText]) !== saved

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const formRef = useRef<HTMLFormElement>(null)

  // Ctrl/Cmd+S saves
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        formRef.current?.requestSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const set = useCallback(
    <K extends keyof BookDraft>(key: K, value: BookDraft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d)),
    [],
  )

  if (!draft) return null

  const isBook = Boolean(draft.author || draft.coverUrl || draft.rating || draft.startedAt || draft.finishedAt)
  const backTo = isNew ? '/' : `/books/${id}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft!.title.trim()) {
      setError('Add a title first.')
      document.getElementById('title')?.focus()
      return
    }
    setError('')
    setSaving(true)
    const tags = [...new Set(tagText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
    const cleaned: BookDraft = {
      ...draft!,
      title: draft!.title.trim(),
      author: draft!.author.trim(),
      group: draft!.group?.trim() || undefined,
      tags,
      takeaways: draft!.takeaways.map((t) => t.trim()).filter(Boolean),
      quotes: draft!.quotes.filter((q) => q.text.trim()),
      cards: draft!.cards
        .filter((c) => c.front.trim() || c.back.trim())
        .map((c) => ({ front: c.front.trim() || '?', back: c.back.trim() })),
    }
    try {
      const savedId = await saveBook(cleaned, id)
      setSaved(JSON.stringify([draft, tagText])) // so leaving doesn't warn
      navigate(`/books/${savedId}`)
    } catch (err) {
      setError(`Couldn't save: ${(err as Error).message}`)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete “${draft!.title}”? This removes its notes and flashcards and can't be undone.`)) return
    await deleteBook(id!)
    navigate('/')
  }

  function addCard(card = { front: '', back: '' }) {
    set('cards', [...draft!.cards, card])
    setFocusKey(`card-${draft!.cards.length}`)
  }

  function addTag(t: string) {
    const current = tagText.split(',').map((x) => x.trim()).filter(Boolean)
    if (!current.includes(t)) setTagText([...current, t].join(', '))
  }
  const currentTags = tagText.split(',').map((x) => x.trim().toLowerCase())
  const suggestedTags = allTags.filter((t) => !currentTags.includes(t)).slice(0, 8)

  return (
    <form ref={formRef} className="edit-form" onSubmit={handleSubmit} noValidate>
      <div>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Library</Link>
          {!isNew && (
            <>
              <span aria-hidden>/</span>
              <Link to={backTo} className="clamp-2" style={{ maxWidth: 480 }}>
                {saved ? JSON.parse(saved)[0].title : draft.title}
              </Link>
            </>
          )}
        </nav>
        <h1 style={{ margin: 0 }}>{isNew ? 'New entry' : 'Edit entry'}</h1>
      </div>

      {/* Basics */}
      <section className="panel panel-pad" aria-labelledby="basics-h">
        <h2 id="basics-h" className="sr-only">
          Basics
        </h2>
        <label className="field">
          <span className="label">Title</span>
          <input
            id="title"
            className="title-input"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Book title or topic, e.g. “Тема 6. IPv6 протокол”"
            autoFocus={isNew}
            aria-invalid={error === 'Add a title first.'}
          />
        </label>
        <div className="field-grid">
          <label className="field">
            <span className="label">
              Group <span className="hint">optional</span>
            </span>
            <input
              list="group-options"
              value={draft.group ?? ''}
              onChange={(e) => set('group', e.target.value || undefined)}
              placeholder="e.g. PhD exam"
            />
            <datalist id="group-options">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span className="label">
              Tags <span className="hint">comma separated</span>
            </span>
            <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="e.g. билет 1, мрежи" />
          </label>
        </div>
        {suggestedTags.length > 0 && (
          <div className="chips" aria-label="Add an existing tag">
            {suggestedTags.map((t) => (
              <button key={t} type="button" className="chip" onClick={() => addTag(t)}>
                + {t}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Notes */}
      <section className="panel panel-pad" aria-labelledby="notes-h">
        <div className="panel-header">
          <h2 id="notes-h">Notes</h2>
          <span className="spacer" />
          <div className="tabs" role="tablist" aria-label="Notes view">
            <button type="button" role="tab" aria-selected={tab === 'write'} onClick={() => setTab('write')}>
              Write
            </button>
            <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>
              Preview
            </button>
          </div>
        </div>
        <p className="panel-desc">
          Markdown: <code>## Heading</code> sections appear in the table of contents; also <code>**bold**</code>,{' '}
          <code>- lists</code>, tables and <code>```code```</code>.
        </p>
        {tab === 'write' ? (
          <AutoTextarea
            className="mono"
            rows={12}
            maxRows={100000} // grow fully: one page scroll instead of a box scrolling inside the page
            value={draft.summary}
            onChange={(e) => set('summary', e.target.value)}
            placeholder={'## 1. Introduction\n- main point\n- **important** detail'}
            aria-labelledby="notes-h"
          />
        ) : (
          <div className="prose preview">
            <Markdown>{draft.summary || '*Nothing written yet.*'}</Markdown>
          </div>
        )}
      </section>

      {/* Key takeaways */}
      <section className="panel panel-pad" aria-labelledby="takeaways-h">
        <div className="panel-header">
          <h2 id="takeaways-h">Key takeaways</h2>
        </div>
        <p className="panel-desc">The few ideas worth remembering above all else. Shown at the top of the entry.</p>
        {draft.takeaways.map((t, i) => (
          <div key={i} className="list-item">
            <span className="num">{i + 1}</span>
            <AutoTextarea
              rows={1}
              maxRows={6}
              className="grow"
              value={t}
              autoFocus={focusKey === `takeaway-${i}`}
              onChange={(e) => set('takeaways', draft.takeaways.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder="One key idea"
              aria-label={`Takeaway ${i + 1}`}
            />
            <div className="item-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Create a flashcard with this as the answer"
                disabled={!t.trim()}
                onClick={() => addCard({ front: '', back: t.trim() })}
              >
                <Icon name="cards" size={15} /> Card
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label={`Remove takeaway ${i + 1}`}
                onClick={() => set('takeaways', draft.takeaways.filter((_, j) => j !== i))}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm add-btn"
          onClick={() => {
            set('takeaways', [...draft.takeaways, ''])
            setFocusKey(`takeaway-${draft.takeaways.length}`)
          }}
        >
          <Icon name="plus" size={15} /> Add takeaway
        </button>
      </section>

      {/* Flashcards */}
      <section className="panel panel-pad" aria-labelledby="cards-h">
        <div className="panel-header">
          <h2 id="cards-h">Flashcards</h2>
          {draft.cards.length > 0 && <span className="chip">{draft.cards.length}</span>}
        </div>
        <p className="panel-desc">Question on the left, answer on the right. Both support Markdown.</p>
        {draft.cards.map((c, i) => {
          const update = (patch: Partial<typeof c>) =>
            set('cards', draft.cards.map((x, j) => (j === i ? { ...x, ...patch } : x)))
          return (
            <div key={i} className="list-item">
              <span className="num">{i + 1}</span>
              <div className="card-edit-sides">
                <AutoTextarea
                  rows={2}
                  maxRows={12}
                  value={c.front}
                  autoFocus={focusKey === `card-${i}`}
                  onChange={(e) => update({ front: e.target.value })}
                  placeholder="Question"
                  aria-label={`Card ${i + 1} question`}
                />
                <AutoTextarea
                  rows={2}
                  maxRows={12}
                  value={c.back}
                  onChange={(e) => update({ back: e.target.value })}
                  placeholder="Answer"
                  aria-label={`Card ${i + 1} answer`}
                />
              </div>
              <div className="item-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label={`Remove card ${i + 1}`}
                  onClick={() => set('cards', draft.cards.filter((_, j) => j !== i))}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>
          )
        })}
        <button type="button" className="btn btn-sm add-btn" onClick={() => addCard()}>
          <Icon name="plus" size={15} /> Add flashcard
        </button>
      </section>

      {/* Quotes */}
      <section className="panel panel-pad" aria-labelledby="quotes-h">
        <div className="panel-header">
          <h2 id="quotes-h">Quotes &amp; highlights</h2>
        </div>
        {draft.quotes.map((q, i) => {
          const update = (patch: Partial<typeof q>) =>
            set('quotes', draft.quotes.map((x, j) => (j === i ? { ...x, ...patch } : x)))
          return (
            <div key={i} className="list-item">
              <div className="quote-edit">
                <AutoTextarea
                  rows={2}
                  maxRows={10}
                  value={q.text}
                  autoFocus={focusKey === `quote-${i}`}
                  onChange={(e) => update({ text: e.target.value })}
                  placeholder="Quote"
                  aria-label={`Quote ${i + 1}`}
                />
                <div className="row">
                  <input
                    className="page"
                    value={q.page ?? ''}
                    onChange={(e) => update({ page: e.target.value || undefined })}
                    placeholder="Page"
                    aria-label={`Quote ${i + 1} page`}
                  />
                  <input
                    className="grow"
                    value={q.note ?? ''}
                    onChange={(e) => update({ note: e.target.value || undefined })}
                    placeholder="Your note (optional)"
                    aria-label={`Quote ${i + 1} note`}
                  />
                </div>
              </div>
              <div className="item-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label={`Remove quote ${i + 1}`}
                  onClick={() => set('quotes', draft.quotes.filter((_, j) => j !== i))}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>
          )
        })}
        <button
          type="button"
          className="btn btn-sm add-btn"
          onClick={() => {
            set('quotes', [...draft.quotes, { text: '' }])
            setFocusKey(`quote-${draft.quotes.length}`)
          }}
        >
          <Icon name="plus" size={15} /> Add quote
        </button>
      </section>

      {/* Book-only details, folded away for topics */}
      <details className="panel" open={isBook || undefined}>
        <summary>
          <h2>Book details</h2>
          <span className="muted small">author, cover, dates, rating</span>
        </summary>
        <div className="panel-body">
          {isNew && (
            <BookLookup
              onPick={(r) =>
                setDraft({ ...draft, title: r.title, author: r.author, coverUrl: r.coverUrl ?? draft.coverUrl })
              }
            />
          )}
          <div className="row top">
            <Cover book={draft} size="md" />
            <div className="field-grid grow">
              <label className="field">
                <span className="label">Author</span>
                <input value={draft.author} onChange={(e) => set('author', e.target.value)} />
              </label>
              <label className="field">
                <span className="label">Cover image URL</span>
                <input
                  type="url"
                  value={draft.coverUrl ?? ''}
                  onChange={(e) => set('coverUrl', e.target.value || undefined)}
                  placeholder="https://…"
                />
              </label>
            </div>
          </div>
          <div className="field-grid">
            <label className="field">
              <span className="label">Status</span>
              <select
                value={draft.status}
                onChange={(e) => set('status', e.target.value as ReadingStatus)}
                style={{ width: '100%' }}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Started</span>
              <input
                type="date"
                value={draft.startedAt ?? ''}
                onChange={(e) => set('startedAt', e.target.value || undefined)}
              />
            </label>
            <label className="field">
              <span className="label">Finished</span>
              <input
                type="date"
                value={draft.finishedAt ?? ''}
                onChange={(e) => set('finishedAt', e.target.value || undefined)}
              />
            </label>
            <div className="field">
              <span className="label">Rating</span>
              <Stars value={draft.rating} onChange={(v) => set('rating', v)} />
            </div>
          </div>
        </div>
      </details>

      {!isNew && (
        <section className="panel panel-pad danger-zone" aria-labelledby="danger-h">
          <div className="row wrap">
            <div className="grow">
              <h2 id="danger-h" style={{ fontSize: '1rem', margin: 0 }}>
                Delete this entry
              </h2>
              <p className="small muted" style={{ margin: 0 }}>
                Removes its notes, takeaways, quotes and flashcards for good.
              </p>
            </div>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              <Icon name="trash" size={16} /> Delete
            </button>
          </div>
        </section>
      )}

      <div className="save-bar">
        <div className="save-bar-inner">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create entry' : 'Save changes'}
          </button>
          <Link to={backTo} className="btn btn-ghost">
            Cancel
          </Link>
          <span className="spacer" />
          {error ? (
            <span className="error-text" role="alert">
              {error}
            </span>
          ) : (
            <span className="small muted" aria-live="polite">
              {dirty ? 'Unsaved changes · ' : ''}
              <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd> <kbd>S</kbd> to save
            </span>
          )}
        </div>
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
    <div className="field">
      <label className="field">
        <span className="label">
          Find a book <span className="hint">fills in title, author and cover from Open Library</span>
        </span>
        <span className="search">
          <Icon name="search" size={17} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or author…" />
        </span>
      </label>
      {state === 'loading' && <p className="small muted">Searching…</p>}
      {state === 'error' && <p className="small muted">Lookup failed. You can fill in the details by hand.</p>}
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
                  <span className="small muted">
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
