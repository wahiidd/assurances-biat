/**
 * Couche d'accès API — Analyses KPI
 * Responsabilité unique : appel HTTP vers /api/analytics/kpis.
 */

import { authFetch } from "./auth.api"

export async function getKpisApi(filters?: Record<string, string>) {
  let endpoint = "/analytics/kpis"
  if (filters) {
    // Nettoyer les filtres vides avant de les envoyer
    const cleanedFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v != null && v !== "")
    )
    if (Object.keys(cleanedFilters).length > 0) {
      const params = new URLSearchParams(cleanedFilters)
      endpoint += `?${params.toString()}`
    }
  }
  const res = await authFetch(endpoint)
  return { data: await res.json(), ok: res.ok }
}
