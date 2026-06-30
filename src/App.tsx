import { useState } from 'react'
import MapView from './components/MapView'
import MapLegend from './components/MapLegend'
import { loadCategories, loadPreGeocoded, hasPreGeocodedData } from './dataLoader'
import { geocodeCategories, clearFailedFromCache } from './geocode'
import type { GeocodedEntry } from './types'
import './App.css'

const categories = loadCategories()
const preGeocoded = hasPreGeocodedData() ? loadPreGeocoded() : []

const COLORS_KEY = 'avtalespesialister_category_colors'

function loadColors(): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(COLORS_KEY) ?? '{}') as Record<string, string>
    const defaults = Object.fromEntries(categories.map((c) => [c.id, c.color]))
    return { ...defaults, ...saved }
  } catch {
    return Object.fromEntries(categories.map((c) => [c.id, c.color]))
  }
}

export default function App() {
  const [entries, setEntries] = useState<GeocodedEntry[]>(preGeocoded)
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id)),
  )
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(loadColors)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 })
  const [failed, setFailed] = useState<Array<{ title: string; address: string }>>([])

  function updateColor(id: string, color: string) {
    setCategoryColors((prev) => {
      const next = { ...prev, [id]: color }
      localStorage.setItem(COLORS_KEY, JSON.stringify(next))
      return next
    })
  }

  function toggleCategory(id: string) {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleGeocode() {
    setIsGeocoding(true)
    setFailed([])
    const total = categories.reduce((sum, c) => sum + c.addresses.length, 0)
    setGeocodeProgress({ done: 0, total })
    try {
      const result = await geocodeCategories(categories, (done, t) =>
        setGeocodeProgress({ done, total: t }),
      )
      setEntries(result.entries)
      setFailed(result.failed)
    } catch (e) {
      console.error('Geocoding failed', e)
    } finally {
      setIsGeocoding(false)
    }
  }

  function handleRetryFailed() {
    clearFailedFromCache()
    handleGeocode()
  }

  return (
    <div className="app">
      <main className="map-container">
        <MapView
          entries={entries}
          categories={categories}
          categoryColors={categoryColors}
          activeCategories={activeCategories}
        />
        <MapLegend
          categories={categories}
          categoryColors={categoryColors}
          activeCategories={activeCategories}
          onToggleCategory={toggleCategory}
          onColorChange={updateColor}
          isGeocoded={entries.length > 0}
          isGeocoding={isGeocoding}
          geocodeProgress={geocodeProgress}
          failed={failed}
          onGeocode={handleGeocode}
          onRetryFailed={handleRetryFailed}
        />
      </main>
    </div>
  )
}
