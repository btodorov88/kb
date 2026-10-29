import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Book, BookDraft, ReadingStatus } from '../src/types.ts'

const DB_PATH = process.env.DB_PATH ?? path.resolve(import.meta.dirname, '../data/book-notes.db')
mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new DatabaseSync(DB_PATH)
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS books (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT    NOT NULL,
    author           TEXT    NOT NULL DEFAULT '',
    cover_url        TEXT,
    status           TEXT    NOT NULL DEFAULT 'finished',
    rating           INTEGER,
    started_at       TEXT,
    finished_at      TEXT,
    tags             TEXT    NOT NULL DEFAULT '[]', -- JSON array of strings
    summary          TEXT    NOT NULL DEFAULT '',   -- Markdown
    takeaways        TEXT    NOT NULL DEFAULT '[]', -- JSON array of strings
    quotes           TEXT    NOT NULL DEFAULT '[]', -- JSON array of {text, page?, note?}
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    last_reviewed_at INTEGER
  );
`)

export { DB_PATH }

type Row = Record<string, string | number | null>

function fromRow(r: Row): Book {
  return {
    id: r.id as number,
    title: r.title as string,
    author: r.author as string,
    coverUrl: (r.cover_url as string) ?? undefined,
    status: r.status as ReadingStatus,
    rating: (r.rating as number) ?? undefined,
    startedAt: (r.started_at as string) ?? undefined,
    finishedAt: (r.finished_at as string) ?? undefined,
    tags: JSON.parse(r.tags as string),
    summary: r.summary as string,
    takeaways: JSON.parse(r.takeaways as string),
    quotes: JSON.parse(r.quotes as string),
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
    lastReviewedAt: (r.last_reviewed_at as number) ?? undefined,
  }
}

function toParams(d: BookDraft) {
  return {
    title: d.title,
    author: d.author,
    cover_url: d.coverUrl ?? null,
    status: d.status,
    rating: d.rating ?? null,
    started_at: d.startedAt ?? null,
    finished_at: d.finishedAt ?? null,
    tags: JSON.stringify(d.tags),
    summary: d.summary,
    takeaways: JSON.stringify(d.takeaways),
    quotes: JSON.stringify(d.quotes),
    last_reviewed_at: d.lastReviewedAt ?? null,
  }
}

const COLUMNS =
  'title, author, cover_url, status, rating, started_at, finished_at, tags, summary, takeaways, quotes, last_reviewed_at'
const VALUES = COLUMNS.split(', ').map((c) => `:${c}`).join(', ')
const SET = COLUMNS.split(', ').map((c) => `${c} = :${c}`).join(', ')

const stmts = {
  list: db.prepare('SELECT * FROM books ORDER BY updated_at DESC'),
  get: db.prepare('SELECT * FROM books WHERE id = ?'),
  insert: db.prepare(
    `INSERT INTO books (${COLUMNS}, created_at, updated_at) VALUES (${VALUES}, :created_at, :updated_at)`,
  ),
  update: db.prepare(`UPDATE books SET ${SET}, updated_at = :updated_at WHERE id = :id`),
  restore: db.prepare(`UPDATE books SET ${SET}, updated_at = :updated_at WHERE id = :id AND created_at = :created_at`),
  remove: db.prepare('DELETE FROM books WHERE id = ?'),
  reviewed: db.prepare('UPDATE books SET last_reviewed_at = ? WHERE id = ?'),
}

export function listBooks(): Book[] {
  return (stmts.list.all() as Row[]).map(fromRow)
}

export function getBook(id: number): Book | undefined {
  const row = stmts.get.get(id) as Row | undefined
  return row && fromRow(row)
}

export function createBook(d: BookDraft, createdAt = Date.now(), updatedAt = Date.now()): Book {
  const { lastInsertRowid } = stmts.insert.run({ ...toParams(d), created_at: createdAt, updated_at: updatedAt })
  return getBook(Number(lastInsertRowid))!
}

export function updateBook(id: number, d: BookDraft): Book | undefined {
  const { changes } = stmts.update.run({ ...toParams(d), id, updated_at: Date.now() })
  return changes ? getBook(id) : undefined
}

export function deleteBook(id: number): boolean {
  return stmts.remove.run(id).changes > 0
}

export function markReviewed(id: number): Book | undefined {
  const { changes } = stmts.reviewed.run(Date.now(), id)
  return changes ? getBook(id) : undefined
}

/**
 * Restores books from a backup. A book whose id and createdAt match an existing row is the
 * same book, so it's overwritten. Anything else is added as a new book, so importing never
 * clobbers an unrelated book that happens to share an id.
 */
export function importBooks(books: Book[]): { updated: number; added: number } {
  let updated = 0
  let added = 0
  db.exec('BEGIN')
  try {
    for (const b of books) {
      const { changes } = stmts.restore.run({
        ...toParams(b),
        id: b.id,
        created_at: b.createdAt,
        updated_at: b.updatedAt,
      })
      if (changes) updated++
      else {
        createBook(b, b.createdAt, b.updatedAt)
        added++
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return { updated, added }
}
