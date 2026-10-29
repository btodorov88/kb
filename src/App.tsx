import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { useBooks } from './api.ts'
import { migrateBrowserData } from './migrateBrowserData.ts'
import Library from './pages/Library.tsx'
import BookView from './pages/BookView.tsx'
import BookEdit from './pages/BookEdit.tsx'
import Review from './pages/Review.tsx'

export default function App() {
  const { error } = useBooks()
  const [notice, setNotice] = useState('')

  useEffect(() => {
    migrateBrowserData().then((n) => {
      if (n > 0) setNotice(`Moved ${n} book${n === 1 ? '' : 's'} from this browser into the database.`)
    })
  }, [])

  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          📚 Book Notes
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Library
          </NavLink>
          <NavLink to="/review">Review</NavLink>
          <NavLink to="/books/new" className="button primary">
            + Add book
          </NavLink>
        </nav>
      </header>
      <main>
        {error && <p className="banner error">{error}. Is the API server running? (npm run dev)</p>}
        {notice && (
          <p className="banner">
            {notice}{' '}
            <button className="link" onClick={() => setNotice('')}>
              Dismiss
            </button>
          </p>
        )}
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/review" element={<Review />} />
          <Route path="/books/new" element={<BookEdit />} />
          <Route path="/books/:id" element={<BookView />} />
          <Route path="/books/:id/edit" element={<BookEdit />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  )
}
