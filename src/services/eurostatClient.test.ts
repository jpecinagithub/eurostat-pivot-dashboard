import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PivotSpec } from '../core/types'
import {
  EurostatApiError,
  _resetQueuesForTests,
  apiBaseFor,
  buildQuery,
  errorFromResponse,
  fetchDataset,
  type FetchImpl,
} from './eurostatClient'

const baseSpec: PivotSpec = {
  dataset: 'nama_10_gdp',
  lang: 'EN',
  filters: { unit: ['CP_MEUR'], na_item: ['B1GQ'], geo: ['ES', 'FR'] },
  time: { mode: 'last', n: 3 },
  rows: ['geo'],
  columns: ['time'],
}

function paramsOf(url: string): URLSearchParams {
  return new URL(url).searchParams
}

describe('buildQuery (SDD §2.2)', () => {
  it('monta la URL de la Statistics API con format y lang', () => {
    const url = buildQuery(baseSpec)
    expect(url.startsWith('https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nama_10_gdp?')).toBe(true)
    const p = paramsOf(url)
    expect(p.get('format')).toBe('JSON')
    expect(p.get('lang')).toBe('EN')
  })

  it('repite el parámetro por cada valor de una dimensión', () => {
    const p = paramsOf(buildQuery(baseSpec))
    expect(p.getAll('geo')).toEqual(['ES', 'FR'])
    expect(p.get('unit')).toBe('CP_MEUR')
    expect(p.get('na_item')).toBe('B1GQ')
  })

  it('es determinista: la misma spec produce la misma URL (clave de caché)', () => {
    const shuffled: PivotSpec = {
      ...baseSpec,
      filters: { geo: ['ES', 'FR'], na_item: ['B1GQ'], unit: ['CP_MEUR'] },
    }
    expect(buildQuery(shuffled)).toBe(buildQuery(baseSpec))
  })

  it('modo last → lastTimePeriod, y ningún otro parámetro temporal', () => {
    const p = paramsOf(buildQuery(baseSpec))
    expect(p.get('lastTimePeriod')).toBe('3')
    expect(p.has('sinceTimePeriod')).toBe(false)
    expect(p.has('untilTimePeriod')).toBe(false)
    expect(p.has('time')).toBe(false)
  })

  it('modo range → since+until combinados, sin lastTimePeriod', () => {
    const p = paramsOf(
      buildQuery({ ...baseSpec, time: { mode: 'range', since: '2015', until: '2024' } }),
    )
    expect(p.get('sinceTimePeriod')).toBe('2015')
    expect(p.get('untilTimePeriod')).toBe('2024')
    expect(p.has('lastTimePeriod')).toBe(false)
  })

  it('modo values → time repetido', () => {
    const p = paramsOf(
      buildQuery({ ...baseSpec, time: { mode: 'values', values: ['2022', '2024'] } }),
    )
    expect(p.getAll('time')).toEqual(['2022', '2024'])
    expect(p.has('lastTimePeriod')).toBe(false)
  })

  it('geoLevel solo es válido y viaja como parámetro', () => {
    const p = paramsOf(
      buildQuery({ ...baseSpec, filters: { unit: ['CP_MEUR'] }, geoLevel: 'country' }),
    )
    expect(p.get('geoLevel')).toBe('country')
    expect(p.has('geo')).toBe(false)
  })

  it('geoLevel + filtro geo = invalid_spec en cliente (la API daría fault 150)', () => {
    expect(() => buildQuery({ ...baseSpec, geoLevel: 'country' })).toThrowError(
      expect.objectContaining({ kind: 'invalid_spec' }),
    )
  })

  it('la dimensión time en filters no se duplica: la gobierna spec.time', () => {
    const p = paramsOf(
      buildQuery({ ...baseSpec, filters: { ...baseSpec.filters, time: ['1999'] } }),
    )
    expect(p.getAll('time')).toEqual([])
    expect(p.get('lastTimePeriod')).toBe('3')
  })

  it('valida lastTimePeriod y el rango', () => {
    expect(() => buildQuery({ ...baseSpec, time: { mode: 'last', n: 0 } })).toThrowError(
      expect.objectContaining({ kind: 'invalid_spec' }),
    )
    expect(() =>
      buildQuery({ ...baseSpec, time: { mode: 'range', since: '2024', until: '2015' } }),
    ).toThrowError(expect.objectContaining({ kind: 'invalid_spec' }))
    expect(() => buildQuery({ ...baseSpec, time: { mode: 'values', values: [] } })).toThrowError(
      expect.objectContaining({ kind: 'invalid_spec' }),
    )
  })

  it('los datasets DS- (Comext) usan su base propia', () => {
    expect(apiBaseFor('DS-057555')).toContain('/api/comext/')
    expect(apiBaseFor('nama_10_gdp')).toContain('/api/dissemination/')
    const url = buildQuery({ ...baseSpec, dataset: 'DS-057555' })
    expect(url).toContain('/api/comext/dissemination/statistics/1.0/data/DS-057555?')
  })
})

