#!/usr/bin/env node
/**
 * Fetches the fastlege list from helsenorge.no and writes
 * src/data/fastlege-oslo.json in the format expected by the app.
 *
 * Usage:
 *   node scripts/fetch-fastlege.mjs
 *
 * After running, re-run the geocoding script to update coordinates:
 *   node scripts/geocode-data.mjs
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_FILE = join(__dirname, '../src/data/fastlege-oslo.json')

// ── request config ────────────────────────────────────────────────────────────

const URL = 'https://tjenester.helsenorge.no/proxy/fastlegeinternal/api/v1/AvtaleSokPublic'

// Oslo municipality + all bydeler
const BODY = {
  Kommuner: ['0301'],
  Bydeler: [
    '030101', '030102', '030103', '030104', '030105',
    '030106', '030107', '030108', '030109', '030110',
    '030111', '030112', '030113', '030114', '030115',
  ],
  LegekontorNavn: null,
  LegeNavn: null,
}

const HEADERS = {
  'accept': 'application/json',
  'content-type': 'application/json',
  'Accept-Language': 'nb-NO,nb;q=0.9',
  'Cache-Control': 'no-cache',
  'Origin': 'https://tjenester.helsenorge.no',
  'Referer': 'https://tjenester.helsenorge.no/bytte-fastlege',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  'x-hn-hendelselogg': 'Bytt fastlege',
  // Minimal cookies — just consent + language, no personal tracking
  'Cookie': [
    'HN-Cookie-Consent=base64:eyJWaWRlb0Nvb2tpZXMiOnRydWUsIkFuYWx5dGljc0Nvb2tpZXMiOmZhbHNlfQ==',
    'hn-language=nb-NO',
  ].join('; '),
}

// ── transform ─────────────────────────────────────────────────────────────────

function clean(s) {
  return (s ?? '').toString().trim()
}

function transform(raw) {
  const items = raw?.Resultater?.Resultater ?? []
  if (!items.length) throw new Error('No results in response — check the request or cookies')

  const results = []
  for (const item of items) {
    const lege   = item.Fastlege   ?? {}
    const kontor = item.Legekontor ?? {}

    const title = `${clean(lege.Fornavn)} ${clean(lege.Etternavn)}`.trim()
    if (!title) continue

    const street  = clean(kontor.Adresse)
    const postnr  = clean(kontor.Postnr)
    const poststed = clean(kontor.Poststed)
    const address = [street, `${postnr} ${poststed}`.trim()].filter(Boolean).join(', ')
    if (!address) continue

    const metadata = {
      legekontor: clean(kontor.Navn),
    }
    const tlf = clean(kontor.Telefon)
    if (tlf) metadata.tlf = tlf

    if (item.LedigePlasser > 0) metadata.ledigePlasser = item.LedigePlasser
    metadata.antallPlasser = item.AntallPlasser ?? 0

    if (item.Valgbar) metadata.valgbar = true

    results.push({ title, address, metadata })
  }

  return results
}

// ── main ──────────────────────────────────────────────────────────────────────

console.log('Fetching fastlege list from helsenorge.no…')

const res = await fetch(URL, {
  method: 'POST',
  headers: HEADERS,
  body: JSON.stringify(BODY),
})

if (!res.ok) {
  console.error(`HTTP ${res.status} ${res.statusText}`)
  const text = await res.text()
  console.error(text.slice(0, 500))
  process.exit(1)
}

const raw = await res.json()
const entries = transform(raw)

console.log(`Fetched ${raw?.Resultater?.Resultater?.length ?? 0} records → ${entries.length} valid entries`)

mkdirSync(dirname(OUT_FILE), { recursive: true })
writeFileSync(OUT_FILE, JSON.stringify(entries, null, 2))
console.log(`Written to: ${OUT_FILE}`)
console.log(`\nNext step: node scripts/geocode-data.mjs`)
