import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportJson, importJson, matchesQuery, STATUS_LABELS, type ReadingStatus } from '../db.ts'
import Cover from '../components/Cover.tsx'
import Stars from '../components/Stars.tsx'

type SortKey = 'updated' | 'title' | 'rating' | 'finished'

export default function Library() {
  const books = useLiveQuery(() => db.books.toArray())
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [status, setStatus] = useState<ReadingStatus | ''>('')
  const [sort, setSort] = useState<SortKey>('updated')
  const [message, setMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const allTags = useMemo(
    () => [...new Set((books ?? []).flatMap((b) => b.tags))].sort((a, b) => a.localeCompare(b)),
    [books],
  )

  const visible = useMemo(() => {
    const list = (books ?? []).filter(
      (b) => (!tag || b.tags.includes(tag)) && (!status || b.status === status) && matchesQuery(b, query),
    )
    const sorters: Record<SortKey, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      updated: (a, b) => b.updatedAt - a.updatedAt,
      title: (a, b) => a.title.localeCompare(b.title),
      rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
      finished: (a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''),
    }
    return list.sort(sorters[sort])
  }, [books, query, tag, status, sort])

  async function handleExport() {
    const blob = new Blob([await exportJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `book-notes-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function handleImport(file: File) {
    try {
      const count = await importJson(await file.text())
      setMessage(`Imported ${count} book${count === 1 ? '' : 's'}.`)
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`)
    }
  }

  if (!books) return null

  if (books.length === 0) {
    return (
      <div className="empty">
        <h1>Your library is empty</h1>
        <p>Add the first book you want to remember.</p>
        <Link to="/books/new" className="button primary">
          + Add book
        </Link>
        <p className="muted small">
          Have a backup?{' '}
          <button className="link" onClick={() => fileInput.current?.click()}>
            Import it
          </button>
        </p>
        <HiddenFileInput inputRef={fileInput} onFile={handleImport} />
        {message && <p className="muted">{message}</p>}
      </div>
    )
  }

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search titles, summaries, quotes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="grow"
          autoFocus
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as ReadingStatus | '')}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="updated">Recently edited</option>
          <option value="finished">Recently finished</option>
          <option value="title">Title A–Z</option>
          <option value="rating">Highest rated</option>
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="tags">
          <button className={`tag ${tag === '' ? 'active' : ''}`} onClick={() => setTag('')}>
            All
          </button>
          {allTags.map((t) => (
            <button key={t} className={`tag ${tag === t ? 'active' : ''}`} onClick={() => setTag(tag === t ? '' : t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      <p className="muted small">
        {visible.length} of {books.length} books
      </p>

      <ul className="book-grid">
        {visible.map((b) => (
          <li key={b.id}>
            <Link to={`/books/${b.id}`} className="book-card">
              <Cover book={b} />
              <div>
                <strong>{b.title}</strong>
                <div className="muted">{b.author}</div>
                <Stars value={b.rating} />
                {b.takeaways[0] && <p className="small clamp">{b.takeaways[0]}</p>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <footer className="backup">
        <span className="muted small">Your notes are stored in this browser only. Export regularly as a backup.</span>
        <div>
          <button onClick={handleExport}>Export</button>
          <button onClick={() => fileInput.current?.click()}>Import</button>
        </div>
        <HiddenFileInput inputRef={fileInput} onFile={handleImport} />
        {message && <p className="muted small">{message}</p>}
      </footer>
    </>
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
