#!/usr/bin/env node
/**
 * Pre-geocodes all JSON files in src/data/ and writes coordinates
 * into src/data-geocoded/. Run this once when data changes:
 *
 *   node scripts/geocode-data.mjs
 *
 * Respects Nominatim's 1 req/sec policy. Skips already-geocoded entries.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../src/data')
const OUT_DIR = join(__dirname, '../src/data-geocoded')
const CACHE_FILE = join(__dirname, '../src/data-geocoded/.geocode-cache.json')
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

// ── abbreviation expansion ────────────────────────────────────────────────────
function expand(address) {
  return address
    .replace(/(\w)gt\./gi, '$1 gate')
    .replace(/(\w)vn\./gi, '$1 veien')
    .replace(/(\w)all\./gi, '$1 allé')
    .replace(/\bgt\.\b/gi, 'gate')
    .replace(/\bvn\.\b/gi, 'veien')
    .replace(/\ball\.\b/gi, 'allé')
    .replace(/\bpl\.\b/gi, 'plass')
    .replace(/\bv\.\b/gi, 'vei')
    .replace(/\bstgt\.\b/gi, 'storgata')
    .replace(/  +/g, ' ')
    .trim()
}

function postalFallback(address) {
  const m = address.match(/(\d{4})\s+(\S.*)$/)
  if (!m) return null
  return m[2].trim() ? `${m[1]} ${m[2].trim()}, Norway` : null
}

// ── Nominatim fetch ───────────────────────────────────────────────────────────
async function query(q) {
  const url = `${NOMINATIM}?` + new URLSearchParams({ q, format: 'json', limit: '1', countrycodes: 'no' })
  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'no',
      'User-Agent': 'avtalespesialister-kart/1.0 (build script)',
    },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function geocode(address) {
  let result = await query(address)
  if (result) return { coords: result, via: 'original' }

  await sleep(1100)
  const exp = expand(address)
  if (exp !== address) {
    result = await query(exp)
    if (result) return { coords: result, via: `expanded → "${exp}"` }
    await sleep(1100)
  }

  const fb = postalFallback(address)
  if (fb) {
    result = await query(fb)
    if (result) return { coords: result, via: `postal fallback → "${fb}"` }
    await sleep(1100)
  }

  return null
}

// ── main ──────────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })

const cache = existsSync(CACHE_FILE)
  ? JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
  : {}

const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))
console.log(`Found ${files.length} data file(s): ${files.join(', ')}\n`)

let totalNew = 0, totalFailed = 0, totalSkipped = 0

for (const file of files) {
  const entries = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'))
  const output = []
  const failed = []

  console.log(`── ${file} (${entries.length} entries)`)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const addr = entry.address

    if (cache[addr]) {
      output.push({ ...entry, lat: cache[addr].lat, lng: cache[addr].lng })
      totalSkipped++
      process.stdout.write(`\r  ${i + 1}/${entries.length} (${totalSkipped} cached, ${totalNew} new, ${totalFailed} failed)  `)
      continue
    }

    if (cache[addr] === null) {
      failed.push(addr)
      totalFailed++
      process.stdout.write(`\r  ${i + 1}/${entries.length} (${totalSkipped} cached, ${totalNew} new, ${totalFailed} failed)  `)
      continue
    }

    // Not in cache — geocode it
    const result = await geocode(addr)
    await sleep(1100)

    if (result) {
      cache[addr] = result.coords
      output.push({ ...entry, lat: result.coords.lat, lng: result.coords.lng })
      totalNew++
      if (result.via !== 'original') {
        console.log(`\n  ✓ "${addr}" [${result.via}]`)
      }
    } else {
      cache[addr] = null
      failed.push(addr)
      totalFailed++
      console.log(`\n  ✗ FAILED: "${addr}"`)
    }

    process.stdout.write(`\r  ${i + 1}/${entries.length} (${totalSkipped} cached, ${totalNew} new, ${totalFailed} failed)  `)
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
  }

  console.log()
  writeFileSync(join(OUT_DIR, file), JSON.stringify(output, null, 2))

  if (failed.length) {
    console.log(`  Failed addresses in ${file}:`)
    failed.forEach((a) => console.log(`    - ${a}`))
  }
  console.log()
}

writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
console.log(`Done. ${totalNew} geocoded, ${totalSkipped} from cache, ${totalFailed} failed.`)
console.log(`Output written to: ${OUT_DIR}`)
