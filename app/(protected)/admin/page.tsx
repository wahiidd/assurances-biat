"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth, authFetch, API_BASE_URL, type User } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  Upload,
  Mail,
  LogOut,
  ShieldCheck,
  ShieldOff,
  CheckCircle,
  AlertCircle,
  FileText,
  Crown,
  User as UserIcon,
  RefreshCw,
  Send,
  Clock,
  Check,
  X,
  LayoutDashboard,
  FileUp,
  ArrowLeft,
  Lock,
  BarChart2,
} from "lucide-react"

// ── Types locaux ──────────────────────────────────────────────────────────────

interface Invitation {
  id: string
  email: string
  role_cible: string
  used: boolean
  expires_at: string
  created_at: string
  invited_by: string | null
}

interface CsvUpload {
  id: string
  filename: string
  nb_lignes: number | null
  status: "pending" | "processing" | "done" | "error"
  error_msg: string | null
  uploaded_at: string
  uploaded_by: string | null
}

// ── Composants utilitaires ────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, { label: string; cls: string }> = {
    done:       { label: "Traité",      cls: "bg-green-100 text-green-800 border-green-200" },
    processing: { label: "En cours",   cls: "bg-blue-100 text-blue-800 border-blue-200" },
    pending:    { label: "En attente", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    error:      { label: "Erreur",     cls: "bg-red-100 text-red-800 border-red-200" },
  }
  const { label, cls } = cfg[status] || { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200" }
  return <Badge variant="outline" className={`text-xs font-semibold ${cls}`}>{label}</Badge>
}

const RoleBadge = ({ role }: { role: string }) =>
  role === "admin" ? (
    <Badge className="bg-[#acc936] text-[#093215] font-bold text-xs">
      <Crown className="h-3 w-3 mr-1" /> Admin
    </Badge>
  ) : (
    <Badge variant="outline" className="text-xs">Utilisateur</Badge>
  )

const fmt = (dt: string) =>
  new Date(dt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })

