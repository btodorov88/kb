import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Markdown from '../components/Md.tsx'
import { useBook } from '../api.ts'
import Icon from '../components/Icon.tsx'

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
  const navigate = useNavigate()
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

  // Space/Enter: show answer, then next · ←/→: previous/next · Esc: leave
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return
      if (e.key === ' ' || e.key === 'Enter') {
        // A focused button/link handles Space/Enter itself; acting here too would skip a card
        if (e.target instanceof HTMLElement && e.target.closest('button, a')) return
        e.preventDefault()
        if (done) restart(shuffle)
        else if (flipped) go(1)
        else setFlipped(true)
      } else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Escape') navigate(`/books/${id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, done, go, restart, shuffle, navigate, id])

  if (book === undefined) return null
  if (book === null) {
    return (
      <div className="empty">
        <h1>Entry not found</h1>
        <Link to="/" className="btn">
          Back to library
        </Link>
      </div>
    )
  }

  if (count === 0) {
    return (
      <div className="empty">
        <div className="empty-icon" aria-hidden>
          🗂
        </div>
        <h1>No flashcards yet</h1>
        <p>Add questions and answers to “{book.title}” to study them here.</p>
        <Link to={`/books/${id}/edit`} className="btn btn-primary">
          Add flashcards
        </Link>
      </div>
    )
  }

  const card = book.cards[order[pos]]
  const shown = Math.min(pos + (flipped || done ? 1 : 0), count)

  return (
    <div className="study">
      <div className="study-top">
        <Link to={`/books/${id}`} className="btn btn-ghost btn-icon" aria-label="Exit study (Esc)" title="Exit (Esc)">
          <Icon name="close" />
        </Link>
        <div className="study-title">
          <div className="name" title={book.title}>
            {book.title}
          </div>
          {book.group && <div className="sub">{book.group}</div>}
        </div>
        <label className="switch" title="Shuffle the order of the cards">
          <input
            type="checkbox"
            checked={shuffle}
            onChange={(e) => {
              setShuffle(e.target.checked)
              restart(e.target.checked)
            }}
          />
          <Icon name="shuffle" size={16} /> Shuffle
        </label>
      </div>

      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={count}
        aria-valuenow={shown}
        aria-label="Cards seen"
      >
        <div style={{ width: `${(shown / count) * 100}%` }} />
      </div>
      <div className="progress-label">
        <span>{done ? 'Finished' : `Card ${pos + 1} of ${count}`}</span>
        {!done && pos > 0 && (
          <button className="link-btn small" onClick={() => restart(shuffle)}>
            Start over
          </button>
        )}
      </div>

      {done ? (
        <div className="flashcard study-done">
          <div className="big" aria-hidden>
            🎉
          </div>
          <h2>You went through all {count} cards</h2>
          <p className="muted">Go again to lock it in, or go back to the notes.</p>
          <div className="study-controls">
            <button className="btn btn-primary btn-lg" onClick={() => restart(shuffle)} autoFocus>
              <Icon name="restart" /> Go again
            </button>
            <Link to={`/books/${id}`} className="btn btn-lg">
              Back to notes
            </Link>
          </div>
        </div>
      ) : (
        card && (
          <>
            <button
              type="button"
              className="flashcard"
              onClick={() => (flipped ? go(1) : setFlipped(true))}
              aria-label={flipped ? 'Next card' : 'Show answer'}
              aria-live="polite"
            >
              <div className="side-label">Question</div>
              <div className="question prose">
                <Markdown>{card.front}</Markdown>
              </div>
              {flipped ? (
                <div className="answer">
                  <div className="side-label">Answer</div>
                  <div className="prose">
                    {card.back.trim() ? <Markdown>{card.back}</Markdown> : <p className="muted">(no answer written)</p>}
                  </div>
                </div>
              ) : (
                <div className="tap-hint">Think of the answer, then tap to reveal it</div>
              )}
            </button>

            <div className="study-controls">
              <button className="btn btn-lg" onClick={() => go(-1)} disabled={pos === 0}>
                <Icon name="back" /> Previous
              </button>
              {flipped ? (
                <button className="btn btn-primary btn-lg" onClick={() => go(1)}>
                  {pos + 1 === count ? 'Finish' : 'Next'} <Icon name="next" />
                </button>
              ) : (
                <button className="btn btn-primary btn-lg" onClick={() => setFlipped(true)}>
                  Show answer
                </button>
              )}
            </div>

            <div className="shortcuts" aria-hidden>
              <span>
                <kbd>Space</kbd> reveal / next
              </span>
              <span>
                <kbd>←</kbd> <kbd>→</kbd> move
              </span>
              <span>
                <kbd>Esc</kbd> exit
              </span>
            </div>
          </>
        )
      )}
    </div>
  )
}
