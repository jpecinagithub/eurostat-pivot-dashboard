import { useEffect, useMemo, useState } from 'react'
import { CURATED_PACK } from '../config/curatedPack'
import type { GeoPresetId } from '../config/geoPresets'
import type { DatasetDimension, DatasetSchema, DimId, TimeSelection } from '../core/types'
import {
  applyGeoPreset,
  budgetFor,
  initialBuilderState,
  setAllValues,
  toPivotSpec,
  toggleValue,
  type BuilderState,
} from '../features/builderModel'
import { t } from '../i18n/dictionaries'
import { fetchSchema } from '../services/schemaService'
import { useAppStore } from '../store/dashboardStore'

const PRESET_IDS: GeoPresetId[] = ['eu27', 'euro-area', 'spain-neighbors', 'all-countries']

function DimensionSection({
  dim,
  state,
  onToggle,
  onAll,
  onPreset,
}: {
  dim: DatasetDimension
  state: BuilderState
  onToggle: (dim: DimId, code: string) => void
  onAll: (dim: DimId, all: boolean) => void
  onPreset: (preset: GeoPresetId) => void
}) {
  const uiLang = useAppStore((s) => s.uiLang)
  const selected = state.selections[dim.id] ?? []
  const isGeo = dim.id === 'geo'
  return (
    <fieldset className="rounded-xl border bg-white p-4 shadow-sm">
      <legend className="px-1 text-sm font-semibold">
        {dim.id}
        <span className="ml-2 text-xs font-normal opacity-70">
          {selected.length} {t(uiLang, 'builder.selectedOf')} {dim.categories.length}
          {isGeo && state.geoLevel ? ' · geoLevel=country' : ''}
        </span>
      </legend>
      {isGeo && (
        <div className="mb-3">
          <p className="text-xs font-medium opacity-70">{t(uiLang, 'builder.presets')}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PRESET_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onPreset(id)}
                className="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
              >
                {t(uiLang, `builder.preset.${id}` as never)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mb-2 flex gap-2 text-xs">
        <button type="button" className="underline" onClick={() => onAll(dim.id, true)}>
          {t(uiLang, 'builder.all')}
        </button>
        <button type="button" className="underline" onClick={() => onAll(dim.id, false)}>
          {t(uiLang, 'builder.none')}
        </button>
      </div>
      <ul className="grid max-h-44 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto pr-1 sm:grid-cols-3">
        {dim.categories.map((cat) => (
          <li key={cat.code}>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                data-dim={dim.id}
                value={cat.code}
                checked={selected.includes(cat.code)}
                onChange={() => onToggle(dim.id, cat.code)}
              />
              <span className="font-mono">{cat.code}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

function TimeSection({
  dim,
  time,
  onChange,
}: {
  dim: DatasetDimension
  time: TimeSelection
  onChange: (time: TimeSelection) => void
}) {
  const uiLang = useAppStore((s) => s.uiLang)
  const periods = dim.categories.map((c) => c.code)
  return (
    <fieldset className="rounded-xl border bg-white p-4 shadow-sm">
      <legend className="px-1 text-sm font-semibold">
        {t(uiLang, 'builder.timeMode')} (time)
      </legend>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="time-mode"
            checked={time.mode === 'last'}
            onChange={() => onChange({ mode: 'last', n: 10 })}
          />
          {t(uiLang, 'builder.timeLast')}
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="time-mode"
            checked={time.mode === 'range'}
            onChange={() =>
              onChange({
                mode: 'range',
                since: periods[Math.max(0, periods.length - 10)],
                until: periods[periods.length - 1],
              })
            }
          />
          {t(uiLang, 'builder.timeRange')}
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="time-mode"
            checked={time.mode === 'values'}
            onChange={() => onChange({ mode: 'values', values: periods.slice(-5) })}
          />
          {t(uiLang, 'builder.timeValues')}
        </label>
      </div>
      {time.mode === 'last' && (
        <input
          type="number"
          min={1}
          max={50}
          value={time.n}
          onChange={(e) =>
            onChange({ mode: 'last', n: Math.max(1, Number(e.target.value) || 1) })
          }
          className="mt-3 w-20 rounded-md border px-2 py-1 text-sm"
          aria-label={t(uiLang, 'builder.timeLast')}
        />
      )}
      {time.mode === 'range' && (
        <div className="mt-3 flex gap-2 text-sm">
          <select
            value={time.since}
            onChange={(e) => onChange({ ...time, since: e.target.value })}
            className="rounded-md border px-2 py-1"
            aria-label="since"
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={time.until}
            onChange={(e) => onChange({ ...time, until: e.target.value })}
            className="rounded-md border px-2 py-1"
            aria-label="until"
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      )}
      {time.mode === 'values' && (
        <ul className="mt-3 grid max-h-36 grid-cols-3 gap-x-3 gap-y-1 overflow-y-auto sm:grid-cols-5">
          {periods.map((p) => (
            <li key={p}>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={time.values.includes(p)}
                  onChange={() =>
                    onChange({
                      mode: 'values',
                      values: time.values.includes(p)
                        ? time.values.filter((v) => v !== p)
                        : [...time.values, p].sort(),
                    })
                  }
                />
                <span className="font-mono">{p}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

/**
 * EUROPIVOT — Constructor (T08): esquema completo desde SDMX 2.1 (T05),
 * selección por dimensión con estimación previa (C5), presets geo de
 * 1 clic (RF-25) y disposición filas/columnas. Al aplicar, la PivotSpec
 * queda en el store; el panel que la pinta es T09.
 */
export default function Builder() {
  const uiLang = useAppStore((s) => s.uiLang)
  const selectedDataset = useAppStore((s) => s.selectedDataset)
  const setBuilderSpec = useAppStore((s) => s.setBuilderSpec)

  const [schema, setSchema] = useState<DatasetSchema | null>(null)
  const [state, setState] = useState<BuilderState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    if (!selectedDataset) return
    let alive = true
    setSchema(null)
    setState(null)
    setError(null)
    setApplied(false)
    fetchSchema(selectedDataset)
      .then((loaded) => {
        if (!alive) return
        setSchema(loaded)
        const card = CURATED_PACK.find((c) => c.code === selectedDataset)
        setState(initialBuilderState(loaded, card))
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      alive = false
    }
  }, [selectedDataset])

  const budget = useMemo(
    () => (schema && state && selectedDataset ? budgetFor(selectedDataset, state, schema) : null),
    [schema, state, selectedDataset],
  )

  if (!selectedDataset) return null

  const layoutDims = schema?.dims.filter((d) => d.id !== 'freq') ?? []

  return (
    <section aria-label={t(uiLang, 'builder.title')} className="mt-12">
      <h2 className="text-lg font-semibold tracking-tight">
        {t(uiLang, 'builder.title')} · <code className="font-mono text-base">{selectedDataset}</code>
      </h2>

      {!schema && !error && (
        <p className="mt-3 text-sm opacity-80" role="status">
          {t(uiLang, 'builder.loadingSchema')}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {t(uiLang, 'builder.errorSchema')} {error}
        </p>
      )}

      {schema && state && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {schema.dims
              .filter((d) => d.id !== 'time')
              .map((dim) => (
                <DimensionSection
                  key={dim.id}
                  dim={dim}
                  state={state}
                  onToggle={(d, code) => {
                    setState((s) => (s ? toggleValue(s, d, code) : s))
                    setApplied(false)
                  }}
                  onAll={(d, all) => {
                    setState((s) => (s ? setAllValues(s, schema, d, all) : s))
                    setApplied(false)
                  }}
                  onPreset={(preset) => {
                    setState((s) => (s ? applyGeoPreset(s, schema, preset).state : s))
                    setApplied(false)
                  }}
                />
              ))}
          </div>

          {schema.dims
            .filter((d) => d.id === 'time')
            .map((dim) => (
              <TimeSection
                key={dim.id}
                dim={dim}
                time={state.time}
                onChange={(time) => {
                  setState((s) => (s ? { ...s, time } : s))
                  setApplied(false)
                }}
              />
            ))}

          <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 shadow-sm">
            <label className="text-sm">
              {t(uiLang, 'builder.rows')}
              <select
                value={state.rows[0]}
                onChange={(e) => setState((s) => (s ? { ...s, rows: [e.target.value] } : s))}
                className="ml-2 rounded-md border px-2 py-1"
              >
                {layoutDims.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              {t(uiLang, 'builder.columns')}
              <select
                value={state.columns[0]}
                onChange={(e) => setState((s) => (s ? { ...s, columns: [e.target.value] } : s))}
                className="ml-2 rounded-md border px-2 py-1"
              >
                {layoutDims.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              onClick={() =>
                setState((s) =>
                  s ? { ...s, rows: s.columns, columns: s.rows } : s,
                )
              }
            >
              {t(uiLang, 'builder.swap')}
            </button>
          </div>

          {budget && (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-sm">
                {t(uiLang, 'builder.estimate')}:{' '}
                <strong>{budget.cells.toLocaleString('es-ES')}</strong>{' '}
                {t(uiLang, 'builder.cells')} / {budget.budget.toLocaleString('es-ES')}
              </p>
              {budget.overBudget && (
                <p className="mt-1 text-sm font-medium text-red-800" role="alert">
                  {t(uiLang, 'builder.overBudget')}
                </p>
              )}
              <button
                type="button"
                disabled={budget.overBudget}
                onClick={() => {
                  setBuilderSpec(toPivotSpec(selectedDataset, state))
                  setApplied(true)
                }}
                className="mt-3 rounded-md bg-[#0b1f3a] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t(uiLang, 'builder.apply')}
              </button>
              {applied && (
                <p className="mt-2 text-sm text-emerald-800" role="status">
                  {t(uiLang, 'builder.applied')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