// ── Page principale ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isAuthenticated, isAdmin, logout } = useAuth()

  // ── State : utilisateurs ────────────────────────────────────────
  const [users, setUsers]               = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError]     = useState("")
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  
  // ── State : actions urgence admin ───────────────────────────────
  const { adminResetUserPassword, adminDeleteUser } = useAuth()
  const [resetModalUserId, setResetModalUserId]     = useState<User | null>(null)
  const [adminNewPassword, setAdminNewPassword]     = useState("")
  const [actionLoading, setActionLoading]           = useState(false)
  const [actionError, setActionError]               = useState("")
  const [actionSuccess, setActionSuccess]           = useState("")
  const [deleteModalUserId, setDeleteModalUserId]   = useState<User | null>(null)

  // ── State : invitations ─────────────────────────────────────────
  const [invitations, setInvitations]       = useState<Invitation[]>([])
  const [inviteEmail, setInviteEmail]       = useState("")
  const [inviteLoading, setInviteLoading]   = useState(false)
  const [inviteSuccess, setInviteSuccess]   = useState("")
  const [inviteError, setInviteError]       = useState("")
  const [invListLoading, setInvListLoading] = useState(false)

  // ── State : CSV uploads ─────────────────────────────────────────
  const [uploads, setUploads]               = useState<CsvUpload[]>([])
  const [csvFile, setCsvFile]               = useState<File | null>(null)
  const [csvLoading, setCsvLoading]         = useState(false)
  const [csvSuccess, setCsvSuccess]         = useState("")
  const [csvError, setCsvError]             = useState("")
  const [uploadsLoading, setUploadsLoading] = useState(false)

  // ── Guards ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login")
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!authLoading && isAuthenticated && !isAdmin) router.push("/profil")
  }, [authLoading, isAuthenticated, isAdmin, router])

  // ── Fetch helpers ───────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    setUsersError("")
    try {
      const res  = await authFetch("/admin/users?per_page=100")
      const data = await res.json()
      if (res.ok) setUsers(data.users)
      else setUsersError(data.error || "Erreur lors du chargement")
    } catch { setUsersError("Erreur de connexion") }
    finally { setUsersLoading(false) }
  }, [])

  const fetchInvitations = useCallback(async () => {
    setInvListLoading(true)
    try {
      const res  = await authFetch("/admin/invitations")
      const data = await res.json()
      if (res.ok) setInvitations(data.invitations)
    } catch {}
    finally { setInvListLoading(false) }
  }, [])

  const fetchUploads = useCallback(async () => {
    setUploadsLoading(true)
    try {
      const res  = await authFetch("/admin/csv/uploads")
      const data = await res.json()
      if (res.ok) setUploads(data.uploads)
    } catch {}
    finally { setUploadsLoading(false) }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchUsers()
      fetchInvitations()
      fetchUploads()
    }
  }, [isAdmin, fetchUsers, fetchInvitations, fetchUploads])

  // ── Actions ─────────────────────────────────────────────────────

  const handleToggleActive = async (userId: string) => {
    setToggleLoading(userId)
    try {
      const res  = await authFetch(`/admin/users/${userId}/toggle-active`, { method: "PUT" })
      const data = await res.json()
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)))
      }
    } catch {}
    finally { setToggleLoading(null) }
  }

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetModalUserId) return
    setActionLoading(true)
    setActionError("")
    setActionSuccess("")
    try {
      await adminResetUserPassword(resetModalUserId.id, adminNewPassword)
      setActionSuccess("Mot de passe modifié avec succès (Le MFA a été désactivé)")
      setTimeout(() => {
        setResetModalUserId(null)
        setAdminNewPassword("")
        setActionSuccess("")
      }, 3000)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setActionLoading(false)
    }
  }

  const handleAdminDeleteUser = async () => {
    if (!deleteModalUserId) return
    setActionLoading(true)
    setActionError("")
    try {
      await adminDeleteUser(deleteModalUserId.id)
      setUsers((prev) => prev.filter((u) => u.id !== deleteModalUserId.id))
      setDeleteModalUserId(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError("")
    setInviteSuccess("")

    try {
      const res  = await authFetch("/admin/invitations", {
        method: "POST",
        body:   JSON.stringify({ email: inviteEmail }),
      })
      const data = await res.json()

      if (res.ok) {
        setInviteSuccess(`Invitation envoyée à ${inviteEmail}`)
        setInviteEmail("")
        fetchInvitations()
      } else {
        setInviteError(data.error || "Erreur lors de l'envoi")
      }
    } catch {
      setInviteError("Erreur de connexion au serveur")
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!csvFile) return

    setCsvLoading(true)
    setCsvError("")
    setCsvSuccess("")

    try {
      const token = localStorage.getItem("pfe_access_token")
      let payload: any = null
      let isJson = false

      // Si le fichier est gros (> 4 Mo), on utilise Vercel Blob
      if (csvFile.size > 4 * 1024 * 1024) {
        setCsvSuccess("Téléchargement vers le stockage sécurisé (Vercel Blob) en cours...")
        
        const uploadResponse = await fetch(`/api/upload?filename=${encodeURIComponent(csvFile.name)}`, {
          method: "POST",
          body: csvFile,
        })

        if (!uploadResponse.ok) {
          throw new Error("Échec de l'upload vers Vercel Blob")
        }

        const blob = await uploadResponse.json()
        payload = JSON.stringify({ file_url: blob.url })
        isJson = true
        setCsvSuccess("Fichier stocké. Traitement par le serveur BIAT...")
      } else {
        // Pour les petits fichiers, on garde l'upload direct (plus rapide)
        const formData = new FormData()
        formData.append("file", csvFile)
        payload = formData
      }

      const res = await fetch(`${API_BASE_URL}/admin/csv/upload`, {
        method:  "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          ...(isJson ? { "Content-Type": "application/json" } : {})
        },
        body: payload,
      })
      
      const data = await res.json()

      if (res.ok) {
        setCsvSuccess(`Fichier traité : ${data.upload.nb_lignes?.toLocaleString("fr-FR")} lignes importées`)
        setCsvFile(null)
        // Réinitialiser l'input file
        const fileInput = document.getElementById("csv-file-input") as HTMLInputElement
        if (fileInput) fileInput.value = ""
        fetchUploads()
      } else {
        setCsvError(data.error || "Erreur lors du traitement")
      }
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "Erreur de connexion au serveur")
    } finally {
      setCsvLoading(false)
    }
  }

  // ── Render guards ────────────────────────────────────────────────

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e0e1e1]">
        <Spinner className="h-12 w-12 text-[#19542b]" />
      </div>
    )
  }

  const stats = {
    total:  users.length,
    active: users.filter((u) => u.is_active).length,
    admins: users.filter((u) => u.role === "admin").length,
  }

  // ── JSX ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#e0e1e1]">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-[#093215] shadow-lg">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/images/logo-assurances-biat.jpg"
              alt="Assurances BIAT"
              width={160}
              height={44}
              className="h-11 w-auto object-contain bg-white rounded-md px-2 py-1 shadow-sm"
              priority
            />
            <div className="hidden md:flex items-center gap-2">
              <Badge className="bg-[#acc936] text-[#093215] font-bold">
                <Crown className="h-3 w-3 mr-1" />
                Administration
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/20 gap-2 text-sm"
              onClick={() => router.push("/analyses")}
            >
              <BarChart2 className="h-4 w-4" />
              Analyses
            </Button>
            <Button
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/20 gap-2 text-sm"
              onClick={() => router.push("/profil")}
            >
              <ArrowLeft className="h-4 w-4" />
              Mon profil
            </Button>
            <div className="hidden sm:block text-right">
              <p className="text-white text-sm font-semibold">{user.full_name}</p>
              <p className="text-[#acc936] text-xs font-medium">Administrateur</p>
            </div>
            <Button
              id="admin-logout-btn"
              onClick={() => { logout(); router.push("/login") }}
              className="bg-white text-[#093215] hover:bg-[#e0e1e1] font-semibold gap-2 border-0 shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main className="container mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <LayoutDashboard className="h-7 w-7 text-[#19542b]" />
            <h1 className="text-3xl font-bold text-[#093215]">Tableau de bord</h1>
          </div>
          <p className="text-muted-foreground ml-10">
            Gérez les utilisateurs, les fichiers CSV et les invitations.
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Utilisateurs total",  value: stats.total,  icon: Users,      color: "text-blue-600",  bg: "bg-blue-50" },
            { label: "Comptes actifs",      value: stats.active, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
            { label: "Administrateurs",     value: stats.admins, icon: Crown,       color: "text-[#acc936]", bg: "bg-[#acc936]/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="shadow-sm border-0">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-white shadow-sm border h-12 p-1">
            <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-[#19542b] data-[state=active]:text-white">
              <Users className="h-4 w-4" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="csv" className="gap-2 data-[state=active]:bg-[#19542b] data-[state=active]:text-white">
              <FileUp className="h-4 w-4" />
              CSV
            </TabsTrigger>
            <TabsTrigger value="invitations" className="gap-2 data-[state=active]:bg-[#19542b] data-[state=active]:text-white">
              <Mail className="h-4 w-4" />
              Invitations
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════ Tab : Utilisateurs ═══════════════════ */}
          <TabsContent value="users">
            <Card className="shadow-lg border-0">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-[#093215] flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Gestion des utilisateurs
                  </CardTitle>
                  <CardDescription>Activez, désactivez et gérez les comptes.</CardDescription>
                </div>
                <Button
                  id="refresh-users-btn"
                  variant="outline"
                  size="sm"
                  onClick={fetchUsers}
                  disabled={usersLoading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${usersLoading ? "animate-spin" : ""}`} />
                  Actualiser
                </Button>
              </CardHeader>
              <CardContent>
                {usersError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{usersError}</AlertDescription>
                  </Alert>
                )}

                {usersLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Spinner className="h-8 w-8 text-[#19542b]" />
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#093215] text-white">
                            <th className="px-4 py-3 text-left font-semibold">Utilisateur</th>
                            <th className="px-4 py-3 text-left font-semibold">Email</th>
                            <th className="px-4 py-3 text-center font-semibold">Rôle</th>
                            <th className="px-4 py-3 text-center font-semibold">2FA</th>
                            <th className="px-4 py-3 text-center font-semibold">Statut</th>
                            <th className="px-4 py-3 text-center font-semibold">Inscrit le</th>
                            <th className="px-4 py-3 text-center font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {users.map((u, idx) => (
                            <tr
                              key={u.id}
                              className={`transition-colors hover:bg-muted/40 ${idx % 2 === 0 ? "bg-white" : "bg-muted/10"}`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#19542b] text-white text-sm font-bold shrink-0">
                                    {u.prenom?.charAt(0)}{u.nom?.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-medium">{u.full_name}</p>
                                    {u.id === user.id && (
                                      <span className="text-xs text-[#19542b] font-medium">(vous)</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                              <td className="px-4 py-3 text-center">
                                <RoleBadge role={u.role} />
                              </td>
                              <td className="px-4 py-3 text-center">
                                {u.mfa_enabled ? (
                                  <ShieldCheck className="h-5 w-5 text-[#19542b] mx-auto" />
                                ) : (
                                  <ShieldOff className="h-5 w-5 text-muted-foreground mx-auto" />
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {u.is_active ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-semibold" variant="outline">
                                    <Check className="h-3 w-3 mr-1" />Actif
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800 border-red-200 text-xs font-semibold" variant="outline">
                                    <X className="h-3 w-3 mr-1" />Suspendu
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                                {fmt(u.created_at)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {u.id !== user.id ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      id={`toggle-user-${u.id}`}
                                      size="sm"
                                      variant={u.is_active ? "outline" : "default"}
                                      className={
                                        u.is_active
                                          ? "border-red-200 text-red-600 hover:bg-red-50 text-xs h-8 px-2"
                                          : "bg-[#19542b] text-white hover:bg-[#093215] text-xs h-8 px-2"
                                      }
                                      onClick={() => handleToggleActive(u.id)}
                                      disabled={toggleLoading === u.id}
                                    >
                                      {toggleLoading === u.id ? (
                                        <Spinner className="h-3 w-3" />
                                      ) : u.is_active ? (
                                        "Suspendre"
                                      ) : (
                                        "Activer"
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      title="Forcer mot de passe"
                                      onClick={() => setResetModalUserId(u)}
                                    >
                                      <Lock className="h-3 w-3 text-[#19542b]" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0 border-red-200"
                                      title="Supprimer le compte"
                                      onClick={() => setDeleteModalUserId(u)}
                                    >
                                      <X className="h-3 w-3 text-red-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Modals Inlines pour Reset MDP et Supprimer */}
                    {resetModalUserId && (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-sm shadow-xl">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Forcer Mot de passe</CardTitle>
                            <CardDescription>Pour {resetModalUserId.full_name}</CardDescription>
                          </CardHeader>
                          <form onSubmit={handleAdminResetPassword}>
                            <CardContent className="space-y-3 pb-3">
                              {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}
                              {actionSuccess && <Alert className="bg-green-50 text-green-800"><AlertDescription>{actionSuccess}</AlertDescription></Alert>}
                              <div className="space-y-1">
                                <label className="text-sm font-medium">Nouveau mot de passe</label>
                                <Input type="password" value={adminNewPassword} onChange={(e) => setAdminNewPassword(e.target.value)} required minLength={8} />
                                <p className="text-xs text-muted-foreground mt-1">Le MFA de l'utilisateur sera désactivé.</p>
                              </div>
                            </CardContent>
                            <div className="flex gap-2 p-4 pt-0">
                              <Button type="button" variant="outline" className="flex-1" onClick={() => { setResetModalUserId(null); setActionError(""); setActionSuccess("")}}>Annuler</Button>
                              <Button type="submit" className="flex-1 bg-[#19542b] text-white" disabled={actionLoading}>{actionLoading ? <Spinner className="h-4 w-4" /> : "Valider"}</Button>
                            </div>
                          </form>
                        </Card>
                      </div>
                    )}

                    {deleteModalUserId && (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-sm shadow-xl border-red-200">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg text-red-600 flex items-center gap-2"><AlertCircle className="w-5 h-5"/> Supprimer le compte</CardTitle>
                            <CardDescription>Êtes-vous absolument sûr de vouloir supprimer définitivement <strong>{deleteModalUserId.full_name}</strong> ?</CardDescription>
                          </CardHeader>
                          <CardContent className="pb-3">
                             {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}
                          </CardContent>
                          <div className="flex gap-2 p-4 pt-0">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => { setDeleteModalUserId(null); setActionError("")}}>Annuler</Button>
                            <Button type="button" variant="destructive" className="flex-1" onClick={handleAdminDeleteUser} disabled={actionLoading}>{actionLoading ? <Spinner className="h-4 w-4" /> : "Supprimer"}</Button>
                          </div>
                        </Card>
                      </div>
                    )}

                    {users.length === 0 && (
                      <div className="py-16 text-center text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p>Aucun utilisateur trouvé</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════ Tab : CSV ════════════════════════════ */}
          <TabsContent value="csv">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Upload form */}
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="text-[#093215] flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Importer un fichier CSV
                  </CardTitle>
                  <CardDescription>
                    Formats acceptés : .csv — Taille max : 500 Mo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCsvUpload} className="space-y-4">
                    {csvError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{csvError}</AlertDescription>
                      </Alert>
                    )}
                    {csvSuccess && (
                      <Alert className="border-[#19542b] bg-[#19542b]/10">
                        <CheckCircle className="h-4 w-4 text-[#19542b]" />
                        <AlertDescription className="text-[#19542b]">{csvSuccess}</AlertDescription>
                      </Alert>
                    )}

                    <div
                      className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center hover:border-[#19542b]/50 transition-colors cursor-pointer"
                      onClick={() => document.getElementById("csv-file-input")?.click()}
                    >
                      <FileUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                      {csvFile ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-[#19542b]">{csvFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(csvFile.size / 1024 / 1024).toFixed(2)} Mo
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-medium text-muted-foreground">
                            Cliquez pour sélectionner un fichier
                          </p>
                          <p className="text-sm text-muted-foreground">ou glissez-déposez ici</p>
                        </div>
                      )}
                      <input
                        id="csv-file-input"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      />
                    </div>

                    <Button
                      id="csv-upload-submit"
                      type="submit"
                      className="w-full h-12 bg-[#19542b] hover:bg-[#093215] text-white font-semibold"
                      disabled={!csvFile || csvLoading}
                    >
                      {csvLoading ? (
                        <>
                          <Spinner className="h-5 w-5 mr-2" />
                          Traitement en cours...
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 mr-2" />
                          Importer le fichier
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Historique uploads */}
              <Card className="shadow-lg border-0">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div>
                    <CardTitle className="text-[#093215] flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5" />
                      Historique des imports
                    </CardTitle>
                  </div>
                  <Button
                    id="refresh-uploads-btn"
                    variant="outline"
                    size="sm"
                    onClick={fetchUploads}
                    disabled={uploadsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${uploadsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </CardHeader>
                <CardContent>
                  {uploadsLoading ? (
                    <div className="flex justify-center py-10">
                      <Spinner className="h-6 w-6 text-[#19542b]" />
                    </div>
                  ) : uploads.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Aucun import effectué</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {uploads.map((up) => (
                        <div
                          key={up.id}
                          className="flex items-start justify-between p-3 rounded-lg border bg-muted/30 gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{up.filename}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">{fmt(up.uploaded_at)}</span>
                              {up.nb_lignes !== null && (
                                <span className="text-xs text-muted-foreground">
                                  · {up.nb_lignes.toLocaleString("fr-FR")} lignes
                                </span>
                              )}
                            </div>
                            {up.error_msg && (
                              <p className="text-xs text-destructive mt-1 truncate">{up.error_msg}</p>
                            )}
                          </div>
                          <StatusBadge status={up.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════════════════ Tab : Invitations ════════════════════ */}
          <TabsContent value="invitations">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Send invitation form */}
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="text-[#093215] flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Envoyer une invitation admin
                  </CardTitle>
                  <CardDescription>
                    L&apos;utilisateur doit déjà avoir un compte. Le lien expire dans 48h.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSendInvitation} className="space-y-4">
                    {inviteError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{inviteError}</AlertDescription>
                      </Alert>
                    )}
                    {inviteSuccess && (
                      <Alert className="border-[#19542b] bg-[#19542b]/10">
                        <CheckCircle className="h-4 w-4 text-[#19542b]" />
                        <AlertDescription className="text-[#19542b]">{inviteSuccess}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <label htmlFor="invite-email" className="text-sm font-medium">
                        Adresse email de l&apos;utilisateur
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="invite-email"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="utilisateur@exemple.com"
                          className="pl-11 h-12"
                          required
                          disabled={inviteLoading}
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-[#acc936]/10 rounded-lg border border-[#acc936]/20">
                      <p className="text-xs text-[#093215] font-medium">
                        ℹ️ L&apos;utilisateur recevra un email avec un lien sécurisé pour accepter le rôle
                        d&apos;administrateur.
                      </p>
                    </div>

                    <Button
                      id="send-invite-submit"
                      type="submit"
                      className="w-full h-12 bg-[#19542b] hover:bg-[#093215] text-white font-semibold"
                      disabled={inviteLoading || !inviteEmail}
                    >
                      {inviteLoading ? (
                        <>
                          <Spinner className="h-5 w-5 mr-2" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-2" />
                          Envoyer l&apos;invitation
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Liste invitations */}
              <Card className="shadow-lg border-0">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-[#093215] flex items-center gap-2 text-base">
                    <Mail className="h-5 w-5" />
                    Invitations envoyées
                  </CardTitle>
                  <Button
                    id="refresh-invitations-btn"
                    variant="outline"
                    size="sm"
                    onClick={fetchInvitations}
                    disabled={invListLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${invListLoading ? "animate-spin" : ""}`} />
                  </Button>
                </CardHeader>
                <CardContent>
                  {invListLoading ? (
                    <div className="flex justify-center py-10">
                      <Spinner className="h-6 w-6 text-[#19542b]" />
                    </div>
                  ) : invitations.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Mail className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Aucune invitation envoyée</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {invitations.map((inv) => {
                        const expired  = new Date(inv.expires_at) < new Date()
                        const statusLabel = inv.used ? "Acceptée" : expired ? "Expirée" : "En attente"
                        const statusCls   = inv.used
                          ? "bg-green-100 text-green-800 border-green-200"
                          : expired
                          ? "bg-gray-100 text-gray-600 border-gray-200"
                          : "bg-yellow-100 text-yellow-800 border-yellow-200"

                        return (
                          <div
                            key={inv.id}
                            className="flex items-start justify-between p-3 rounded-lg border bg-muted/30 gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{inv.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-xs text-muted-foreground">{fmt(inv.created_at)}</span>
                                <span className="text-xs text-muted-foreground">
                                  · expire {fmt(inv.expires_at)}
                                </span>
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-xs font-semibold shrink-0 ${statusCls}`}>
                              {statusLabel}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 bg-[#093215] text-white py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-white/60">
            &copy; {new Date().getFullYear()} Assurances BIAT — Espace Administration
          </p>
        </div>
      </footer>
    </div>
  )
}
