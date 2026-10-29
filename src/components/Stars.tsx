interface Props {
  value?: number
  onChange?: (value: number | undefined) => void
}

/** Read-only when onChange is missing. Clicking the current rating clears it. */
export default function Stars({ value = 0, onChange }: Props) {
  if (!onChange) {
    if (!value) return null
    return <span className="stars" aria-label={`${value} out of 5`}>{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>
  }
  return (
    <span className="stars editable" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(value === n ? undefined : n)}
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </span>
  )
}
