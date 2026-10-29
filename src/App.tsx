import { NavLink, Route, Routes } from 'react-router-dom'
import Library from './pages/Library.tsx'
import BookView from './pages/BookView.tsx'
import BookEdit from './pages/BookEdit.tsx'
import Review from './pages/Review.tsx'

export default function App() {
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
