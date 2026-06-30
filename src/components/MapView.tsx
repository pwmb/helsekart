import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { Category, GeocodedEntry } from '../types'

function FitBounds({ entries }: { entries: GeocodedEntry[] }) {
  const map = useMap()

  useEffect(() => {
    if (entries.length === 0) return
    const bounds = L.latLngBounds(entries.map((e) => [e.lat, e.lng]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.map((e) => e.id).join(',')])

  return null
}

interface MapViewProps {
  entries: GeocodedEntry[]
  categories: Category[]
  categoryColors: Record<string, string>
  activeCategories: Set<string>
}

const NORWAY_CENTER: [number, number] = [64.5, 17.5]

function categoryColor(categories: Category[], categoryColors: Record<string, string>, categoryId: string): string {
  return categoryColors[categoryId] ?? categories.find((c) => c.id === categoryId)?.color ?? '#888'
}

function categoryName(categories: Category[], categoryId: string): string {
  return categories.find((c) => c.id === categoryId)?.name ?? categoryId
}

function hasAvailabilityData(entry: GeocodedEntry): boolean {
  return 'ledigePlasser' in entry.metadata || 'antallPlasser' in entry.metadata
}

function hasAvailableSlots(entry: GeocodedEntry): boolean {
  const slots = entry.metadata.ledigePlasser
  return typeof slots === 'number' && slots > 0
}

interface CategorySlice {
  categoryId: string
  color: string
  entries: GeocodedEntry[]
  availableCount: number
  hasAvailability: boolean
}

interface LocationGroup {
  lat: number
  lng: number
  entries: GeocodedEntry[]
  slices: CategorySlice[]       // one per category present at this location
  availableCount: number
  hasAvailability: boolean
}

function groupByLocation(
  entries: GeocodedEntry[],
  categories: Category[],
  categoryColors: Record<string, string>,
): LocationGroup[] {
  const locationMap = new Map<string, LocationGroup>()

  for (const entry of entries) {
    const key = `${entry.lat.toFixed(4)},${entry.lng.toFixed(4)}`
    if (!locationMap.has(key)) {
      locationMap.set(key, { lat: entry.lat, lng: entry.lng, entries: [], slices: [], availableCount: 0, hasAvailability: false })
    }
    const group = locationMap.get(key)!
    group.entries.push(entry)

    // find or create slice for this category
    let slice = group.slices.find((s) => s.categoryId === entry.categoryId)
    if (!slice) {
      slice = {
        categoryId: entry.categoryId,
        color: categoryColor(categories, categoryColors, entry.categoryId),
        entries: [],
        availableCount: 0,
        hasAvailability: false,
      }
      group.slices.push(slice)
    }
    slice.entries.push(entry)
    if (hasAvailabilityData(entry)) {
      slice.hasAvailability = true
      group.hasAvailability = true
    }
    if (hasAvailableSlots(entry)) {
      slice.availableCount++
      group.availableCount++
    }
  }

  return Array.from(locationMap.values())
}

// Build a conic-gradient string for multiple category colours
function buildBackground(slices: CategorySlice[]): string {
  if (slices.length === 1) return slices[0].color

  const total = slices.reduce((s, sl) => s + sl.entries.length, 0)
  let pct = 0
  const stops = slices.map((sl) => {
    const share = (sl.entries.length / total) * 100
    const from = pct
    const to = pct + share
    pct = to
    return `${sl.color} ${from.toFixed(1)}% ${to.toFixed(1)}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}

function makeIcon(group: LocationGroup): L.DivIcon {
  const { entries, slices, availableCount, hasAvailability } = group
  const count = entries.length
  const allFull = hasAvailability && availableCount === 0
  const opacity = allFull ? 0.5 : 1
  const multiCategory = slices.length > 1

  const bg = buildBackground(slices)
  const borderColor = slices.length === 1 ? slices[0].color : '#fff'

  const label = !hasAvailability
    ? (count === 1 ? '' : String(count))
    : availableCount > 0
      ? `${availableCount}/${count}`
      : String(count)

  const size = (hasAvailability && availableCount > 0 && count > 1)
    ? (count < 5 ? 30 : count < 10 ? 34 : 38)
    : multiCategory ? 28 : 26

  // multi-category: add a subtle white border so the segments read clearly
  const borderStyle = multiCategory
    ? `2px solid rgba(255,255,255,0.7)`
    : `2px solid ${borderColor}`

  const html = `
    <div style="
      width:${size}px;
      height:${size}px;
      background:${bg};
      border:${borderStyle};
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#fff;
      font-size:${size < 30 ? 9 : 10}px;
      font-weight:700;
      font-family:system-ui,sans-serif;
      opacity:${opacity};
      box-shadow:0 1px 4px rgba(0,0,0,.5);
      text-shadow:0 1px 2px rgba(0,0,0,.8);
    ">${label}</div>`

  return L.divIcon({
    className: '',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

export default function MapView({ entries, categories, categoryColors, activeCategories }: MapViewProps) {
  const visible = entries.filter((e) => activeCategories.has(e.categoryId))
  const groups = groupByLocation(visible, categories, categoryColors)

  const center: [number, number] =
    groups.length > 0 ? [groups[0].lat, groups[0].lng] : NORWAY_CENTER

  return (
    <MapContainer
      center={center}
      zoom={groups.length > 0 ? 13 : 5}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds entries={visible} />
      {groups.map((group) => (
        <Marker
          key={`${group.lat},${group.lng}`}
          position={[group.lat, group.lng]}
          icon={makeIcon(group)}
        >
          <Popup maxWidth={300} minWidth={260}>
            <div style={{ fontSize: '0.82rem', lineHeight: 1.4, display: 'flex', flexDirection: 'column' }}>
              {/* Fixed header */}
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                {group.entries[0].address}
              </div>

              {/* Scrollable list */}
              <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 2 }}>
                {group.slices.map((slice) => {
                  const sliceAllFull = slice.hasAvailability && slice.availableCount === 0
                  const color = slice.color

                  return (
                    <div key={slice.categoryId}>
                      {/* Category header — only when multiple categories */}
                      {group.slices.length > 1 && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.25rem 0',
                          marginTop: '0.25rem',
                          borderBottom: `2px solid ${color}`,
                          position: 'sticky',
                          top: 0,
                          background: '#fff',
                        }}>
                          <span style={{
                            width: 9, height: 9,
                            borderRadius: '50%',
                            background: color,
                            flexShrink: 0,
                            opacity: sliceAllFull ? 0.5 : 1,
                          }} />
                          <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#333' }}>
                            {categoryName(categories, slice.categoryId)}
                          </span>
                          {slice.hasAvailability && (
                            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#888' }}>
                              {slice.availableCount}/{slice.entries.length} ledige
                            </span>
                          )}
                        </div>
                      )}

                      {/* Summary for single-category */}
                      {group.slices.length === 1 && slice.hasAvailability && (
                        <div style={{ color: '#777', marginBottom: '0.3rem', fontSize: '0.76rem' }}>
                          {slice.availableCount} av {slice.entries.length} har ledige plasser
                        </div>
                      )}

                      {[...slice.entries]
                        .sort((a, b) => {
                          if (slice.hasAvailability) {
                            const aAvail = hasAvailableSlots(a) ? 0 : 1
                            const bAvail = hasAvailableSlots(b) ? 0 : 1
                            if (aAvail !== bAvail) return aAvail - bAvail
                          }
                          return a.title.localeCompare(b.title, 'no')
                        })
                        .map((e) => {
                          const entryHasData = hasAvailabilityData(e)
                          const available = hasAvailableSlots(e)
                          const slots = e.metadata.ledigePlasser
                          return (
                            <div
                              key={e.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '14px 1fr',
                                gap: '0 0.35rem',
                                alignItems: 'start',
                                borderTop: '1px solid #f0f0f0',
                                padding: '0.3rem 0',
                                opacity: entryHasData && !available ? 0.5 : 1,
                              }}
                            >
                              <span style={{ paddingTop: 1, fontSize: '0.7rem' }}>
                                {entryHasData ? (available ? '🟢' : '🔴') : '•'}
                              </span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{e.title}</div>
                                {e.metadata.tlf != null && (
                                  <div style={{ color: '#888', fontSize: '0.72rem' }}>📞 {String(e.metadata.tlf)}</div>
                                )}
                                {typeof slots === 'number' && (
                                  <div style={{ color: available ? '#2a7' : '#bbb', fontSize: '0.72rem' }}>
                                    {slots} ledige / {String(e.metadata.antallPlasser ?? '?')} totalt
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )
                })}
              </div>

              {/* Scroll hint when list is long */}
              {group.entries.length > 6 && (
                <div style={{ textAlign: 'center', fontSize: '0.68rem', color: '#bbb', paddingTop: '0.3rem', borderTop: '1px solid #eee' }}>
                  {group.entries.length} leger — scroll for å se alle
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
