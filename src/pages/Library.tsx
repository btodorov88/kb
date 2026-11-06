import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { exportJson, importBooks, matchesQuery, useBooks, type Book } from '../api.ts'
import Cover from '../components/Cover.tsx'
import Stars from '../components/Stars.tsx'
import Icon from '../components/Icon.tsx'

type SortKey = 'title' | 'updated' | 'rating'

const SORT_LABELS: Record<SortKey, string> = {
  title: 'Title (A–Z)',
  updated: 'Recently edited',
  rating: 'Highest rated',
}

// Numeric-aware, so "Тема 6" comes before "Тема 14"
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const SORTERS: Record<SortKey, (a: Book, b: Book) => number> = {
  title: (a, b) => collator.compare(a.title, b.title),
  updated: (a, b) => b.updatedAt - a.updatedAt,
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || collator.compare(a.title, b.title),
}

// Remember the viewer's sort choice between visits (a convenience, so failures are ignored)
function loadSort(): SortKey {
  try {
    const v = localStorage.getItem('library.sort')
    if (v && v in SORT_LABELS) return v as SortKey
  } catch {
    /* storage unavailable */
  }
  return 'title'
}
function saveSort(v: SortKey) {
  try {
    localStorage.setItem('library.sort', v)
  } catch {
    /* storage unavailable */
  }
}

export default function Library() {
  const { books } = useBooks()
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [group, setGroup] = useState('')
  const [sort, setSort] = useState<SortKey>(loadSort)
  const [message, setMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const allGroups = useMemo(
    () => [...new Set((books ?? []).map((b) => b.group).filter((g): g is string => Boolean(g)))].sort(collator.compare),
    [books],
  )
  const allTags = useMemo(
    () =>
      [...new Set((books ?? []).filter((b) => !group || b.group === group).flatMap((b) => b.tags))].sort(
        collator.compare,
      ),
    [books, group],
  )

  const visible = useMemo(
    () =>
      (books ?? [])
        .filter((b) => (!group || b.group === group) && (!tag || b.tags.includes(tag)) && matchesQuery(b, query))
        .sort(SORTERS[sort]),
    [books, query, group, tag, sort],
  )

  // Named groups alphabetically, ungrouped entries last
  const sections = useMemo(() => {
    const map = new Map<string, Book[]>()
    for (const b of visible) map.set(b.group ?? '', [...(map.get(b.group ?? '') ?? []), b])
    return [...map].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : collator.compare(a, b)))
  }, [visible])

  const filtered = Boolean(query || tag || group)
  const clearFilters = () => {
    setQuery('')
    setTag('')
    setGroup('')
  }

  async function handleExport() {
    const blob = new Blob([await exportJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `study-notes-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function handleImport(file: File) {
    try {
      const { added, updated } = await importBooks(JSON.parse(await file.text()))
      setMessage(`Import done: ${added} added, ${updated} updated.`)
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`)
    }
  }

  if (!books) return null

  if (books.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon" aria-hidden>
          📚
        </div>
        <h1>Your library is empty</h1>
        <p>Add a book you've read or a topic you're studying. You can write notes and flashcards for each one.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/books/new" className="btn btn-primary">
            <Icon name="plus" size={16} /> New entry
          </Link>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={16} /> Import backup
          </button>
        </div>
        <HiddenFileInput inputRef={fileInput} onFile={handleImport} />
        {message && <p className="small muted" style={{ marginTop: 16 }}>{message}</p>}
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <h1>Library</h1>
        <span className="muted small" style={{ paddingBottom: 4 }}>
          {books.length} entr{books.length === 1 ? 'y' : 'ies'} ·{' '}
          {books.reduce((n, b) => n + b.cards.length, 0)} flashcards
        </span>
      </div>

      <div className="toolbar" role="search">
        <label className="search">
          <span className="sr-only">Search</span>
          <Icon name="search" size={17} />
          <input
            type="search"
            placeholder="Search titles, notes, quotes and flashcards…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {allGroups.length > 0 && (
          <select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value)
              setTag('')
            }}
            aria-label="Filter by group"
          >
            <option value="">All groups</option>
            {allGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SortKey)
            saveSort(e.target.value as SortKey)
          }}
          aria-label="Sort by"
        >
          {Object.entries(SORT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="chips" aria-label="Filter by tag" style={{ marginBottom: 6 }}>
          {allTags.map((t) => (
            <button
              key={t}
              className={`chip ${tag === t ? 'active' : ''}`}
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? '' : t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered && (
        <div className="toolbar-meta small muted">
          <span aria-live="polite">
            {visible.length} of {books.length} shown
          </span>
          <button className="link-btn small" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty">
          <h2>No matches</h2>
          <p>Nothing matches your search or filters.</p>
          <button className="btn" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        sections.map(([name, list]) => (
          <section key={name} className="group-section" aria-label={name || 'Ungrouped'}>
            {(allGroups.length > 0 || sections.length > 1) && (
              <h2 className="group-heading">
                {name || 'Ungrouped'} <span className="count">{list.length}</span>
              </h2>
            )}
            <ul className="entry-grid">
              {list.map((b) => (
                <li key={b.id}>
                  <EntryCard book={b} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <footer className="backup">
        <span className="muted small">
          Saved in <code>data/book-notes.db</code>. Export a JSON copy as a backup.
        </span>
        <div className="row">
          <button className="btn btn-sm" onClick={handleExport}>
            <Icon name="download" size={15} /> Export
          </button>
          <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={15} /> Import
          </button>
        </div>
        <HiddenFileInput inputRef={fileInput} onFile={handleImport} />
        {message && (
          <p className="small muted" role="status" style={{ width: '100%', margin: 0 }}>
            {message}
          </p>
        )}
      </footer>
    </>
  )
}

function EntryCard({ book: b }: { book: Book }) {
  const snippet = b.takeaways[0] ?? b.author
  return (
    <article className="entry-card">
      <Cover book={b} />
      <div className="entry-body">
        <Link to={`/books/${b.id}`} className="entry-title clamp-3">
          {b.title}
        </Link>
        {b.author && b.takeaways[0] && <div className="entry-sub">{b.author}</div>}
        {b.rating ? <Stars value={b.rating} /> : null}
        {snippet && <p className="entry-snippet clamp-2">{snippet}</p>}
        <div className="entry-footer">
          <div className="chips grow" style={{ overflow: 'hidden', flexWrap: 'nowrap' }}>
            {b.tags.slice(0, 2).map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
          {b.cards.length > 0 && (
            <Link
              to={`/books/${b.id}/study`}
              className="btn btn-sm"
              aria-label={`Study ${b.cards.length} flashcards: ${b.title}`}
            >
              <Icon name="cards" size={15} /> Study {b.cards.length}
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}

function HiddenFileInput({
  inputRef,
  onFile,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  onFile: (f: File) => void
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="application/json,.json"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) onFile(f)
        e.target.value = ''
      }}
    />
  )
}
