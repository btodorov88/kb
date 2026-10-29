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
npm run dev     # http://localhost:5180
npm run build   # production build in dist/
```

## How it works
- Vite + React + TypeScript, react-router for pages, react-markdown for summaries.
- Data is stored in the browser's IndexedDB via Dexie (`src/db.ts`). There's no server, so data stays
  on this browser only. Use **Export** for backups or to move to another device.
