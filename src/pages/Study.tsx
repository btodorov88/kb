import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import { useBook } from '../api.ts'

function shuffled(n: number): number[] {
  const order = [...Array(n).keys()]
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** Goes through every flashcard of one entry. Nothing is recorded. */
export default function Study() {
  const id = Number(useParams().id)
  const book = useBook(id)
  const count = book?.cards.length ?? 0

  const [shuffle, setShuffle] = useState(true)
  const [order, setOrder] = useState<number[]>([])
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const restart = useCallback(
    (doShuffle: boolean) => {
      setOrder(doShuffle ? shuffled(count) : [...Array(count).keys()])
      setPos(0)
      setFlipped(false)
    },
    [count],
  )

  // Start a fresh round once the cards load, or if the number of cards changes
  const [startedFor, setStartedFor] = useState(-1)
  if (book && startedFor !== count) {
    setStartedFor(count)
    restart(shuffle)
  }

  const done = count > 0 && pos >= count
  const go = useCallback(
    (delta: number) => {
      setPos((p) => Math.min(Math.max(p + delta, 0), count))
      setFlipped(false)
    },
    [count],
  )

  // Keyboard: Space/Enter flips (or goes on once flipped), ← → move between cards
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, button')) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (done) return
        if (flipped) go(1)
        else setFlipped(true)
      } else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, done, go])

  if (book === undefined) return null
  if (book === null) return <p>Not found. <Link to="/">Back to library</Link></p>

  if (count === 0) {
    return (
      <div className="empty">
        <h1>No flashcards yet</h1>
        <p>{book.title} doesn't have any cards.</p>
        <Link to={`/books/${id}/edit`} className="button primary">
          Add flashcards
        </Link>
      </div>
    )
  }

  const card = book.cards[order[pos]]

  return (
    <div className="study">
      <header className="study-header">
        <div>
          <Link to={`/books/${id}`} className="small">
            ← {book.title}
          </Link>
          {book.group && <span className="muted small"> · {book.group}</span>}
        </div>
        <label className="small muted check">
          <input
            type="checkbox"
            checked={shuffle}
            onChange={(e) => {
              setShuffle(e.target.checked)
              restart(e.target.checked)
            }}
          />
          Shuffle
        </label>
      </header>

      <div className="progress" aria-hidden>
        <div style={{ width: `${(Math.min(pos, count) / count) * 100}%` }} />
      </div>

      {done ? (
        <div className="flashcard done">
          <h2>All {count} cards done</h2>
          <div className="actions center">
            <button className="primary" onClick={() => restart(shuffle)}>
              Go again
            </button>
            <Link to={`/books/${id}`} className="button">
              Back to notes
            </Link>
          </div>
        </div>
      ) : (
        card && (
          <>
            <p className="muted small center">
              Card {pos + 1} of {count}
            </p>
            <button
              type="button"
              className={`flashcard ${flipped ? 'flipped' : ''}`}
              onClick={() => (flipped ? go(1) : setFlipped(true))}
              aria-label={flipped ? 'Next card' : 'Show answer'}
            >
              <div className="side prose">
                <Markdown>{card.front}</Markdown>
              </div>
              {flipped ? (
                <div className="side answer prose">
                  {card.back.trim() ? <Markdown>{card.back}</Markdown> : <p className="muted">(no answer written)</p>}
                </div>
              ) : (
                <p className="hint muted small">Click or press Space to show the answer</p>
              )}
            </button>
            <div className="actions center">
              <button onClick={() => go(-1)} disabled={pos === 0}>
                ← Previous
              </button>
              {flipped ? (
                <button className="primary" onClick={() => go(1)}>
                  Next →
                </button>
              ) : (
                <button className="primary" onClick={() => setFlipped(true)}>
                  Show answer
                </button>
              )}
            </div>
          </>
        )
      )}
    </div>
  )
}
