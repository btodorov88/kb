// Shared by the client (src/) and the API server (server/).

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

export interface Flashcard {
  front: string // question (Markdown)
  back: string // answer (Markdown)
}

/** A book or a study topic: both are the same kind of entry. */
export interface Book {
  id: number
  title: string
  author: string // author or source; may be empty for topics
  group?: string // e.g. "PhD exam"; entries without one are "Ungrouped"
  coverUrl?: string
  status: ReadingStatus
  rating?: number // 1-5
  startedAt?: string // yyyy-mm-dd
  finishedAt?: string // yyyy-mm-dd
  tags: string[]
  summary: string // Markdown
  takeaways: string[]
  quotes: Quote[]
  cards: Flashcard[]
  createdAt: number
  updatedAt: number
}

/** The editable part of a book: what the client sends when creating or updating. */
export type BookDraft = Omit<Book, 'id' | 'createdAt' | 'updatedAt'>

export interface ExportFile {
  version: 1
  exportedAt: string
  books: Book[]
}
