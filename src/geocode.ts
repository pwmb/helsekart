import type { Category, GeocodedEntry } from './types'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const CACHE_KEY = 'avtalespesialister_geocode_cache'

type CoordCache = Record<string, { lat: number; lng: number } | null>

function loadCache(): CoordCache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveCache(cache: CoordCache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

export function clearFailedFromCache() {
  const cache = loadCache()
  let cleared = 0
  for (const key of Object.keys(cache)) {
    if (cache[key] === null) {
      delete cache[key]
      cleared++
    }
  }
  saveCache(cache)
  return cleared
}

// Expand common Norwegian street abbreviations
function expandAbbreviations(address: string): string {
  return address
    // Compound: "Stangsgt." → "Stangs gate", "Hausmannsgt." → "Hausmanns gate"
    .replace(/(\w)gt\./gi, '$1 gate')
    .replace(/(\w)vn\./gi, '$1 veien')
    .replace(/(\w)all\./gi, '$1 allé')
    // Standalone abbreviations
    .replace(/\bgt\.\b/gi, 'gate')
    .replace(/\bvn\.\b/gi, 'veien')
    .replace(/\ball\.\b/gi, 'allé')
    .replace(/\bpl\.\b/gi, 'plass')
    .replace(/\bv\.\b/gi, 'vei')
    .replace(/\bstgt\.\b/gi, 'storgata')
    // Clean up double spaces
    .replace(/  +/g, ' ')
    .trim()
}

// Extract postal code + city from "Street, POSTNR CITY" as a broader fallback
function postalFallback(address: string): string | null {
  const match = address.match(/(\d{4})\s+(\S.*)$/)
  if (!match) return null
  const city = match[2].trim()
  return city ? `${match[1]} ${city}, Norway` : null
}

async function queryNominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({ q, format: 'json', limit: '1', countrycodes: 'no' })
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      'Accept-Language': 'no',
      'User-Agent': 'avtalespesialister-kart/1.0',
    },
  })
  if (!res.ok) return null
  const data = await res.json() as Array<{ lat: string; lon: string }>
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

async function fetchCoords(address: string): Promise<{ lat: number; lng: number } | null> {
  // Strategy 1: original address
  let result = await queryNominatim(address)
  if (result) return result

  // Strategy 2: expand Norwegian abbreviations
  const expanded = expandAbbreviations(address)
  if (expanded !== address) {
    await new Promise((r) => setTimeout(r, 1100))
    result = await queryNominatim(expanded)
    if (result) {
      console.info(`[geocode] Resolved via expansion: "${address}" → "${expanded}"`)
      return result
    }
  }

  // Strategy 3: fall back to just postal code + city
  const fallback = postalFallback(address)
  if (fallback) {
    await new Promise((r) => setTimeout(r, 1100))
    result = await queryNominatim(fallback)
    if (result) {
      console.info(`[geocode] Resolved via postal fallback: "${address}" → "${fallback}"`)
      return result
    }
  }

  console.warn(`[geocode] All strategies failed for: "${address}"`)
  return null
}

export interface GeocodeResult {
  entries: GeocodedEntry[]
  failed: Array<{ title: string; address: string; categoryId: string }>
}

export async function geocodeCategories(
  categories: Category[],
  onProgress?: (done: number, total: number) => void,
): Promise<GeocodeResult> {
  const cache = loadCache()
  const entries: GeocodedEntry[] = []
  const failed: GeocodeResult['failed'] = []

  const all = categories.flatMap((cat) =>
    cat.addresses.map((a, i) => ({ ...a, categoryId: cat.id, id: `${cat.id}-${i}` })),
  )

  let done = 0
  for (const item of all) {
    if (!(item.address in cache)) {
      cache[item.address] = await fetchCoords(item.address)
      saveCache(cache)
      await new Promise((r) => setTimeout(r, 1100))
    }

    const coords = cache[item.address]
    if (coords) {
      entries.push({
        id: item.id,
        title: item.title,
        address: item.address,
        metadata: item.metadata,
        lat: coords.lat,
        lng: coords.lng,
        categoryId: item.categoryId,
      })
    } else {
      failed.push({ title: item.title, address: item.address, categoryId: item.categoryId })
    }

    done++
    onProgress?.(done, all.length)
  }

  return { entries, failed }
}
