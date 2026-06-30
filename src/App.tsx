import { useState } from 'react'
import MapView from './components/MapView'
import MapLegend from './components/MapLegend'
import { loadCategories, loadPreGeocoded, hasPreGeocodedData } from './dataLoader'
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
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    // Default: Oslo fastlege + all non-fastlege categories
    new Set(
      categories
        .filter((c) => !c.id.startsWith('fastlege-') || c.id === 'fastlege-oslo')
        .map((c) => c.id),
    ),
  )
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(loadColors)

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

  function toggleAll(ids: string[], on: boolean) {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => on ? next.add(id) : next.delete(id))
      return next
    })
  }

  return (
    <div className="app">
      <main className="map-container">
        <MapView
          entries={preGeocoded}
          categories={categories}
          categoryColors={categoryColors}
          activeCategories={activeCategories}
        />
        <MapLegend
          categories={categories}
          categoryColors={categoryColors}
          activeCategories={activeCategories}
          onToggleCategory={toggleCategory}
          onToggleAll={toggleAll}
          onColorChange={updateColor}
        />
      </main>
    </div>
  )
}
