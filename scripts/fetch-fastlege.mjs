#!/usr/bin/env node
/**
 * Fetches the fastlege list for all of Norway from helsenorge.no.
 * Outputs one JSON file per fylke into src/data/.
 *
 * Usage:
 *   node scripts/fetch-fastlege.mjs            # all Norway
 *   node scripts/fetch-fastlege.mjs 03 46      # specific fylke codes only
 *
 * After running, re-geocode:
 *   node scripts/geocode-data.mjs
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../src/data')

const API_URL = 'https://tjenester.helsenorge.no/proxy/fastlegeinternal/api/v1/AvtaleSokPublic'
const SSB_URL = 'https://data.ssb.no/api/klass/v1/classifications/131/codes.json?from=2025-01-01'

// Fylke name mapping (code → display name)
const FYLKE_NAMES = {
  '03': 'Oslo',
  '11': 'Rogaland',
  '15': 'Møre og Romsdal',
  '18': 'Nordland',
  '31': 'Østfold',
  '32': 'Akershus',
  '33': 'Buskerud',
  '34': 'Innlandet',
  '39': 'Telemark',
  '40': 'Vestfold',
  '42': 'Agder',
  '46': 'Vestland',
  '50': 'Trøndelag',
  '55': 'Troms',
  '56': 'Finnmark',
}

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[æå]/g, 'a').replace(/ø/g, 'o')
}

function clean(s) {
  return (s ?? '').toString().trim()
}

function transform(items) {
  return items
    .map((item) => {
      const lege   = item.Fastlege   ?? {}
      const kontor = item.Legekontor ?? {}
      const title  = `${clean(lege.Fornavn)} ${clean(lege.Etternavn)}`.trim()
      const street = clean(kontor.Adresse)
      const postnr = clean(kontor.Postnr)
      const poststed = clean(kontor.Poststed)
      const address = [street, `${postnr} ${poststed}`.trim()].filter(Boolean).join(', ')
      if (!title || !address) return null

      const metadata = { legekontor: clean(kontor.Navn) }
      const tlf = clean(kontor.Telefon)
      if (tlf) metadata.tlf = tlf
      if (item.LedigePlasser > 0) metadata.ledigePlasser = item.LedigePlasser
      metadata.antallPlasser = item.AntallPlasser ?? 0
      if (item.Valgbar) metadata.valgbar = true

      return { title, address, metadata }
    })
    .filter(Boolean)
}

async function fetchFylke(fylkeCode, kommuner) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      Kommuner: kommuner,
      Bydeler: null,
      LegekontorNavn: null,
      LegeNavn: null,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for fylke ${fylkeCode}`)
  const data = await res.json()
  return data?.Resultater?.Resultater ?? []
}

// ── main ──────────────────────────────────────────────────────────────────────

// Which fylker to fetch (default = all)
const filterFylker = process.argv.slice(2)

console.log('Fetching municipality list from SSB…')
const ssbRes = await fetch(SSB_URL)
if (!ssbRes.ok) throw new Error(`SSB API ${ssbRes.status}`)
const ssbData = await ssbRes.json()

// Deduplicate: keep only the latest valid entry per code
const seen = new Map()
for (const c of ssbData.codes) {
  if (!seen.has(c.code) || c.validToInRequestedRange === null) {
    seen.set(c.code, c)
  }
}
const allKommuner = [...seen.values()].map((c) => c.code)

// Group by fylke (first 2 digits)
const byFylke = new Map()
for (const code of allKommuner) {
  const fylke = code.slice(0, 2)
  if (!byFylke.has(fylke)) byFylke.set(fylke, [])
  byFylke.get(fylke).push(code)
}

console.log(`Found ${allKommuner.length} kommuner across ${byFylke.size} fylker\n`)

mkdirSync(DATA_DIR, { recursive: true })

const targets = filterFylker.length > 0
  ? [...byFylke.entries()].filter(([f]) => filterFylker.includes(f))
  : [...byFylke.entries()].sort(([a], [b]) => a.localeCompare(b))

let grandTotal = 0

for (const [fylkeCode, kommuner] of targets) {
  const fylkeName = FYLKE_NAMES[fylkeCode] ?? `Fylke ${fylkeCode}`
  process.stdout.write(`Fetching ${fylkeName} (${kommuner.length} kommuner)… `)

  try {
    const raw = await fetchFylke(fylkeCode, kommuner)
    const entries = transform(raw)
    grandTotal += entries.length

    const filename = `fastlege-${slugify(fylkeName)}.json`
    writeFileSync(join(DATA_DIR, filename), JSON.stringify(entries, null, 2))
    console.log(`${entries.length} leger → ${filename}`)
  } catch (err) {
    console.error(`FAILED: ${err.message}`)
  }
}

console.log(`\nDone. ${grandTotal} total fastleger written to ${DATA_DIR}`)
console.log('Next step: node scripts/geocode-data.mjs')
