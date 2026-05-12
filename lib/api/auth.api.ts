/**
 * Couche d'accès API — Authentification
 *
 * Responsabilité unique : effectuer les appels HTTP vers le backend /api/auth.
 * Aucune gestion d'état React ici — uniquement du fetch pur.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== "undefined" && window.location.hostname !== "localhost" 
    ? "/api" 
    : "http://localhost:5000/api")
export const TOKEN_KEY         = "pfe_access_token"
export const REFRESH_TOKEN_KEY = "pfe_refresh_token"

// ── Helpers tokens ────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// ── Fetch authentifié ─────────────────────────────────────────────────────────

export async function authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  }

  if (token) headers["Authorization"] = `Bearer ${token}`

  const finalUrl = `${API_BASE_URL}${endpoint}`
  console.log(`[API Call] ${options.method || 'GET'} ${finalUrl}`)

  return fetch(finalUrl, { ...options, headers })
}

// ── Appels API ────────────────────────────────────────────────────────────────

export async function loginApi(email: string, password: string) {
  const res = await authFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  return { data: await res.json(), ok: res.ok }
}

export async function verify2FAApi(code: string, tempToken: string) {
  const res = await fetch(`${API_BASE_URL}/auth/verify-2fa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tempToken}`,
    },
    body: JSON.stringify({ code }),
  })
  return { data: await res.json(), ok: res.ok }
}

export async function registerApi(nom: string, prenom: string, email: string, password: string) {
  const res = await authFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ nom, prenom, email, password }),
  })
  return { data: await res.json(), ok: res.ok }
}

export async function logoutApi(token: string) {
  return fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

export async function getMeApi() {
  const res = await authFetch("/auth/me")
  return { data: await res.json(), ok: res.ok }
}

export async function updateProfileApi(nom: string, prenom: string) {
  const res = await authFetch("/auth/me", {
    method: "PUT",
    body: JSON.stringify({ nom, prenom }),
  })
  return { data: await res.json(), ok: res.ok }
}

export async function updatePasswordApi(old_password: string, new_password: string) {
  const res = await authFetch("/auth/me/password", {
    method: "PUT",
    body: JSON.stringify({ old_password, new_password }),
  })
  return { data: await res.json(), ok: res.ok }
}

export async function initPasswordResetApi(email: string) {
  const res = await fetch(`${API_BASE_URL}/auth/forgot-password/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  return { data: await res.json(), ok: res.ok }
}

export async function verifyPasswordReset2FAApi(code: string, token: string) {
  const res = await fetch(`${API_BASE_URL}/auth/forgot-password/verify-2fa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  })
  return { data: await res.json(), ok: res.ok }
}

export async function resetPasswordApi(new_password: string, token: string) {
  const res = await fetch(`${API_BASE_URL}/auth/forgot-password/reset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ new_password }),
  })
  return { data: await res.json(), ok: res.ok }
}
