import { useSyncExternalStore } from 'react'
import type { Book, BookDraft } from './types.ts'

export * from './types.ts'

// --- HTTP ---------------------------------------------------------------

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Request failed (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

// --- Book list store ----------------------------------------------------
// The whole library is small, so the client keeps every book in memory and refetches after
// each change. Components read it with useBooks()/useBook().

interface State {
  books?: Book[]
  error?: string
}

let state: State = {}
let inflight: Promise<void> | undefined
const listeners = new Set<() => void>()

function setState(next: State) {
  state = next
  listeners.forEach((l) => l())
}

export function refreshBooks(): Promise<void> {
  inflight ??= request<Book[]>('GET', '/books')
    .then((books) => setState({ books }))
    .catch((err: Error) => setState({ ...state, error: `Can't reach the server: ${err.message}` }))
    .finally(() => (inflight = undefined))
  return inflight
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!state.books && !inflight) refreshBooks()
  return () => listeners.delete(listener)
}

export function useBooks(): State {
  return useSyncExternalStore(subscribe, () => state)
}

/** `undefined` while loading, `null` if there's no such book. */
export function useBook(id: number): Book | null | undefined {
  const { books } = useBooks()
  return books && (books.find((b) => b.id === id) ?? null)
}

// --- Mutations (each refreshes the store) -------------------------------

async function mutate<T>(p: Promise<T>): Promise<T> {
  const result = await p
  await refreshBooks()
  return result
}

export async function saveBook(draft: BookDraft, id?: number): Promise<number> {
  const book = await mutate(
    id === undefined ? request<Book>('POST', '/books', draft) : request<Book>('PUT', `/books/${id}`, draft),
  )
  return book.id
}

export const getBook = (id: number) => request<Book>('GET', `/books/${id}`)
export const deleteBook = (id: number) => mutate(request<void>('DELETE', `/books/${id}`))
export const exportJson = async () => JSON.stringify(await request('GET', '/export'), null, 2)
export const importBooks = (data: unknown) =>
  mutate(request<{ added: number; updated: number }>('POST', '/import', data))

// --- Helpers ------------------------------------------------------------

export function emptyDraft(): BookDraft {
  return {
    title: '',
    author: '',
    status: 'finished',
    tags: [],
    summary: '',
    takeaways: [],
    quotes: [],
    cards: [],
  }
}

/** True if the entry matches every word of the query (title, author, group, tags, notes, quotes, cards). */
export function matchesQuery(book: Book, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = [
    book.title,
    book.author,
    book.group ?? '',
    book.tags.join(' '),
    book.summary,
    book.takeaways.join(' '),
    book.quotes.map((q) => `${q.text} ${q.note ?? ''}`).join(' '),
    book.cards.map((c) => `${c.front} ${c.back}`).join(' '),
  ]
    .join(' ')
    .toLowerCase()
  return words.every((w) => haystack.includes(w))
}
