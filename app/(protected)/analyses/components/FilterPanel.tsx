"use client"

import { Calendar, FileText, MapPin, Wallet, Filter, X, SlidersHorizontal, ChevronDown } from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

export interface FilterState {
  ville: string
  typeVersement: string
  yearRange: [number, number] | null
  montantMin: string
  montantMax: string
}

interface FilterPanelProps {
  meta: {
    villes_disponibles?: string[]
    annees_disponibles?: number[]
    types_versement_disponibles?: string[]
    montant_range?: { min: number | null; max: number | null }
  }
  state: FilterState
  activeCount: number
  onUpdate: (partial: Partial<FilterState>) => void
  onApply: () => void
  onReset: () => void
}

// ── Dual Range Slider ────────────────────────────────────────────────────────

function YearRangeSlider({
  min, max, value, onChange,
}: { min: number; max: number; value: [number, number]; onChange: (v: [number, number]) => void }) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100

  return (
    <div className="px-1 py-2">
      <div className="flex justify-between text-xs font-mono mb-2.5">
        <span className="bg-[#093215] text-[#acc936] px-2 py-0.5 rounded-md font-bold">{value[0]}</span>
        <span className="text-slate-400 text-[10px] self-center">période</span>
        <span className="bg-[#093215] text-[#acc936] px-2 py-0.5 rounded-md font-bold">{value[1]}</span>
      </div>
      <div className="relative h-5">
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-slate-200 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full pointer-events-none"
          style={{
            background: "linear-gradient(90deg, #19542b, #acc936)",
            left: `${pct(value[0])}%`,
            right: `${100 - pct(value[1])}%`,
          }}
        />
        <input
          type="range" min={min} max={max} value={value[0]}
          onChange={e => onChange([Math.min(+e.target.value, value[1] - 1), value[1]])}
          className="range-thumb absolute w-full h-5 appearance-none bg-transparent cursor-pointer"
          style={{ zIndex: value[0] > max - 5 ? 5 : 3 }}
        />
        <input
          type="range" min={min} max={max} value={value[1]}
          onChange={e => onChange([value[0], Math.max(+e.target.value, value[0] + 1)])}
          className="range-thumb absolute w-full h-5 appearance-none bg-transparent cursor-pointer"
          style={{ zIndex: 4 }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  )
}

// ── Filter Panel ─────────────────────────────────────────────────────────────

export function FilterPanel({ meta, state, activeCount, onUpdate, onApply, onReset }: FilterPanelProps) {
  const availYears = meta.annees_disponibles ?? []

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm sticky top-[88px] z-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header bar */}
        <div className="flex items-center justify-between py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#093215]">
            <SlidersHorizontal className="h-4 w-4" />
            Filtres &amp; Période
            {activeCount > 0 && (
              <span className="bg-[#093215] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 text-xs text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition font-medium"
              >
                <X className="h-3 w-3" /> Réinitialiser
              </button>
            )}
            <button
              onClick={onApply}
              className="flex items-center gap-2 bg-[#093215] text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-[#19542b] transition active:scale-95"
            >
              <Filter className="h-3 w-3" /> Appliquer
            </button>
          </div>
        </div>

        {/* Filter grid */}
        <div className="pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-slate-100 pt-3">
          {/* Year range */}
          <div className="filter-card bg-slate-50 rounded-xl p-3 border border-slate-100">
            <label className="text-xs font-semibold text-[#093215] mb-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#19542b]" /> Période (années)
            </label>
            {availYears.length >= 2 && state.yearRange ? (
              <YearRangeSlider
                min={availYears[0]} max={availYears[availYears.length - 1]}
                value={state.yearRange} onChange={v => onUpdate({ yearRange: v })}
              />
            ) : (
              <p className="text-xs text-slate-400 py-2">Données non disponibles</p>
            )}
          </div>

          {/* Type versement */}
          <div className="filter-card bg-slate-50 rounded-xl p-3 border border-slate-100">
            <label className="text-xs font-semibold text-[#093215] mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-[#19542b]" /> Type de contrat
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {["", ...(meta.types_versement_disponibles ?? [])].map(t => (
                <button
                  key={t || "all"}
                  onClick={() => onUpdate({ typeVersement: t })}
                  className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${
                    state.typeVersement === t
                      ? "bg-[#093215] text-white border-[#093215] shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-[#19542b] hover:text-[#093215]"
                  }`}
                >
                  {t || "Tous"}
                </button>
              ))}
            </div>
          </div>

          {/* Ville */}
          <div className="filter-card bg-slate-50 rounded-xl p-3 border border-slate-100">
            <label className="text-xs font-semibold text-[#093215] mb-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#19542b]" /> Ville
            </label>
            <select
              value={state.ville}
              onChange={e => onUpdate({ ville: e.target.value })}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 mt-1 text-slate-700 focus:outline-none focus:border-[#19542b] focus:ring-1 focus:ring-[#19542b]/20 cursor-pointer"
            >
              <option value="">Toutes les villes</option>
              {(meta.villes_disponibles ?? []).map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Montant */}
          <div className="filter-card bg-slate-50 rounded-xl p-3 border border-slate-100">
            <label className="text-xs font-semibold text-[#093215] mb-2 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-[#19542b]" /> Montant initial (TND)
            </label>
            <div className="flex gap-2 mt-1">
              <input
                type="number"
                placeholder={meta.montant_range?.min != null ? `≥ ${Math.round(meta.montant_range.min)}` : "Min"}
                value={state.montantMin}
                onChange={e => onUpdate({ montantMin: e.target.value })}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-[#19542b]"
              />
              <input
                type="number"
                placeholder={meta.montant_range?.max != null ? `≤ ${Math.round(meta.montant_range.max)}` : "Max"}
                value={state.montantMax}
                onChange={e => onUpdate({ montantMax: e.target.value })}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-[#19542b]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
