"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useAuth, authFetch } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  User,
  ShieldCheck,
  LogOut,
  Mail,
  Calendar,
  CheckCircle,
  AlertCircle,
  Settings,
  Bell,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Crown,
  Lock,
  BarChart2,
} from "lucide-react"

export default function ProfilPage() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated, isAdmin, logout, refreshUser, updateProfile, updatePassword } = useAuth()

  // Profile Edit states
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editNom, setEditNom]                   = useState("")
  const [editPrenom, setEditPrenom]             = useState("")
  const [editLoading, setEditLoading]           = useState(false)
  const [editError, setEditError]               = useState("")

  // Password Change states
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [oldPassword, setOldPassword]               = useState("")
  const [newPassword, setNewPassword]               = useState("")
  const [passwordLoading, setPasswordLoading]       = useState(false)
  const [passwordError, setPasswordError]           = useState("")
  const [passwordSuccess, setPasswordSuccess]       = useState("")

  // 2FA Setup states
  const [showSetup2FA, setShowSetup2FA]       = useState(false)
  const [qrCode, setQrCode]                   = useState<string | null>(null)
  const [secret, setSecret]                   = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState("")
  const [setupLoading, setSetupLoading]       = useState(false)
  const [setupError, setSetupError]           = useState("")
  const [setupSuccess, setSetupSuccess]       = useState("")

  // Disable 2FA states
  const [showDisable2FA, setShowDisable2FA]   = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [disableLoading, setDisableLoading]   = useState(false)
  const [disableError, setDisableError]       = useState("")

  const fetchQRCode = useCallback(async () => {
    setSetupLoading(true)
    setSetupError("")

    try {
      const response = await authFetch("/auth/2fa/qrcode")
      const data     = await response.json()

      if (response.ok) {
        setQrCode(data.qrcode)
        setSecret(data.secret)
        setShowSetup2FA(true)
      } else {
        setSetupError(data.error || "Erreur lors de la génération du QR code")
      }
    } catch {
      setSetupError("Erreur de connexion au serveur")
    } finally {
      setSetupLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login")
  }, [isLoading, isAuthenticated, router])

  // Auto-fetch QR Code si 2FA non encore configurée
  useEffect(() => {
    if (user && !user.mfa_enabled && !qrCode && !setupLoading) {
      fetchQRCode()
    }
  }, [user, qrCode, setupLoading, fetchQRCode])

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setSetupLoading(true)
    setSetupError("")
    setSetupSuccess("")

    try {
      const response = await authFetch("/auth/2fa/enable", {
        method: "POST",
        body:   JSON.stringify({ code: verificationCode }),
      })
      const data = await response.json()

      if (response.ok) {
        setSetupSuccess("2FA activée avec succès !")
        setShowSetup2FA(false)
        setVerificationCode("")
        await refreshUser()
      } else {
        setSetupError(data.error || "Code invalide")
      }
    } catch {
      setSetupError("Erreur de connexion au serveur")
    } finally {
      setSetupLoading(false)
    }
  }

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setDisableLoading(true)
    setDisableError("")

    try {
      const response = await authFetch("/auth/2fa/disable", {
        method: "POST",
        body:   JSON.stringify({ password: disablePassword }),
      })
      const data = await response.json()

      if (response.ok) {
        setShowDisable2FA(false)
        setDisablePassword("")
        await refreshUser()
      } else {
        setDisableError(data.error || "Mot de passe incorrect")
      }
    } catch {
      setDisableError("Erreur de connexion au serveur")
    } finally {
      setDisableLoading(false)
    }
  }

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError("")
    try {
      await updateProfile(editNom, editPrenom)
      setIsEditingProfile(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setEditLoading(false)
    }
  }

  const startEditProfile = () => {
    if (user) {
      setEditNom(user.nom)
      setEditPrenom(user.prenom)
      setIsEditingProfile(true)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordLoading(true)
    setPasswordError("")
    setPasswordSuccess("")
    try {
      await updatePassword(oldPassword, newPassword)
      setShowChangePassword(false)
      setOldPassword("")
      setNewPassword("")
      setPasswordSuccess("Mot de passe modifié avec succès !")
      setTimeout(() => setPasswordSuccess(""), 5000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setPasswordLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Spinner className="h-12 w-12 mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const initials = `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase()

  return (
    <div className="min-h-screen bg-[#e0e1e1]">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-[#093215] shadow-lg">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center">
            <Image
              src="/images/logo-assurances-biat.jpg"
              alt="Assurances BIAT"
              width={160}
              height={44}
              className="h-11 w-auto object-contain bg-white rounded-md px-2 py-1 shadow-sm"
              priority
            />
          </div>

          <nav className="hidden md:flex items-center gap-2 lg:gap-4">
            {isAdmin && (
              <Button
                variant="ghost"
                className="text-[#acc936] hover:text-[#acc936] hover:bg-white/20 gap-2 font-semibold"
                onClick={() => router.push("/admin")}
              >
                <LayoutDashboard className="h-4 w-4" />
                Administration
              </Button>
            )}
            <Button 
              variant="ghost" 
              className="text-white hover:text-white hover:bg-white/20 gap-2 font-medium" 
              disabled={!user.mfa_enabled}
              onClick={() => {
                if (user.mfa_enabled && isAdmin) {
                  router.push("/analyses")
                }
              }}
            >
              <BarChart2 className="h-4 w-4" />
              Analyses
            </Button>
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/20 gap-2 font-medium" disabled={!user.mfa_enabled}>
              <Bell className="h-4 w-4" />
              Notifications
            </Button>
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/20 gap-2 font-medium">
              <HelpCircle className="h-4 w-4" />
              Aide
            </Button>
          </nav>

          <div className="flex items-center justify-end gap-4 min-w-[150px]">
            <div className="hidden sm:block text-right">
              <p className="text-white text-sm font-semibold">{user.full_name}</p>
              <p className="text-white/80 text-xs">{user.email}</p>
            </div>
            <Button
              id="logout-button"
              onClick={handleLogout}
              className="bg-white text-[#093215] hover:bg-[#e0e1e1] font-semibold gap-2 border-0 shadow-sm transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#19542b] to-[#093215] rounded-2xl p-8 mb-8 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Bienvenue, {user.prenom} !</h1>
              <p className="text-white/80">
                {user.mfa_enabled
                  ? "Gérez votre compte et vos paramètres depuis votre espace profil."
                  : "Une dernière étape est requise pour sécuriser votre compte."}
              </p>
            </div>
            {isAdmin && (
              <div className="hidden md:flex flex-col items-end gap-2">
                <Badge className="bg-[#acc936] text-[#093215] font-bold px-3 py-1">
                  <Crown className="h-3.5 w-3.5 mr-1" />
                  Administrateur
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/30 text-white hover:bg-white/20 hover:text-white gap-2"
                  onClick={() => router.push("/admin")}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Tableau de bord admin
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Setup 2FA obligatoire ─────────────────────────────────── */}
        {!user.mfa_enabled ? (
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-2xl border-0 overflow-hidden">
              <div className="bg-[#19542b] p-6 text-white text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                  <ShieldCheck className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold">Action Requise : Sécurisez votre compte</h2>
                <p className="mt-2 text-white/80">
                  Pour accéder à votre profil et à vos contrats, vous devez obligatoirement
                  activer la double authentification (2FA).
                </p>
              </div>
              <CardContent className="p-8">
                <form onSubmit={handleEnable2FA} className="space-y-6">
                  {setupError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{setupError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div className="text-center p-6 bg-muted rounded-xl border-2 border-dashed border-muted-foreground/20">
                      <p className="text-sm font-medium mb-4">
                        1. Scannez ce QR code avec Microsoft / Google Authenticator
                      </p>
                      {setupLoading && !qrCode ? (
                        <div className="h-48 flex items-center justify-center">
                          <Spinner className="h-8 w-8 text-[#19542b]" />
                        </div>
                      ) : qrCode ? (
                        <div className="flex justify-center">
                          <img
                            src={qrCode}
                            alt="QR Code 2FA"
                            className="w-48 h-48 rounded-lg border-4 border-white shadow-md mx-auto"
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          2. Entrez le code à 6 chiffres généré par l&apos;application
                        </p>
                        <Input
                          id="mfa-code-input"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="000000"
                          className="text-center text-3xl tracking-[0.5em] font-mono h-16 border-2 focus:border-[#19542b] focus:ring-[#19542b]/20"
                          required
                        />
                      </div>

                      {secret && (
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-xs text-muted-foreground mb-1">
                            Ou saisissez cette clé manuellement :
                          </p>
                          <code className="text-xs font-mono font-bold break-all text-[#19542b]">
                            {secret}
                          </code>
                        </div>
                      )}

                      <Button
                        id="enable-2fa-submit"
                        type="submit"
                        className="w-full h-14 text-lg bg-[#19542b] hover:bg-[#093215] shadow-lg"
                        disabled={setupLoading || verificationCode.length !== 6}
                      >
                        {setupLoading ? (
                          <Spinner className="h-5 w-5 mr-2" />
                        ) : (
                          <ShieldCheck className="h-5 w-5 mr-2" />
                        )}
                        Activer la sécurité
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* ── Dashboard profil (2FA activée) ───────────────────────── */
          <div className="grid gap-6 lg:grid-cols-3 md:items-start">
            {/* Profile Card */}
            <Card className="shadow-lg border-0 lg:col-span-1 overflow-hidden p-0">
              <CardHeader className="bg-[#19542b] text-white p-6">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Mon Profil
                </CardTitle>
                <CardDescription className="text-white/70">
                  Informations de votre compte
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                {/* Avatar + infos */}
                {!isEditingProfile ? (
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#19542b] text-white text-xl font-bold shadow-inner shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-lg truncate">{user.full_name}</p>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      {isAdmin && (
                        <Badge className="mt-1 bg-[#acc936] text-[#093215] text-xs font-bold">
                          <Crown className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleEditProfile} className="p-4 bg-muted/50 rounded-xl space-y-3 border">
                    {editError && (
                      <Alert variant="destructive" className="py-2">
                        <AlertDescription className="text-xs">{editError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Prénom</label>
                      <Input value={editPrenom} onChange={(e) => setEditPrenom(e.target.value)} className="h-8 text-sm" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Nom</label>
                      <Input value={editNom} onChange={(e) => setEditNom(e.target.value)} className="h-8 text-sm" required />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button type="submit" className="h-8 bg-[#19542b] flex-1 text-xs" disabled={editLoading}>
                        {editLoading ? <Spinner className="h-3 w-3" /> : "Enregistrer"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditingProfile(false)} className="h-8 flex-1 text-xs">
                        Annuler
                      </Button>
                    </div>
                  </form>
                )}

                <Separator />

                <div className="space-y-3">
                  <div className="flex flex-col gap-1 text-sm p-2 hover:bg-muted/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>Email :</span>
                    </div>
                    <span className="font-medium break-all pl-6">{user.email}</span>
                  </div>

                  <div className="flex items-center gap-3 text-sm p-2 hover:bg-muted/50 rounded-lg transition-colors">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Inscrit le :</span>
                    <span className="font-medium ml-auto">
                      {new Date(user.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  </div>

                  {user.last_login && (
                    <div className="flex items-center gap-3 text-sm p-2 hover:bg-muted/50 rounded-lg transition-colors">
                      <CheckCircle className="h-4 w-4 text-[#19542b] shrink-0" />
                      <span className="text-muted-foreground">Dernière connexion :</span>
                      <span className="font-medium ml-auto text-xs">
                        {new Date(user.last_login).toLocaleDateString("fr-FR", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <Button variant="outline" className="w-full gap-2 hover:bg-muted" onClick={startEditProfile} disabled={isEditingProfile}>
                    <Settings className="h-4 w-4" />
                    Modifier mes informations
                  </Button>
                  
                  {!showChangePassword ? (
                    <Button variant="outline" className="w-full gap-2 hover:bg-muted" onClick={() => setShowChangePassword(true)}>
                      <Lock className="h-4 w-4" />
                      Modifier mon mot de passe
                    </Button>
                  ) : (
                    <form onSubmit={handleChangePassword} className="p-3 bg-muted/30 rounded-lg border space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-[#093215]">Nouveau mot de passe</p>
                      </div>
                      
                      {passwordError && (
                        <Alert variant="destructive" className="py-2">
                          <AlertDescription className="text-xs">{passwordError}</AlertDescription>
                        </Alert>
                      )}
                      
                      <Input
                        type="password"
                        placeholder="Ancien mot de passe"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="h-8 text-sm"
                        required
                      />
                      <Input
                        type="password"
                        placeholder="Nouveau mot de passe"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-8 text-sm"
                        required
                        minLength={8}
                      />
                      
                      <div className="flex gap-2 pt-1">
                        <Button type="submit" className="h-8 bg-[#19542b] flex-1 text-xs" disabled={passwordLoading}>
                          {passwordLoading ? <Spinner className="h-3 w-3" /> : "Valider"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setShowChangePassword(false)} className="h-8 flex-1 text-xs border">
                          Fermer
                        </Button>
                      </div>
                    </form>
                  )}
                  
                  {passwordSuccess && (
                     <Alert className="border-[#19542b] bg-[#19542b]/10 py-2 mt-1">
                       <CheckCircle className="h-4 w-4 text-[#19542b]" />
                       <AlertDescription className="text-[#19542b] text-xs">
                         {passwordSuccess}
                       </AlertDescription>
                     </Alert>
                  )}
                </div>

                {/* Section 2FA */}
                <div className="mt-4 pt-4 border-t border-dashed">
                  <div className="flex items-center justify-between mb-4">
                    <span className="flex items-center gap-2 font-medium text-[#093215]">
                      <ShieldCheck className="h-4 w-4 text-[#19542b]" />
                      Sécurité du compte
                    </span>
                    <Badge variant="default" className="bg-[#19542b] text-[10px]">
                      2FA Activée
                    </Badge>
                  </div>

                  {setupSuccess && (
                    <Alert className="mb-4 border-[#19542b] bg-[#19542b]/10 py-2">
                      <CheckCircle className="h-4 w-4 text-[#19542b]" />
                      <AlertDescription className="text-[#19542b] text-xs">
                        {setupSuccess}
                      </AlertDescription>
                    </Alert>
                  )}

                  {!showDisable2FA ? (
                    <Button
                      id="disable-2fa-btn"
                      variant="ghost"
                      className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive text-sm h-9"
                      onClick={() => setShowDisable2FA(true)}
                    >
                      Désactiver la 2FA
                    </Button>
                  ) : (
                    <form onSubmit={handleDisable2FA} className="space-y-3 p-3 bg-muted rounded-lg mt-2">
                      {disableError && (
                        <Alert variant="destructive" className="py-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">{disableError}</AlertDescription>
                        </Alert>
                      )}
                      <p className="text-xs font-medium text-destructive">
                        Confirmez avec votre mot de passe :
                      </p>
                      <div className="flex flex-col gap-2">
                        <Input
                          id="disable-2fa-password"
                          type="password"
                          value={disablePassword}
                          onChange={(e) => setDisablePassword(e.target.value)}
                          placeholder="Mot de passe"
                          className="h-9 text-sm"
                          required
                        />
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            variant="destructive"
                            disabled={disableLoading}
                            className="h-9 flex-1 px-3 text-xs"
                          >
                            {disableLoading ? <Spinner className="h-4 w-4" /> : "Désactiver"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowDisable2FA(false)
                              setDisablePassword("")
                              setDisableError("")
                            }}
                            className="h-9 px-3 flex-1 text-xs"
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contracts Card */}
            <div className="lg:col-span-2">
              <Card className="shadow-lg border-0 overflow-hidden h-full min-h-[400px] p-0 flex flex-col">
                <CardHeader className="bg-white border-b p-6">
                  <CardTitle className="flex items-center gap-2 text-[#093215]">
                    <FileText className="h-5 w-5 text-[#19542b]" />
                    Mes Contrats d&apos;Assurance
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 flex-1 bg-muted/30 h-full flex flex-col items-center justify-center">
                  <div className="flex flex-col items-center justify-center space-y-3 text-muted-foreground w-full flex-1">
                    <FileText className="h-12 w-12 opacity-20" />
                    <p className="text-lg font-medium text-foreground">Aucun contrat actif</p>
                    <p className="text-sm">Vous n&apos;avez souscrit à aucun contrat d&apos;assurance pour le moment.</p>
                    <Button
                      variant="outline"
                      className="mt-4 border-[#19542b] text-[#19542b] hover:bg-[#19542b] hover:text-white"
                    >
                      Découvrir nos offres
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="mt-12 bg-[#093215] text-white py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-white/60">
            &copy; {new Date().getFullYear()} Assurances BIAT. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  )
}
