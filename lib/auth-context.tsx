"use client"

/**
 * Contexte d'authentification — Assurances BIAT
 *
 * Responsabilité unique (SRP) :
 *   - Gérer l'état global de l'utilisateur (user, isLoading)
 *   - Exposer des actions qui délèguent les appels HTTP à la couche API (lib/api/)
 *
 * Aucun fetch() direct ici — toutes les requêtes HTTP sont dans lib/api/auth.api.ts
 * et lib/api/admin.api.ts.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

import {
  loginApi,
  verify2FAApi,
  registerApi,
  logoutApi,
  getMeApi,
  updateProfileApi,
  updatePasswordApi,
  initPasswordResetApi,
  verifyPasswordReset2FAApi,
  resetPasswordApi,
  getAccessToken,
  setTokens,
  clearTokens,
  // Re-exports pour la rétrocompatibilité avec les fichiers qui importent depuis auth-context
  authFetch,
  API_BASE_URL,
} from "./api/auth.api"

import {
  adminResetUserPasswordApi,
  adminDeleteUserApi,
} from "./api/admin.api"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  nom: string
  prenom: string
  full_name: string
  email: string
  role: "user" | "admin"
  is_active: boolean
  mfa_enabled: boolean
  created_at: string
  updated_at: string
  last_login: string | null
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<LoginResponse>
  verify2FA: (code: string, tempToken: string) => Promise<void>
  register: (nom: string, prenom: string, email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>

  // Profil & Mot de passe oublié
  updateProfile: (nom: string, prenom: string) => Promise<void>
  updatePassword: (old_password: string, new_password: string) => Promise<void>
  initPasswordReset: (email: string) => Promise<{ reset_token: string }>
  verifyPasswordReset2FA: (code: string, token: string) => Promise<{ reset_pw_token: string }>
  resetPassword: (new_password: string, token: string) => Promise<void>

  // Admin
  adminResetUserPassword: (userId: string, newPassword: string) => Promise<void>
  adminDeleteUser: (userId: string) => Promise<void>
}

interface LoginResponse {
  requires_2fa: boolean
  temp_token?: string
}

// ── Contexte ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]         = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Rafraîchit l'état utilisateur depuis le backend
  const refreshUser = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const { data, ok } = await getMeApi()
      if (ok) {
        setUser(data.user)
      } else {
        clearTokens()
        setUser(null)
      }
    } catch {
      clearTokens()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { refreshUser() }, [refreshUser])

  // ── Connexion (email + mot de passe) ──────────────────────────────────────
  const login = async (email: string, password: string): Promise<LoginResponse> => {
    const { data, ok } = await loginApi(email, password)
    if (!ok) throw new Error(data.error || "Erreur de connexion")

    if (data.requires_2fa) {
      return { requires_2fa: true, temp_token: data.temp_token }
    }

    setTokens(data.access_token, data.refresh_token)
    setUser(data.user)
    return { requires_2fa: false }
  }

  // ── Vérification OTP ──────────────────────────────────────────────────────
  const verify2FA = async (code: string, tempToken: string): Promise<void> => {
    const { data, ok } = await verify2FAApi(code, tempToken)
    if (!ok) throw new Error(data.error || "Code de vérification invalide")

    setTokens(data.access_token, data.refresh_token)
    setUser(data.user)
  }

  // ── Inscription ───────────────────────────────────────────────────────────
  const register = async (nom: string, prenom: string, email: string, password: string): Promise<void> => {
    const { data, ok } = await registerApi(nom, prenom, email, password)
    if (!ok) throw new Error(data.error || "Erreur lors de l'inscription")
  }

  // ── Déconnexion ───────────────────────────────────────────────────────────
  const logout = () => {
    const token = getAccessToken()
    if (token) logoutApi(token)
    clearTokens()
    setUser(null)
  }

  // ── Mise à jour du profil ─────────────────────────────────────────────────
  const updateProfile = async (nom: string, prenom: string): Promise<void> => {
    const { data, ok } = await updateProfileApi(nom, prenom)
    if (!ok) throw new Error(data.error || "Erreur de mise à jour")
    setUser(data.user)
  }

  const updatePassword = async (old_password: string, new_password: string): Promise<void> => {
    const { data, ok } = await updatePasswordApi(old_password, new_password)
    if (!ok) throw new Error(data.error || "Erreur de changement de mot de passe")
  }

  // ── Mot de passe oublié (3 étapes) ───────────────────────────────────────
  const initPasswordReset = async (email: string) => {
    const { data, ok } = await initPasswordResetApi(email)
    if (!ok) throw new Error(data.error || "Erreur")
    return { reset_token: data.reset_token }
  }

  const verifyPasswordReset2FA = async (code: string, token: string) => {
    const { data, ok } = await verifyPasswordReset2FAApi(code, token)
    if (!ok) throw new Error(data.error || "Erreur")
    return { reset_pw_token: data.reset_pw_token }
  }

  const resetPassword = async (new_password: string, token: string) => {
    const { data, ok } = await resetPasswordApi(new_password, token)
    if (!ok) throw new Error(data.error || "Erreur")
  }

  // ── Actions Admin ─────────────────────────────────────────────────────────
  const adminResetUserPassword = async (userId: string, newPassword: string): Promise<void> => {
    const { data, ok } = await adminResetUserPasswordApi(userId, newPassword)
    if (!ok) throw new Error(data.error || "Erreur lors de la réinitialisation")
  }

  const adminDeleteUser = async (userId: string): Promise<void> => {
    const { data, ok } = await adminDeleteUserApi(userId)
    if (!ok) throw new Error(data.error || "Erreur lors de la suppression")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        login,
        verify2FA,
        register,
        logout,
        refreshUser,
        updateProfile,
        updatePassword,
        initPasswordReset,
        verifyPasswordReset2FA,
        resetPassword,
        adminResetUserPassword,
        adminDeleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider")
  return context
}

// ── Re-exports utilitaires (rétrocompatibilité) ───────────────────────────────
export { authFetch, getAccessToken, API_BASE_URL }