describe('errorFromResponse (RF-10/RF-11)', () => {
  it('fault 100 = no_results (selección vacía, no error de red)', () => {
    const e = errorFromResponse(400, JSON.stringify({ fault: 100, label: 'No results found' }))
    expect(e.kind).toBe('no_results')
  })

  it('fault 140/150 se distinguen', () => {
    expect(errorFromResponse(400, JSON.stringify({ fault: 140 })).kind).toBe('syntax')
    expect(errorFromResponse(400, JSON.stringify({ fault: 150 })).kind).toBe('semantic')
  })

  it('413 EXTRACTION_TOO_BIG = too_big', () => {
    const e = errorFromResponse(
      413,
      'EXTRACTION_TOO_BIG: The requested extraction is too big, estimated 420709314 rows, max authorised is 5000000',
    )
    expect(e.kind).toBe('too_big')
  })

  it('413 ASYNCHRONOUS_RESPONSE = in_preparation, con clave si la trae', () => {
    const key = '98de05ea-540a-43d3-903b-7c9e14faf808'
    const e = errorFromResponse(
      413,
      JSON.stringify({ warning: { status: 413, label: `ASYNCHRONOUS_RESPONSE ${key}` } }),
    )
    expect(e.kind).toBe('in_preparation')
    expect(e.asyncKey).toBe(key)
  })

  it('500 = server y 404 = no_results', () => {
    expect(errorFromResponse(500, '').kind).toBe('server')
    expect(errorFromResponse(404, '').kind).toBe('no_results')
  })
})

describe('fetchDataset serializado por dataset (C6)', () => {
  beforeEach(() => _resetQueuesForTests())

  function delayedFetch(delayMs: number, tracker: { active: number; max: number }): FetchImpl {
    return vi.fn(async () => {
      tracker.active += 1
      tracker.max = Math.max(tracker.max, tracker.active)
      await new Promise((r) => setTimeout(r, delayMs))
      tracker.active -= 1
      return new Response(JSON.stringify({ version: '2.0', class: 'dataset' }), { status: 200 })
    }) as FetchImpl
  }

  it('dos extracciones del mismo dataset nunca se solapan', async () => {
    const tracker = { active: 0, max: 0 }
    const fetchImpl = delayedFetch(20, tracker)
    await Promise.all([
      fetchDataset(baseSpec, { fetchImpl }),
      fetchDataset(baseSpec, { fetchImpl }),
      fetchDataset(baseSpec, { fetchImpl }),
    ])
    expect(tracker.max).toBe(1)
  })

  it('datasets distintos sí pueden solaparse', async () => {
    const tracker = { active: 0, max: 0 }
    const fetchImpl = delayedFetch(20, tracker)
    await Promise.all([
      fetchDataset(baseSpec, { fetchImpl }),
      fetchDataset({ ...baseSpec, dataset: 'demo_pjan' }, { fetchImpl }),
    ])
    expect(tracker.max).toBe(2)
  })

  it('un fallo no rompe la cola del dataset', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      if (calls === 1) return new Response('boom', { status: 500 })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as unknown as FetchImpl
    await expect(fetchDataset(baseSpec, { fetchImpl })).rejects.toMatchObject({ kind: 'server' })
    await expect(fetchDataset(baseSpec, { fetchImpl })).resolves.toEqual({ ok: true })
  })

  it('un error de red se tipifica como network', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as FetchImpl
    await expect(fetchDataset(baseSpec, { fetchImpl })).rejects.toMatchObject({ kind: 'network' })
  })

  it('pide exactamente la URL de buildQuery', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ version: '2.0' }), { status: 200 }),
    ) as unknown as FetchImpl
    await fetchDataset(baseSpec, { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledWith(
      buildQuery(baseSpec),
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('EurostatApiError es un Error con kind', () => {
    const e = new EurostatApiError('too_big', 'x')
    expect(e).toBeInstanceOf(Error)
    expect(e.kind).toBe('too_big')
  })
})
