import { useState } from 'react'
import type { Category } from '../types'
import './MapLegend.css'

interface FailedEntry {
  title: string
  address: string
}

interface MapLegendProps {
  categories: Category[]
  categoryColors: Record<string, string>
  activeCategories: Set<string>
  onToggleCategory: (id: string) => void
  onColorChange: (id: string, color: string) => void
  // geocoding
  isGeocoded: boolean
  isGeocoding: boolean
  geocodeProgress: { done: number; total: number }
  failed: FailedEntry[]
  onGeocode: () => void
  onRetryFailed: () => void
}

export default function MapLegend({
  categories,
  categoryColors,
  activeCategories,
  onToggleCategory,
  onColorChange,
  isGeocoded,
  isGeocoding,
  geocodeProgress,
  failed,
  onGeocode,
  onRetryFailed,
}: MapLegendProps) {
  const [open, setOpen] = useState(true)
  const [showFailed, setShowFailed] = useState(false)

  return (
    <div className={`map-legend ${open ? 'open' : 'collapsed'}`}>
      <button className="legend-toggle" onClick={() => setOpen((v) => !v)}>
        <span className="legend-toggle-label">Helse Kart</span>
        <span className="legend-chevron">{open ? '▾' : '◂'}</span>
      </button>

      {open && (
        <div className="legend-body">
          <ul className="legend-list">
            {categories.map((cat) => {
              const isActive = activeCategories.has(cat.id)
              const color = categoryColors[cat.id] ?? cat.color
              return (
                <li key={cat.id} className={`legend-item ${isActive ? '' : 'inactive'}`}>
                  <label className="legend-swatch" title="Endre farge" style={{ background: color }}>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => onColorChange(cat.id, e.target.value)}
                    />
                  </label>
                  <span className="legend-name" onClick={() => onToggleCategory(cat.id)}>
                    {cat.name}
                  </span>
                  <span className="legend-count">{cat.addresses.length}</span>
                  <button
                    className={`legend-eye ${isActive ? 'on' : 'off'}`}
                    onClick={() => onToggleCategory(cat.id)}
                    title={isActive ? 'Skjul' : 'Vis'}
                  >
                    {isActive ? '👁' : '👁‍🗨'}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="legend-footer">
            {isGeocoding ? (
              <div className="legend-progress">
                <div
                  className="legend-progress-bar"
                  style={{ width: `${geocodeProgress.total ? (geocodeProgress.done / geocodeProgress.total) * 100 : 0}%` }}
                />
                <span>{geocodeProgress.done} / {geocodeProgress.total}</span>
              </div>
            ) : (
              <button className="legend-geocode-btn" onClick={onGeocode}>
                {isGeocoded ? '↺ Re-geocode' : '↳ Plot på kart'}
              </button>
            )}

            {failed.length > 0 && !isGeocoding && (
              <div className="legend-failed">
                <div className="legend-failed-header">
                  <span className="legend-failed-count">⚠ {failed.length} feilet</span>
                  <button className="legend-failed-retry" onClick={onRetryFailed}>
                    Prøv igjen
                  </button>
                  <button
                    className="legend-failed-toggle"
                    onClick={() => setShowFailed((v) => !v)}
                  >
                    {showFailed ? '▴' : '▾'}
                  </button>
                </div>
                {showFailed && (
                  <ul className="legend-failed-list">
                    {failed.map((f, i) => (
                      <li key={i}>
                        <strong>{f.title}</strong>
                        <span>{f.address}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
