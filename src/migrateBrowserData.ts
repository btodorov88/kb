import { importBooks } from './api.ts'

// Earlier versions kept books in this browser's IndexedDB (via Dexie). This moves them to the
// server once, then deletes the browser copy. Safe to remove once nobody has old data left.

const OLD_DB = 'book-notes'

let running: Promise<number> | undefined

/** Resolves to the number of books moved (0 if there was nothing to move). */
export function migrateBrowserData(): Promise<number> {
  running ??= run().catch((err) => {
    console.error('Moving browser data to the server failed; it was left in place.', err)
    return 0
  })
  return running
}

async function run(): Promise<number> {
  if (!('indexedDB' in window) || !indexedDB.databases) return 0
  const exists = (await indexedDB.databases()).some((d) => d.name === OLD_DB)
  if (!exists) return 0

  const books = await readAll()
  if (books.length > 0) await importBooks({ books })
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(OLD_DB)
    req.onsuccess = resolve
    req.onerror = () => reject(req.error)
  })
  return books.length
}

function readAll(): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(OLD_DB)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const idb = open.result
      if (!idb.objectStoreNames.contains('books')) {
        idb.close()
        return resolve([])
      }
      const req = idb.transaction('books', 'readonly').objectStore('books').getAll()
      req.onsuccess = () => {
        idb.close()
        resolve(req.result)
      }
      req.onerror = () => reject(req.error)
    }
  })
}
