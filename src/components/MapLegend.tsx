import { useState } from 'react'
import type { Category, CategoryGroup } from '../types'
import './MapLegend.css'

interface MapLegendProps {
  groups: CategoryGroup[]
  categoryColors: Record<string, string>
  activeCategories: Set<string>
  onToggleCategory: (id: string) => void
  onToggleAll: (ids: string[], on: boolean) => void
  onColorChange: (id: string, color: string) => void
}

function allIds(group: CategoryGroup): string[] {
  if (group.categories) return group.categories.map((c) => c.id)
  return group.subgroups?.flatMap((sg) => sg.categories.map((c) => c.id)) ?? []
}

function countLabel(n: number): string {
  return n.toLocaleString('no')
}

// ── reusable leaf row ─────────────────────────────────────────────────────────

function CategoryRow({
  cat, color, isActive, onToggle, onColorChange,
}: {
  cat: Category
  color: string
  isActive: boolean
  onToggle: () => void
  onColorChange: (c: string) => void
}) {
  return (
    <li className={`legend-item ${isActive ? '' : 'inactive'}`}>
      <label className="legend-swatch" title="Endre farge" style={{ background: color }}>
        <input type="color" value={color} onChange={(e) => onColorChange(e.target.value)} />
      </label>
      <span className="legend-name" onClick={onToggle}>{cat.name}</span>
      <span className="legend-count">{countLabel(cat.addresses.length)}</span>
      <button
        className={`legend-eye ${isActive ? 'on' : 'off'}`}
        onClick={onToggle}
        title={isActive ? 'Skjul' : 'Vis'}
      >
        {isActive ? '👁' : '👁‍🗨'}
      </button>
    </li>
  )
}

// ── bulk toggle checkbox ──────────────────────────────────────────────────────

function BulkCheckbox({
  ids, activeCategories, onToggleAll,
}: {
  ids: string[]
  activeCategories: Set<string>
  onToggleAll: (ids: string[], on: boolean) => void
}) {
  const activeCount = ids.filter((id) => activeCategories.has(id)).length
  const allOn  = activeCount === ids.length
  const someOn = activeCount > 0 && !allOn

  return (
    <input
      type="checkbox"
      className="legend-group-check"
      checked={allOn}
      ref={(el) => { if (el) el.indeterminate = someOn }}
      onChange={() => onToggleAll(ids, !allOn)}
    />
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function MapLegend({
  groups, categoryColors, activeCategories,
  onToggleCategory, onToggleAll, onColorChange,
}: MapLegendProps) {
  const [legendOpen, setLegendOpen] = useState(true)
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({
    fastleger: true,
    avtalespesialister: true,
  })
  const [subgroupExpanded, setSubgroupExpanded] = useState<Record<string, boolean>>({})

  function toggleGroup(id: string) {
    setGroupExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleSubgroup(id: string) {
    setSubgroupExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className={`map-legend ${legendOpen ? 'open' : 'collapsed'}`}>
      <button className="legend-toggle" onClick={() => setLegendOpen((v) => !v)}>
        <span className="legend-toggle-label">Helse Kart</span>
        <span className="legend-chevron">{legendOpen ? '▾' : '◂'}</span>
      </button>

      {legendOpen && (
        <div className="legend-body">
          {groups.map((group) => {
            const ids = allIds(group)
            const total = ids.reduce((s, id) => {
              const cat = [...(group.categories ?? []), ...(group.subgroups?.flatMap((sg) => sg.categories) ?? [])]
                .find((c) => c.id === id)
              return s + (cat?.addresses.length ?? 0)
            }, 0)
            const expanded = groupExpanded[group.id] ?? false

            return (
              <div key={group.id} className="legend-section">
                {/* Group header */}
                <div className="legend-group-header">
                  <BulkCheckbox ids={ids} activeCategories={activeCategories} onToggleAll={onToggleAll} />
                  <span className="legend-group-name" onClick={() => toggleGroup(group.id)}>
                    {group.label}
                  </span>
                  <span className="legend-count">{countLabel(total)}</span>
                  <button className="legend-group-expand" onClick={() => toggleGroup(group.id)}>
                    {expanded ? '▴' : '▾'}
                  </button>
                </div>

                {expanded && (
                  <div className="legend-group-body">
                    {/* Direct categories (Fastleger → fylker) */}
                    {group.categories && (
                      <ul className="legend-sublist">
                        {group.categories.map((cat) => (
                          <CategoryRow
                            key={cat.id}
                            cat={cat}
                            color={categoryColors[cat.id] ?? cat.color}
                            isActive={activeCategories.has(cat.id)}
                            onToggle={() => onToggleCategory(cat.id)}
                            onColorChange={(c) => onColorChange(cat.id, c)}
                          />
                        ))}
                      </ul>
                    )}

                    {/* Subgroups (Avtalespesialister → Legespesialister / Psykiatere / Psykologer) */}
                    {group.subgroups?.map((sg) => {
                      const sgIds = sg.categories.map((c) => c.id)
                      const sgTotal = sg.categories.reduce((s, c) => s + c.addresses.length, 0)
                      const sgExpanded = subgroupExpanded[sg.id] ?? false

                      return (
                        <div key={sg.id} className="legend-subgroup">
                          <div className="legend-subgroup-header">
                            <BulkCheckbox ids={sgIds} activeCategories={activeCategories} onToggleAll={onToggleAll} />
                            <span className="legend-subgroup-name" onClick={() => toggleSubgroup(sg.id)}>
                              {sg.label}
                            </span>
                            <span className="legend-count">{countLabel(sgTotal)}</span>
                            <button className="legend-group-expand" onClick={() => toggleSubgroup(sg.id)}>
                              {sgExpanded ? '▴' : '▾'}
                            </button>
                          </div>

                          {sgExpanded && (
                            <ul className="legend-sublist legend-sublist--indented">
                              {sg.categories.map((cat) => (
                                <CategoryRow
                                  key={cat.id}
                                  cat={cat}
                                  color={categoryColors[cat.id] ?? cat.color}
                                  isActive={activeCategories.has(cat.id)}
                                  onToggle={() => onToggleCategory(cat.id)}
                                  onColorChange={(c) => onColorChange(cat.id, c)}
                                />
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
