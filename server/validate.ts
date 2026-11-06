import { STATUS_LABELS, type Book, type BookDraft, type Flashcard, type Quote, type ReadingStatus } from '../src/types.ts'

export class ValidationError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function str(v: unknown, field: string, { required = false, max = 200_000 } = {}): string | undefined {
  if (v === undefined || v === null || v === '') {
    if (required) throw new ValidationError(`${field} is required`)
    return undefined
  }
  if (typeof v !== 'string') throw new ValidationError(`${field} must be a string`)
  if (v.length > max) throw new ValidationError(`${field} is too long`)
  return v
}

function strArray(v: unknown, field: string): string[] {
  if (v === undefined) return []
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
    throw new ValidationError(`${field} must be a list of strings`)
  }
  return v
}

function num(v: unknown, field: string): number | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ValidationError(`${field} must be a number`)
  return v
}

/** Checks a request body and returns a clean BookDraft (unknown fields are dropped). */
export function parseDraft(body: unknown): BookDraft {
  if (!isObj(body)) throw new ValidationError('Expected a JSON object')

  const status = (body.status ?? 'finished') as ReadingStatus
  if (!(status in STATUS_LABELS)) throw new ValidationError('status is invalid')

  const rating = num(body.rating, 'rating')
  if (rating !== undefined && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    throw new ValidationError('rating must be 1-5')
  }

  if (body.quotes !== undefined && !Array.isArray(body.quotes)) throw new ValidationError('quotes must be a list')
  const quotes: Quote[] = ((body.quotes as unknown[]) ?? []).map((q, i) => {
    if (!isObj(q)) throw new ValidationError(`quotes[${i}] must be an object`)
    return {
      text: str(q.text, `quotes[${i}].text`, { required: true })!,
      page: str(q.page, `quotes[${i}].page`, { max: 50 }),
      note: str(q.note, `quotes[${i}].note`),
    }
  })

  if (body.cards !== undefined && !Array.isArray(body.cards)) throw new ValidationError('cards must be a list')
  const cards: Flashcard[] = ((body.cards as unknown[]) ?? []).map((c, i) => {
    if (!isObj(c)) throw new ValidationError(`cards[${i}] must be an object`)
    return {
      front: str(c.front, `cards[${i}].front`, { required: true })!,
      back: str(c.back, `cards[${i}].back`) ?? '',
    }
  })

  return {
    title: str(body.title, 'title', { required: true, max: 500 })!.trim(),
    author: str(body.author, 'author', { max: 500 })?.trim() ?? '',
    group: str(body.group, 'group', { max: 200 })?.trim() || undefined,
    coverUrl: str(body.coverUrl, 'coverUrl', { max: 2000 }),
    status,
    rating,
    startedAt: str(body.startedAt, 'startedAt', { max: 10 }),
    finishedAt: str(body.finishedAt, 'finishedAt', { max: 10 }),
    tags: strArray(body.tags, 'tags'),
    summary: str(body.summary, 'summary') ?? '',
    takeaways: strArray(body.takeaways, 'takeaways'),
    quotes,
    cards,
    lastReviewedAt: num(body.lastReviewedAt, 'lastReviewedAt'),
  }
}

/** Accepts either an export file ({books: [...]}) or a bare array of books. */
export function parseImport(body: unknown): Book[] {
  const list = Array.isArray(body) ? body : isObj(body) ? body.books : undefined
  if (!Array.isArray(list)) throw new ValidationError('No books found in file')
  return list.map((b, i) => {
    try {
      const draft = parseDraft(b)
      const rec = b as Record<string, unknown>
      const now = Date.now()
      return {
        ...draft,
        id: num(rec.id, 'id') ?? -1,
        createdAt: num(rec.createdAt, 'createdAt') ?? now,
        updatedAt: num(rec.updatedAt, 'updatedAt') ?? now,
      }
    } catch (err) {
      throw new ValidationError(`Book ${i + 1}: ${(err as Error).message}`)
    }
  })
}
