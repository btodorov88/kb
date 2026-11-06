import { existsSync } from 'node:fs'
import path from 'node:path'
import express, { type ErrorRequestHandler, type Request } from 'express'
import * as books from './db.ts'
import { parseDraft, parseImport, ValidationError } from './validate.ts'
import type { ExportFile } from '../src/types.ts'

const app = express()
app.use(express.json({ limit: '20mb' }))

const api = express.Router()

function idParam(req: Request): number {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) throw new ValidationError('Invalid book id')
  return id
}

api.get('/books', (_req, res) => {
  res.json(books.listBooks())
})

api.get('/books/:id', (req, res) => {
  const book = books.getBook(idParam(req))
  if (book) res.json(book)
  else res.status(404).json({ error: 'Book not found' })
})

api.post('/books', (req, res) => {
  res.status(201).json(books.createBook(parseDraft(req.body)))
})

api.put('/books/:id', (req, res) => {
  const book = books.updateBook(idParam(req), parseDraft(req.body))
  if (book) res.json(book)
  else res.status(404).json({ error: 'Book not found' })
})

api.delete('/books/:id', (req, res) => {
  if (books.deleteBook(idParam(req))) res.status(204).end()
  else res.status(404).json({ error: 'Book not found' })
})

api.get('/export', (_req, res) => {
  const file: ExportFile = { version: 1, exportedAt: new Date().toISOString(), books: books.listBooks() }
  res.json(file)
})

api.post('/import', (req, res) => {
  res.json(books.importBooks(parseImport(req.body)))
})

api.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message })
  } else if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON' })
  } else {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong' })
  }
}

app.use('/api', api)

// In production, also serve the built client (npm run build → dist/)
const dist = path.resolve(import.meta.dirname, '../dist')
if (process.env.NODE_ENV === 'production' && existsSync(dist)) {
  app.use(express.static(dist))
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.use(onError)

const port = Number(process.env.PORT ?? 5181)
app.listen(port, '127.0.0.1', () => {
  console.log(`Book Notes API on http://localhost:${port}  (db: ${books.DB_PATH})`)
})
