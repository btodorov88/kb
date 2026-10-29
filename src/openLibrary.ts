// Free book metadata lookup: https://openlibrary.org/dev/docs/api/search

export interface BookLookupResult {
  title: string
  author: string
  year?: number
  coverUrl?: string
}

interface SearchDoc {
  title: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
}

export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookLookupResult[]> {
  const url = new URL('https://openlibrary.org/search.json')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '6')
  url.searchParams.set('fields', 'title,author_name,first_publish_year,cover_i')

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Open Library returned ${res.status}`)
  const data: { docs: SearchDoc[] } = await res.json()

  return data.docs.map((d) => ({
    title: d.title,
    author: d.author_name?.join(', ') ?? '',
    year: d.first_publish_year,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
  }))
}
