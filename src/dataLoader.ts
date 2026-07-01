import type { Category, CategoryGroup, GeocodedEntry, PreGeocodedAddress, RawAddress } from './types'

// ── colours ───────────────────────────────────────────────────────────────────

// Fastleger: geographically themed
const FASTLEGE_COLORS: Record<string, string> = {
  'fastlege-finnmark':        '#1565c0',
  'fastlege-troms':           '#5c6bc0',
  'fastlege-nordland':        '#42a5f5',
  'fastlege-trondelag':       '#ef6c00',
  'fastlege-more-og-romsdal': '#2e7d32',
  'fastlege-vestland':        '#66bb6a',
  'fastlege-innlandet':       '#a1887f',
  'fastlege-akershus':        '#e53935',
  'fastlege-ostfold':         '#e57373',
  'fastlege-buskerud':        '#ff7043',
  'fastlege-vestfold':        '#ff8a65',
  'fastlege-telemark':        '#ad1457',
  'fastlege-agder':           '#00838f',
  'fastlege-rogaland':        '#26c6da',
  'fastlege-oslo':            '#f9a825',
}

// Avtalespesialister — Legespesialister: distinct medical colours
const LEGE_COLORS: Record<string, string> = {
  'avtalespesialister-kardiologi':                    '#e53935',
  'avtalespesialister-oyesykdommer':                  '#1e88e5',
  'avtalespesialister-ore-nese-halssykdommer':        '#fb8c00',
  'avtalespesialister-fodselshjelp-og-kvinnesykdommer': '#f06292',
  'avtalespesialister-hudsykdommer':                  '#8d6e63',
  'avtalespesialister-barnesykdommer':                '#ffb300',
  'avtalespesialister-nevrologi':                     '#5e35b1',
  'avtalespesialister-ortopedi':                      '#78909c',
  'avtalespesialister-lungemedisin':                  '#29b6f6',
  'avtalespesialister-gastroenterologi':              '#558b2f',
  'avtalespesialister-revmatologi':                   '#ab47bc',
  'avtalespesialister-urologi':                       '#26a69a',
  'avtalespesialister-endokrinologi':                 '#ffa726',
  'avtalespesialister-indremedisin':                  '#ef9a9a',
  'avtalespesialister-anestesiologi':                 '#b0bec5',
  'avtalespesialister-fysikalsk-medisin':             '#a5d6a7',
  'avtalespesialister-kirurgi':                       '#c62828',
}

// Psykiatere: purple family
const PSYKIATER_COLORS: Record<string, string> = {
  'avtalespesialister-psykisk-helsevern-voksne':      '#7b1fa2',
  'avtalespesialister-psykisk-helsevern-barn-og-unge':'#ce93d8',
}

// Psykologer: teal
const PSYKOLOG_COLORS: Record<string, string> = {
  'avtalespesialister-nevropsykolog':                 '#00897b',
}

const CATEGORY_COLORS: Record<string, string> = {
  ...FASTLEGE_COLORS,
  ...LEGE_COLORS,
  ...PSYKIATER_COLORS,
  ...PSYKOLOG_COLORS,
}

const FALLBACK_PALETTE = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
]

// ── group definitions ─────────────────────────────────────────────────────────

const LEGESPESIALISTER_IDS = new Set([
  'avtalespesialister-anestesiologi',
  'avtalespesialister-barnesykdommer',
  'avtalespesialister-endokrinologi',
  'avtalespesialister-fysikalsk-medisin',
  'avtalespesialister-fodselshjelp-og-kvinnesykdommer',
  'avtalespesialister-gastroenterologi',
  'avtalespesialister-hudsykdommer',
  'avtalespesialister-indremedisin',
  'avtalespesialister-kardiologi',
  'avtalespesialister-kirurgi',
  'avtalespesialister-lungemedisin',
  'avtalespesialister-nevrologi',
  'avtalespesialister-ortopedi',
  'avtalespesialister-revmatologi',
  'avtalespesialister-urologi',
  'avtalespesialister-ore-nese-halssykdommer',
  'avtalespesialister-oyesykdommer',
])

const PSYKIATER_IDS = new Set([
  'avtalespesialister-psykisk-helsevern-voksne',
  'avtalespesialister-psykisk-helsevern-barn-og-unge',
])

const PSYKOLOG_IDS = new Set([
  'avtalespesialister-nevropsykolog',
])

// ── loaders ───────────────────────────────────────────────────────────────────

const rawModules      = import.meta.glob('./data/*.json',           { eager: true })
const geocodedModules = import.meta.glob('./data-geocoded/*.json',  { eager: true })

function makeCategory(filename: string, mod: unknown, index: number): Category {
  return {
    id: filename,
    name: toDisplayName(filename),
    color: CATEGORY_COLORS[filename] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length],
    addresses: (mod as { default: RawAddress[] }).default,
  }
}

function toDisplayName(filename: string): string {
  return filename
    .replace(/^fastlege-/, '')
    .replace(/^avtalespesialister-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function loadCategories(): Category[] {
  return Object.entries(rawModules).map(([path, mod], index) => {
    const filename = path.split('/').pop()!.replace('.json', '')
    return makeCategory(filename, mod, index)
  })
}

/** Returns the full 2-level legend tree: Fastleger + Avtalespesialister. */
export function buildLegendGroups(categories: Category[]): CategoryGroup[] {
  const byId = new Map(categories.map((c) => [c.id, c]))

  const fastlegeCategories = categories
    .filter((c) => c.id.startsWith('fastlege-'))
    .sort((a, b) => a.name.localeCompare(b.name, 'no'))

  const legeCategories = [...LEGESPESIALISTER_IDS]
    .map((id) => byId.get(id))
    .filter((c): c is Category => c !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, 'no'))

  const psykiaterCategories = [...PSYKIATER_IDS]
    .map((id) => byId.get(id))
    .filter((c): c is Category => c !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, 'no'))

  const psykologCategories = [...PSYKOLOG_IDS]
    .map((id) => byId.get(id))
    .filter((c): c is Category => c !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, 'no'))

  return [
    {
      id: 'fastleger',
      label: 'Fastleger',
      categories: fastlegeCategories,
    },
    {
      id: 'avtalespesialister',
      label: 'Avtalespesialister',
      subgroups: [
        { id: 'legespesialister', label: 'Legespesialister', categories: legeCategories },
        { id: 'psykiatere',       label: 'Psykiatere',       categories: psykiaterCategories },
        { id: 'psykologer',       label: 'Psykologer',       categories: psykologCategories },
      ].filter((sg) => sg.categories.length > 0),
    },
  ]
}

export function loadPreGeocoded(): GeocodedEntry[] {
  const entries: GeocodedEntry[] = []
  Object.entries(geocodedModules).forEach(([path, mod]) => {
    const filename = path.split('/').pop()!.replace('.json', '')
    const addresses = (mod as { default: PreGeocodedAddress[] }).default
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
  })
  return entries
}

export function hasPreGeocodedData(): boolean {
  return Object.keys(geocodedModules).length > 0
}
