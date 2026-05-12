"use client"

export const dynamic = "force-dynamic"


import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useAuth, authFetch, API_BASE_URL } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { ShieldCheck, CheckCircle, AlertCircle, LogIn } from "lucide-react"

type PageState = "loading" | "valid" | "invalid" | "not_logged_in" | "accepting" | "success" | "error"

function InviteContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()

  const token = searchParams.get("token") || ""

  const [pageState, setPageState]   = useState<PageState>("loading")
  const [inviteEmail, setInviteEmail] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  // Étape 1 : valider le token (call public)
  useEffect(() => {
    if (!token) {
      setPageState("invalid")
      setErrorMessage("Aucun token d'invitation fourni.")
      return
    }
    if (authLoading) return  // attendre que l'auth soit chargée

    const validateToken = async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/auth/invite/validate?token=${encodeURIComponent(token)}`)
        const data = await res.json()

        if (!res.ok || !data.valid) {
          setPageState("invalid")
          setErrorMessage(data.error || "Invitation invalide ou expirée.")
          return
        }

        setInviteEmail(data.email)

        if (!isAuthenticated) {
          setPageState("not_logged_in")
        } else {
          setPageState("valid")
        }
      } catch {
        setPageState("invalid")
        setErrorMessage("Impossible de vérifier l'invitation. Réessayez.")
      }
    }

    validateToken()
  }, [token, authLoading, isAuthenticated])

  // Étape 2 : accepter l'invitation
  const handleAccept = async () => {
    setPageState("accepting")

    try {
      const res  = await authFetch("/auth/invite/accept", {
        method: "POST",
        body:   JSON.stringify({ token }),
      })
      const data = await res.json()

      if (!res.ok) {
        setPageState("error")
        setErrorMessage(data.error || "Erreur lors de l'acceptation.")
        return
      }

      // Mettre à jour les tokens dans localStorage si de nouveaux tokens sont fournis
      if (data.access_token) {
        localStorage.setItem("pfe_access_token",  data.access_token)
        localStorage.setItem("pfe_refresh_token", data.refresh_token)
      }

      setPageState("success")
      setTimeout(() => router.push("/admin"), 2500)
    } catch {
      setPageState("error")
      setErrorMessage("Erreur de connexion au serveur.")
    }
  }

  // Rediriger vers login avec return URL
  const loginUrl = `/login?redirect=${encodeURIComponent(`/invite?token=${token}`)}`

  return (
    <div className="min-h-screen bg-[#e0e1e1] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-[#093215] via-[#19542b] to-[#093215] opacity-10" />

      <div className="relative w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-2xl p-4 shadow-xl">
            <Image
              src="/images/logo-assurances-biat.jpg"
              alt="Assurances BIAT"
              width={200}
              height={70}
              className="object-contain"
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </div>
        </div>

        <Card className="shadow-2xl border-0 overflow-hidden">
          <CardHeader className="bg-[#093215] text-white text-center p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
              <ShieldCheck className="h-8 w-8 text-[#acc936]" />
            </div>
            <h1 className="text-2xl font-bold">Invitation Administrateur</h1>
            <p className="text-white/70 text-sm mt-2">Assurances BIAT — Plateforme sécurisée</p>
          </CardHeader>

          <CardContent className="p-8">
            {(pageState === "loading" || pageState === "accepting") && (
              <div className="text-center py-8">
                <Spinner className="h-10 w-10 mx-auto mb-4 text-[#19542b]" />
                <p className="text-muted-foreground">
                  {pageState === "accepting" ? "Activation de votre rôle en cours..." : "Vérification de l'invitation..."}
                </p>
              </div>
            )}

            {(pageState === "invalid" || pageState === "error") && (
              <div className="text-center py-6 space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Invitation invalide</h2>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground">
                  Ce lien est peut-être expiré ou déjà utilisé. Contactez un administrateur.
                </p>
                <Button asChild className="bg-[#19542b] hover:bg-[#093215] text-white">
                  <Link href="/profil">Retour à mon espace</Link>
                </Button>
              </div>
            )}

            {pageState === "not_logged_in" && (
              <div className="text-center py-6 space-y-5">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#acc936]/20">
                  <LogIn className="h-8 w-8 text-[#19542b]" />
                </div>
                <h2 className="text-xl font-semibold">Connexion requise</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Cette invitation est destinée à{" "}
                  <strong className="text-foreground">{inviteEmail}</strong>.
                  <br />
                  Vous devez être connecté(e) avec ce compte pour l&apos;accepter.
                </p>
                <Button
                  id="invite-login-btn"
                  asChild
                  className="w-full h-12 bg-[#19542b] hover:bg-[#093215] text-white font-semibold"
                >
                  <Link href={loginUrl}>
                    <LogIn className="h-5 w-5 mr-2" />
                    Se connecter pour accepter
                  </Link>
                </Button>
              </div>
            )}

            {pageState === "valid" && (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Bonjour <strong className="text-foreground">{user?.full_name}</strong>,
                    <br />
                    vous avez été invité(e) à devenir <strong className="text-[#19542b]">Administrateur</strong> de la plateforme.
                  </p>
                </div>

                <div className="bg-[#19542b]/5 border border-[#19542b]/20 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium text-[#19542b]">En acceptant, vous aurez accès à :</p>
                  {[
                    "Gestion des comptes utilisateurs",
                    "Upload et traitement de fichiers CSV",
                    "Envoi d'invitations administrateur",
                    "Journal d'audit complet",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-[#19542b] shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>

                <Button
                  id="invite-accept-btn"
                  onClick={handleAccept}
                  className="w-full h-12 bg-[#19542b] hover:bg-[#093215] text-white font-semibold text-base"
                >
                  <ShieldCheck className="h-5 w-5 mr-2" />
                  Accepter et devenir Administrateur
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  En acceptant, vous confirmez avoir pris connaissance de vos responsabilités.
                </p>
              </div>
            )}

            {pageState === "success" && (
              <div className="text-center py-6 space-y-4">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#acc936]/20">
                  <CheckCircle className="h-10 w-10 text-[#19542b]" />
                </div>
                <h2 className="text-2xl font-bold text-[#19542b]">Félicitations !</h2>
                <p className="text-muted-foreground">
                  Vous êtes maintenant <strong className="text-[#19542b]">Administrateur</strong>.
                  <br />
                  Redirection vers le tableau de bord...
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-[#19542b]">
                  <Spinner className="h-4 w-4" />
                  <span>Chargement du dashboard admin...</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-[#093215]/50 mt-6">
          © {new Date().getFullYear()} Assurances BIAT. Tous droits réservés.
        </p>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#e0e1e1] flex items-center justify-center p-6 text-center">
        <Spinner className="h-10 w-10 mx-auto text-[#19542b]" />
      </div>
    }>
      <InviteContent />
    </Suspense>
  )
}
