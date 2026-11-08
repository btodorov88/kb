/**
 * Cloudflare Worker for the deployed app: serves the built client (dist/) and the same /api as
 * server/index.ts, backed by D1 instead of a local SQLite file. Everything sits behind a single
 * password (the APP_PASSWORD secret).
 */
import { parseDraft, parseImport, ValidationError } from '../server/validate.ts'
import type { Book, BookDraft, ExportFile, ReadingStatus } from '../src/types.ts'
import { checkSession, handleLogin, loginPage } from './auth.ts'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  APP_PASSWORD?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!env.APP_PASSWORD) return new Response('APP_PASSWORD is not set', { status: 503 })

    if (url.pathname === '/login') {
      return request.method === 'POST' ? handleLogin(request, env.APP_PASSWORD) : loginPage()
    }
    if (!(await checkSession(request, env.APP_PASSWORD))) {
      return url.pathname.startsWith('/api/')
        ? json({ error: 'Not signed in' }, 401)
        : Response.redirect(`${url.origin}/login`, 302)
    }
    if (url.pathname.startsWith('/api/')) return api(request, url, env.DB)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

// --- API ----------------------------------------------------------------

async function api(request: Request, url: URL, db: D1Database): Promise<Response> {
  try {
    const path = url.pathname.slice('/api'.length)
    const method = request.method
    const m = path.match(/^\/books\/([^/]+)$/)

    if (path === '/books' && method === 'GET') return json(await listBooks(db))
    if (path === '/books' && method === 'POST') return json(await createBook(db, parseDraft(await body(request))), 201)
    if (m) {
      const id = Number(m[1])
      if (!Number.isInteger(id) || id < 1) throw new ValidationError('Invalid book id')
      if (method === 'GET') {
        const book = await getBook(db, id)
        return book ? json(book) : json({ error: 'Book not found' }, 404)
      }
      if (method === 'PUT') {
        const book = await updateBook(db, id, parseDraft(await body(request)))
        return book ? json(book) : json({ error: 'Book not found' }, 404)
      }
      if (method === 'DELETE') {
        const { meta } = await db.prepare('DELETE FROM books WHERE id = ?').bind(id).run()
        return meta.changes ? new Response(null, { status: 204 }) : json({ error: 'Book not found' }, 404)
      }
    }
    if (path === '/export' && method === 'GET') {
      const file: ExportFile = { version: 1, exportedAt: new Date().toISOString(), books: await listBooks(db) }
      return json(file)
    }
    if (path === '/import' && method === 'POST') return json(await importBooks(db, parseImport(await body(request))))
    return json({ error: 'Not found' }, 404)
  } catch (err) {
    if (err instanceof ValidationError) return json({ error: err.message }, 400)
    console.error(err)
    return json({ error: 'Something went wrong' }, 500)
  }
}

async function body(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ValidationError('Invalid JSON')
  }
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

// --- Database -----------------------------------------------------------

type Row = Record<string, string | number | null>

const COLUMNS = [
  'title', 'author', 'group_name', 'cover_url', 'status', 'rating', 'started_at',
  'finished_at', 'tags', 'summary', 'takeaways', 'quotes', 'cards',
]
const PLACEHOLDERS = COLUMNS.map((_, i) => `?${i + 1}`).join(', ')
const SET = COLUMNS.map((c, i) => `${c} = ?${i + 1}`).join(', ')
const N = COLUMNS.length

function fromRow(r: Row): Book {
  return {
    id: r.id as number,
    title: r.title as string,
    author: r.author as string,
    group: (r.group_name as string) ?? undefined,
    coverUrl: (r.cover_url as string) ?? undefined,
    status: r.status as ReadingStatus,
    rating: (r.rating as number) ?? undefined,
    startedAt: (r.started_at as string) ?? undefined,
    finishedAt: (r.finished_at as string) ?? undefined,
    tags: JSON.parse(r.tags as string),
    summary: r.summary as string,
    takeaways: JSON.parse(r.takeaways as string),
    quotes: JSON.parse(r.quotes as string),
    cards: JSON.parse(r.cards as string),
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  }
}

function values(d: BookDraft) {
  return [
    d.title, d.author, d.group ?? null, d.coverUrl ?? null, d.status, d.rating ?? null,
    d.startedAt ?? null, d.finishedAt ?? null, JSON.stringify(d.tags), d.summary,
    JSON.stringify(d.takeaways), JSON.stringify(d.quotes), JSON.stringify(d.cards),
  ]
}

function insertStmt(db: D1Database, d: BookDraft, createdAt: number, updatedAt: number) {
  return db
    .prepare(`INSERT INTO books (${COLUMNS.join(', ')}, created_at, updated_at) VALUES (${PLACEHOLDERS}, ?${N + 1}, ?${N + 2}) RETURNING *`)
    .bind(...values(d), createdAt, updatedAt)
}

async function listBooks(db: D1Database): Promise<Book[]> {
  const { results } = await db.prepare('SELECT * FROM books ORDER BY updated_at DESC').all<Row>()
  return results.map(fromRow)
}

async function getBook(db: D1Database, id: number): Promise<Book | undefined> {
  const row = await db.prepare('SELECT * FROM books WHERE id = ?').bind(id).first<Row>()
  return row ? fromRow(row) : undefined
}

async function createBook(db: D1Database, d: BookDraft): Promise<Book> {
  const now = Date.now()
  return fromRow((await insertStmt(db, d, now, now).first<Row>())!)
}

async function updateBook(db: D1Database, id: number, d: BookDraft): Promise<Book | undefined> {
  const row = await db
    .prepare(`UPDATE books SET ${SET}, updated_at = ?${N + 1} WHERE id = ?${N + 2} RETURNING *`)
    .bind(...values(d), Date.now(), id)
    .first<Row>()
  return row ? fromRow(row) : undefined
}

/** Same rule as server/db.ts: a matching id + createdAt is the same book (overwrite), anything else is added. */
async function importBooks(db: D1Database, books: Book[]): Promise<{ updated: number; added: number }> {
  const { results } = await db.prepare('SELECT id, created_at FROM books').all<{ id: number; created_at: number }>()
  const existing = new Set(results.map((r) => `${r.id}:${r.created_at}`))
  let updated = 0
  let added = 0
  const stmts = books.map((b) => {
    if (existing.has(`${b.id}:${b.createdAt}`)) {
      updated++
      return db
        .prepare(`UPDATE books SET ${SET}, updated_at = ?${N + 1} WHERE id = ?${N + 2}`)
        .bind(...values(b), b.updatedAt, b.id)
    }
    added++
    return insertStmt(db, b, b.createdAt, b.updatedAt)
  })
  if (stmts.length) await db.batch(stmts) // one transaction
  return { updated, added }
}
