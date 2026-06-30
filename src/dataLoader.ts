import type { Category, GeocodedEntry, PreGeocodedAddress, RawAddress } from './types'

// Geographically themed — north=blue, west=green, south=teal, east=red/warm, capital=gold
const CATEGORY_COLORS: Record<string, string> = {
  // Arctic north — deep blues/indigo
  'fastlege-finnmark':        '#1565c0',  // deep blue
  'fastlege-troms':           '#5c6bc0',  // indigo-blue
  'fastlege-nordland':        '#42a5f5',  // sky blue

  // Central
  'fastlege-trondelag':       '#ef6c00',  // deep orange

  // West coast — greens
  'fastlege-more-og-romsdal': '#2e7d32',  // forest green
  'fastlege-vestland':        '#66bb6a',  // medium green

  // Inland
  'fastlege-innlandet':       '#a1887f',  // warm brown

  // East / Southeast — reds & warm
  'fastlege-akershus':        '#e53935',  // red
  'fastlege-ostfold':         '#e57373',  // light red (rose)
  'fastlege-buskerud':        '#ff7043',  // deep orange-red
  'fastlege-vestfold':        '#ff8a65',  // salmon
  'fastlege-telemark':        '#ad1457',  // dark pink

  // South & Southwest — teals
  'fastlege-agder':           '#00838f',  // dark teal
  'fastlege-rogaland':        '#26c6da',  // bright cyan-teal

  // Capital — gold, clearly distinct
  'fastlege-oslo':            '#f9a825',  // amber/gold

  // Specialist category — purple, clearly different from all fastlege
  'psykisk-helsevern-voksne': '#7b1fa2',  // deep purple
}

// Fallback palette for any future files not in the map above
const FALLBACK_PALETTE = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
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
      color: CATEGORY_COLORS[filename] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length],
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
