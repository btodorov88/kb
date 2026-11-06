import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { exportJson, importBooks, matchesQuery, STATUS_LABELS, useBooks, type Book, type ReadingStatus } from '../api.ts'
import Cover from '../components/Cover.tsx'
import Stars from '../components/Stars.tsx'

type SortKey = 'updated' | 'title' | 'rating' | 'finished'

export default function Library() {
  const { books } = useBooks()
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [group, setGroup] = useState('')
  const [status, setStatus] = useState<ReadingStatus | ''>('')
  const [sort, setSort] = useState<SortKey>('updated')
  const [message, setMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const allTags = useMemo(
    () => [...new Set((books ?? []).flatMap((b) => b.tags))].sort((a, b) => a.localeCompare(b)),
    [books],
  )

  const allGroups = useMemo(
    () => [...new Set((books ?? []).map((b) => b.group).filter(Boolean))].sort() as string[],
    [books],
  )

  const visible = useMemo(() => {
    const list = (books ?? []).filter(
      (b) =>
        (!group || (b.group ?? '') === group) &&
        (!tag || b.tags.includes(tag)) &&
        (!status || b.status === status) &&
        matchesQuery(b, query),
    )
    const sorters: Record<SortKey, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      updated: (a, b) => b.updatedAt - a.updatedAt,
      title: (a, b) => a.title.localeCompare(b.title),
      rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
      finished: (a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''),
    }
    return list.sort(sorters[sort])
  }, [books, query, group, tag, status, sort])

  // Named groups alphabetically, ungrouped entries last
  const sections = useMemo(() => {
    const map = new Map<string, Book[]>()
    for (const b of visible) map.set(b.group ?? '', [...(map.get(b.group ?? '') ?? []), b])
    return [...map].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
  }, [visible])
  const showHeadings = allGroups.length > 0

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
        <h1>Your library is empty</h1>
        <p>Add a book you've read or a topic you're studying.</p>
        <Link to="/books/new" className="button primary">
          + Add
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
        {allGroups.length > 0 && (
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">
            <option value="">All groups</option>
            {allGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
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
        {visible.length} of {books.length} entries
      </p>

      {sections.map(([name, list]) => (
        <section key={name} className="group-section">
          {showHeadings && (
            <h2 className="group-heading">
              {name || 'Ungrouped'} <span className="muted small">{list.length}</span>
            </h2>
          )}
          <ul className="book-grid">
            {list.map((b) => (
              <li key={b.id}>
                <Link to={`/books/${b.id}`} className="book-card">
                  <Cover book={b} />
                  <div>
                    <strong>{b.title}</strong>
                    {b.author && <div className="muted">{b.author}</div>}
                    <Stars value={b.rating} />
                    {b.takeaways[0] && <p className="small clamp">{b.takeaways[0]}</p>}
                    {b.cards.length > 0 && (
                      <p className="small muted">
                        🗂 {b.cards.length} flashcard{b.cards.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="backup">
        <span className="muted small">Notes are saved in data/book-notes.db. Export makes a portable JSON backup.</span>
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
