/**
 * Couche d'accès API — Administration
 *
 * Responsabilité unique : effectuer les appels HTTP vers le backend /api/admin.
 * Aucune gestion d'état React ici — uniquement du fetch pur.
 */

import { authFetch } from "./auth.api"

export async function adminResetUserPasswordApi(userId: string, newPassword: string) {
  const res = await authFetch(`/admin/users/${userId}/reset-password`, {
    method: "PUT",
    body: JSON.stringify({ new_password: newPassword }),
  })
  return { data: await res.json(), ok: res.ok }
}

export async function adminDeleteUserApi(userId: string) {
  const res = await authFetch(`/admin/users/${userId}`, {
    method: "DELETE",
  })
  return { data: await res.json(), ok: res.ok }
}
