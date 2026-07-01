#!/usr/bin/env node
/**
 * Fetches all avtalespesialister (contracted specialists) for Helse Sør-Øst
 * from https://avtalespesialister.helse-sorost.no and writes one JSON file
 * per specialty category into src/data/.
 *
 * Usage:
 *   node scripts/fetch-avtalespesialister.mjs
 *
 * After running, re-geocode:
 *   node scripts/geocode-data.mjs
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../src/data')
const BASE_URL = 'https://avtalespesialister.helse-sorost.no/Spesialister1.asp'

// All regions in Helse Sør-Øst
const REGIONS = [
  { id: 3,  name: 'Oslo' },
  { id: 31, name: 'Østfold' },
  { id: 32, name: 'Akershus' },
  { id: 33, name: 'Buskerud' },
  { id: 34, name: 'Innlandet' },
  { id: 39, name: 'Vestfold' },
  { id: 40, name: 'Telemark' },
  { id: 42, name: 'Agder' },
]

// type=349 = somatic, type=351 = mental health + psychology
const TYPES = [349, 351]

// ── HTML parsing ──────────────────────────────────────────────────────────────

function cleanText(s) {
  return (s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&[a-z]+;/gi, '')
    .replace(/\xa0/g, ' ')
    .trim()
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Parse one HTML page and return entries grouped by category name.
 * Returns: Map<categoryName, Entry[]>
 */
function parsePage(html, regionName) {
  const result = new Map()

  // Split on Fagfelt headers
  const sectionRegex = /class='Fagfelt'[\s\S]*?<b>([\s\S]*?)<\/b>([\s\S]*?)(?=class='Fagfelt'|$)/g
  let match

  while ((match = sectionRegex.exec(html)) !== null) {
    const categoryRaw = cleanText(match[1])
    const sectionHtml = match[2]

    if (!categoryRaw) continue
    if (!result.has(categoryRaw)) result.set(categoryRaw, [])

    // Parse all <tr id='...'> rows in this section
    const rowRegex = /<tr id='\d+'[\s\S]*?<\/tr>/g
    let row

    while ((row = rowRegex.exec(sectionHtml)) !== null) {
      const cells = []
      const cellRegex = /<td class='ListItem'>([\s\S]*?)<\/td>/g
      let cell
      while ((cell = cellRegex.exec(row[0])) !== null) {
        cells.push(cleanText(cell[1]))
      }
      if (cells.length < 5) continue

      const name     = cells[0]
      const dps      = cells[1]
      const phone    = cells[2]
      const street   = cells[3]
      const postalCity = cells[4]

      if (!name) continue

      const address = [street, postalCity].filter(Boolean).join(', ')

      const metadata = { region: regionName }
      if (dps) metadata.tilknytning = dps
      if (phone) metadata.tlf = phone

      result.get(categoryRaw).push({ title: name, address, metadata })
    }
  }

  return result
}

// ── fetch ─────────────────────────────────────────────────────────────────────

async function fetchPage(type, regionId) {
  const url = `${BASE_URL}?cmd=Detail&type=${type}&id=${regionId}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'helsekart/1.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── main ──────────────────────────────────────────────────────────────────────

mkdirSync(DATA_DIR, { recursive: true })

// Aggregate: categoryName → Entry[]
const all = new Map()

for (const type of TYPES) {
  for (const region of REGIONS) {
    process.stdout.write(`Fetching type=${type} ${region.name}… `)
    const html = await fetchPage(type, region.id)
    const parsed = parsePage(html, region.name)

    let count = 0
    for (const [cat, entries] of parsed) {
      if (!all.has(cat)) all.set(cat, [])
      all.get(cat).push(...entries)
      count += entries.length
    }
    console.log(`${count} entries across ${parsed.size} categories`)
    await sleep(300) // be polite
  }
}

// Deduplicate by (title + address) within each category
let totalWritten = 0
for (const [category, entries] of all) {
  const seen = new Set()
  const deduped = entries.filter((e) => {
    const key = `${e.title}|${e.address}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const filename = `avtalespesialister-${slugify(category)}.json`
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(deduped, null, 2))
  console.log(`  ${filename}: ${deduped.length} entries`)
  totalWritten += deduped.length
}

console.log(`\nDone. ${totalWritten} total entries across ${all.size} categories.`)
console.log('Next step: node scripts/geocode-data.mjs')
