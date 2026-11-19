# Book Notes

A personal web app for keeping summaries of books you've read and reviewing them later.

## Features
- **Books and topics**: both are the same kind of entry. A topic just has no author or cover.
- **Groups**: put entries in a group (e.g. "PhD exam"). The library lists them under group headings.
- **Flashcards**: each entry has question/answer cards (Markdown). **Study** goes through all of an
  entry's cards, shuffled or in order. Space/Enter flips and moves on, ← → move between cards. Nothing is tracked.
- **Library**: search across titles, notes, quotes and flashcards. Filter by group, tag or status, and sort.
- **Book pages**: Markdown summary, key takeaways, quotes with page numbers and notes, rating, reading dates.
- **Auto-fill**: look up title, author and cover from Open Library when adding a book.
- **Backup**: export and import everything as JSON.

## Running
```sh
npm install
npm run dev     # app on http://localhost:5180, API on :5181 (proxied under /api)
npm start       # production: serves the built app + API on http://localhost:5180 (run `npm run build` first)
```

## Seed data
`seed/utp-exam.json` holds the 6 PhD exam topics (Теми 6, 22, 14, 17, 16, 20 — билети 1–3) from
`UTP-izpit-temi.pdf`, with notes, key takeaways and 219 flashcards. Load it into an empty library with
**Import** in the app, or:
```sh
curl -X POST http://localhost:5180/api/import -H 'Content-Type: application/json' --data-binary @seed/utp-exam.json
```
Importing it twice adds the topics twice.

## How it works
- **Client** (`src/`): Vite + React + TypeScript, react-router for pages, react-markdown for summaries.
  `src/api.ts` talks to the server and keeps the book list in memory.
- **Server** (`server/`): Express API storing books in SQLite at `data/book-notes.db` (git-ignored).
  Uses Node's built-in `node:sqlite`. On Node 23 this needs `--experimental-sqlite`, which the npm
  scripts pass for you.
- **Backups**: copy `data/book-notes.db`, or use **Export** in the app for a portable JSON file.
- Books saved by older versions in the browser (IndexedDB) are moved into the database
  automatically the first time the app opens (`src/migrateBrowserData.ts`).

## API
| Method | Path | |
|---|---|---|
| GET | `/api/books` | all books |
| GET | `/api/books/:id` | one book |
| POST | `/api/books` | create |
| PUT | `/api/books/:id` | replace |
| DELETE | `/api/books/:id` | delete |
| GET | `/api/export` | JSON backup |
| POST | `/api/import` | restore a backup (same book → updated, otherwise added) |

## Deploying (Cloudflare Workers)

The deployed app runs `worker/index.ts` (same API, on a D1 database) and is public to read. Adding, editing, deleting and importing need one password.

- Deploy: `npm run deploy` → https://diary.btodorov88.workers.dev
- Set or change the password: `npx wrangler secret put APP_PASSWORD` (signs all devices out)
- The cloud database (`diary-db`) is separate from the local `data/book-notes.db`.
  To move data between them, use Export in one and Import in the other.
