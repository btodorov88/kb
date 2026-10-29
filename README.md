# Book Notes

A personal web app for keeping summaries of books you've read and reviewing them later.

## Features
- **Library**: search across titles, summaries, takeaways and quotes. Filter by tag or status, and sort.
- **Book pages**: Markdown summary, key takeaways, quotes with page numbers and notes, rating, reading dates.
- **Auto-fill**: look up title, author and cover from Open Library when adding a book.
- **Review**: shows books not reviewed in 30+ days. You try to recall the book first, then see your notes.
- **Backup**: export and import everything as JSON.

## Running
```sh
npm install
npm run dev     # app on http://localhost:5180, API on :5181 (proxied under /api)
npm start       # production: serves the built app + API on http://localhost:5180 (run `npm run build` first)
```

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
| POST | `/api/books/:id/reviewed` | set last-reviewed to now |
| GET | `/api/export` | JSON backup |
| POST | `/api/import` | restore a backup (same book → updated, otherwise added) |
