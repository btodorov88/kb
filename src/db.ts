import Dexie, { type EntityTable } from 'dexie'

export type ReadingStatus = 'want' | 'reading' | 'finished' | 'abandoned'

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  want: 'Want to read',
  reading: 'Reading',
  finished: 'Finished',
  abandoned: 'Abandoned',
}

export interface Quote {
  text: string
  page?: string
  note?: string
}

export interface Book {
  id: number
  title: string
  author: string
  coverUrl?: string
  status: ReadingStatus
  rating?: number // 1-5
  startedAt?: string // yyyy-mm-dd
  finishedAt?: string // yyyy-mm-dd
  tags: string[]
  summary: string // Markdown
  takeaways: string[]
  quotes: Quote[]
  createdAt: number
  updatedAt: number
  lastReviewedAt?: number
}

export type BookDraft = Omit<Book, 'id' | 'createdAt' | 'updatedAt'>

// All data lives in the browser (IndexedDB). Use Export on the library page for backups.
export const db = new Dexie('book-notes') as Dexie & {
  books: EntityTable<Book, 'id'>
}

db.version(1).stores({
  books: '++id, title, author, status, *tags, updatedAt, lastReviewedAt',
})

export function emptyDraft(): BookDraft {
  return {
    title: '',
    author: '',
    status: 'finished',
    tags: [],
    summary: '',
    takeaways: [],
    quotes: [],
  }
}

export async function saveBook(draft: BookDraft, id?: number): Promise<number> {
  const now = Date.now()
  if (id !== undefined) {
    await db.books.update(id, { ...draft, updatedAt: now })
    return id
  }
  return db.books.add({ ...draft, createdAt: now, updatedAt: now } as Book)
}

export async function markReviewed(id: number) {
  await db.books.update(id, { lastReviewedAt: Date.now() })
}

/** True if the book matches every word of the query (title, author, tags, summary, takeaways, quotes). */
export function matchesQuery(book: Book, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = [
    book.title,
    book.author,
    book.tags.join(' '),
    book.summary,
    book.takeaways.join(' '),
    book.quotes.map((q) => `${q.text} ${q.note ?? ''}`).join(' '),
  ]
    .join(' ')
    .toLowerCase()
  return words.every((w) => haystack.includes(w))
}

export async function exportJson(): Promise<string> {
  const books = await db.books.toArray()
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), books }, null, 2)
}

/** Replaces books with matching ids and adds the rest. Returns how many were imported. */
export async function importJson(text: string): Promise<number> {
  const data = JSON.parse(text)
  const books: Book[] = Array.isArray(data) ? data : data.books
  if (!Array.isArray(books)) throw new Error('No books found in file')
  await db.books.bulkPut(books)
  return books.length
}
