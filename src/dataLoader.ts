import type { Category, GeocodedEntry, PreGeocodedAddress, RawAddress } from './types'

const PALETTE = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#e67e22',
  '#e91e63',
]

function toDisplayName(filename: string): string {
  return filename
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const rawModules = import.meta.glob('./data/*.json', { eager: true })
const geocodedModules = import.meta.glob('./data-geocoded/*.json', { eager: true })

export function loadCategories(): Category[] {
  return Object.entries(rawModules).map(([path, mod], index) => {
    const filename = path.split('/').pop()!.replace('.json', '')
    return {
      id: filename,
      name: toDisplayName(filename),
      color: PALETTE[index % PALETTE.length],
      addresses: (mod as { default: RawAddress[] }).default,
    }
  })
}

/** Returns pre-geocoded entries from data-geocoded/, keyed by category id. */
export function loadPreGeocoded(): GeocodedEntry[] {
  const entries: GeocodedEntry[] = []

  // Build a color/index lookup from raw categories so colours stay consistent
  const rawKeys = Object.keys(rawModules)

  Object.entries(geocodedModules).forEach(([path, mod]) => {
    const filename = path.split('/').pop()!.replace('.json', '')
    const addresses = (mod as { default: PreGeocodedAddress[] }).default

    // Only include entries that actually have coordinates
    addresses.forEach((a, i) => {
      if (typeof a.lat === 'number' && typeof a.lng === 'number') {
        entries.push({
          id: `${filename}-${i}`,
          title: a.title,
          address: a.address,
          metadata: a.metadata,
          lat: a.lat,
          lng: a.lng,
          categoryId: filename,
        })
      }
    })

    // Keep palette aligned with raw categories
    const rawIndex = rawKeys.findIndex((k) => k.includes(filename))
    void rawIndex // used implicitly via loadCategories()
  })

  return entries
}

export function hasPreGeocodedData(): boolean {
  return Object.keys(geocodedModules).length > 0
}
