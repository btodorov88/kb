import { useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { useBooks } from './api.ts'
import { migrateBrowserData } from './migrateBrowserData.ts'
import Icon from './components/Icon.tsx'
import Library from './pages/Library.tsx'
import BookView from './pages/BookView.tsx'
import BookEdit from './pages/BookEdit.tsx'
import Study from './pages/Study.tsx'

export default function App() {
  const { error } = useBooks()
  const [notice, setNotice] = useState('')
  const { pathname } = useLocation()

  useEffect(() => {
    migrateBrowserData().then((n) => {
      if (n > 0) setNotice(`Moved ${n} entr${n === 1 ? 'y' : 'ies'} from this browser into the database.`)
    })
  }, [])

  // Start each page at the top
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // Keep the top bar quiet while editing or studying
  const focused = pathname.endsWith('/edit') || pathname.endsWith('/study') || pathname === '/books/new'

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="Study Notes — library">
            <span className="brand-mark" aria-hidden>
              <Icon name="book" size={17} />
            </span>
            <span className="brand-text">Study Notes</span>
          </Link>
          <span className="spacer" />
          {!focused && (
            <Link to="/books/new" className="btn btn-primary">
              <Icon name="plus" size={16} /> New entry
            </Link>
          )}
        </div>
      </header>
      <main>
        {error && (
          <p className="banner error" role="alert">
            {error}. Is the API server running? (<code>npm run dev</code>)
          </p>
        )}
        {notice && (
          <p className="banner" role="status">
            <span className="grow">{notice}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setNotice('')}>
              Dismiss
            </button>
          </p>
        )}
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/books/new" element={<BookEdit />} />
          <Route path="/books/:id" element={<BookView />} />
          <Route path="/books/:id/edit" element={<BookEdit />} />
          <Route path="/books/:id/study" element={<Study />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  )
}

function NotFound() {
  return (
    <div className="empty">
      <h1>Page not found</h1>
      <Link to="/" className="btn">
        Back to library
      </Link>
    </div>
  )
}
