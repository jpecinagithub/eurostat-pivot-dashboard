import { useEffect, useRef, useState } from 'react'
import type { PivotSpec } from '../core/types'
import {
  isNewer,
  lastBrusselsWindow,
  nextBrusselsCheck,
  probeUpdated,
} from '../services/freshnessService'

/**
 * Vigilancia de frescura de UN panel (T13, RF-22/23/24).
 *
 * - Si desde la descarga ya pasó una ventana de carga de Eurostat
 *   (11:00/23:00 Bruselas), comprueba pronto tras montar.
 * - Si no, duerme hasta la siguiente ventana (11:05/23:05) y
 *   comprueba entonces. Un solo probe mínimo por dataset y ciclo.
 * - Detectar datos nuevos solo AVISA (`freshUpdated`); aplicar el
 *   refresco es siempre decisión del usuario (RF-24).
 */
export function useFreshness(
  spec: PivotSpec | null,
  seenUpdated: string | undefined,
  fetchedAt: number | null,
): { freshUpdated: string | null; clearFresh: () => void } {
  const [freshUpdated, setFreshUpdated] = useState<string | null>(null)
  const specRef = useRef(spec)
  specRef.current = spec

  useEffect(() => {
    setFreshUpdated(null)
  }, [spec?.dataset, seenUpdated])

  useEffect(() => {
    if (!spec || !seenUpdated) return
    let alive = true
    const check = async () => {
      const s = specRef.current
      if (!s) return
      try {
        const u = await probeUpdated(s)
        if (alive && u && isNewer(u, seenUpdated)) setFreshUpdated(u)
      } catch {
        /* probe fallido: se reintentará en la siguiente ventana */
      }
    }
    const now = new Date()
    const overdue = fetchedAt !== null && lastBrusselsWindow(now).getTime() > fetchedAt
    const delay = overdue
      ? 2500
      : Math.max(1000, nextBrusselsCheck(now).getTime() - now.getTime())
    const timer = window.setTimeout(() => void check(), delay)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [spec, seenUpdated, fetchedAt])

  return { freshUpdated, clearFresh: () => setFreshUpdated(null) }
}
