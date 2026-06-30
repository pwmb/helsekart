import { useState } from 'react'
import type { Category } from '../types'
import './MapLegend.css'

interface MapLegendProps {
  categories: Category[]
  categoryColors: Record<string, string>
  activeCategories: Set<string>
  onToggleCategory: (id: string) => void
  onToggleAll: (ids: string[], on: boolean) => void
  onColorChange: (id: string, color: string) => void
}

// Categories that get grouped under "Fastleger"
function isFastlege(id: string) {
  return id.startsWith('fastlege-')
}

export default function MapLegend({
  categories,
  categoryColors,
  activeCategories,
  onToggleCategory,
  onToggleAll,
  onColorChange,
}: MapLegendProps) {
  const [open, setOpen] = useState(true)
  const [fastlegeExpanded, setFastlegeExpanded] = useState(false)

  const fastlegeCategories = categories.filter((c) => isFastlege(c.id))
  const otherCategories    = categories.filter((c) => !isFastlege(c.id))

  const fastlegeActiveCount = fastlegeCategories.filter((c) => activeCategories.has(c.id)).length
  const allFastlegeOn  = fastlegeActiveCount === fastlegeCategories.length
  const someFastlegeOn = fastlegeActiveCount > 0 && !allFastlegeOn

  function toggleAllFastlege() {
    onToggleAll(fastlegeCategories.map((c) => c.id), !allFastlegeOn)
  }

  return (
    <div className={`map-legend ${open ? 'open' : 'collapsed'}`}>
      <button className="legend-toggle" onClick={() => setOpen((v) => !v)}>
        <span className="legend-toggle-label">Helse Kart</span>
        <span className="legend-chevron">{open ? '▾' : '◂'}</span>
      </button>

      {open && (
        <div className="legend-body">
          <ul className="legend-list">

            {/* ── Fastleger group ── */}
            {fastlegeCategories.length > 0 && (
              <li className="legend-group">
                <div className="legend-group-header">
                  {/* bulk toggle checkbox */}
                  <input
                    type="checkbox"
                    className="legend-group-check"
                    checked={allFastlegeOn}
                    ref={(el) => { if (el) el.indeterminate = someFastlegeOn }}
                    onChange={toggleAllFastlege}
                    title={allFastlegeOn ? 'Skjul alle fastleger' : 'Vis alle fastleger'}
                  />
                  <span className="legend-group-name" onClick={toggleAllFastlege}>
                    Fastleger
                  </span>
                  <span className="legend-count">{fastlegeCategories.reduce((s, c) => s + c.addresses.length, 0)}</span>
                  <button
                    className="legend-group-expand"
                    onClick={() => setFastlegeExpanded((v) => !v)}
                    title={fastlegeExpanded ? 'Skjul fylker' : 'Vis fylker'}
                  >
                    {fastlegeExpanded ? '▴' : '▾'}
                  </button>
                </div>

                {fastlegeExpanded && (
                  <ul className="legend-sublist">
                    {fastlegeCategories.map((cat) => {
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
                            {cat.name.replace('Fastlege ', '')}
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
                )}
              </li>
            )}

            {/* ── Other categories (e.g. psykisk helsevern) ── */}
            {otherCategories.map((cat) => {
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
        </div>
      )}
    </div>
  )
}
