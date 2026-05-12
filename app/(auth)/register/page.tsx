"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { User, Mail, Lock, AlertCircle, CheckCircle, Eye, EyeOff, Check, X } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const { register, login } = useAuth()

  const [nom, setNom]                       = useState("")
  const [prenom, setPrenom]                 = useState("")
  const [email, setEmail]                   = useState("")
  const [password, setPassword]             = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword]     = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError]                   = useState("")
  const [success, setSuccess]               = useState(false)
  const [isLoading, setIsLoading]           = useState(false)

  // Critères de validation du mot de passe
  const passwordChecks = {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /\d/.test(password),
  }
  const isPasswordValid = Object.values(passwordChecks).every(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    if (nom.trim().length < 2 || prenom.trim().length < 2) {
      setError("Nom et prénom doivent contenir au moins 2 caractères")
      return
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      return
    }

    if (!isPasswordValid) {
      setError("Le mot de passe ne respecte pas les critères de sécurité")
      return
    }

    setIsLoading(true)

    try {
      await register(nom, prenom, email, password)
      // Auto-login après inscription
      await login(email, password)
      setSuccess(true)
      setTimeout(() => router.push("/profil"), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription")
    } finally {
      setIsLoading(false)
    }
  }

  const PasswordCheck = ({ valid, text }: { valid: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-sm ${valid ? "text-[#19542b]" : "text-muted-foreground"}`}>
      {valid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      {text}
    </div>
  )

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#093215] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#19542b] to-[#093215]" />
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="bg-white rounded-2xl p-6 mb-8 shadow-2xl">
            <Image
              src="/images/logo-assurances-biat.jpg"
              alt="Assurances BIAT"
              width={280}
              height={100}
              className="object-contain"
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-center mb-4">Rejoignez notre plateforme</h1>
          <p className="text-lg text-center text-white/80 max-w-md">
            Créez votre compte pour accéder à tous nos services de gestion d&apos;assurances.
          </p>
          <div className="mt-12 space-y-4 text-left max-w-sm">
            {[
              "Compte sécurisé avec 2FA obligatoire",
              "Accès à tous vos contrats d'épargne",
              "Suivi en temps réel",
            ].map((item) => (
              <div key={item} className="flex items-center gap-4 bg-white/10 rounded-lg p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#acc936] shrink-0">
                  <Check className="h-5 w-5 text-[#093215]" />
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md shadow-xl border-0 bg-card">
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden flex justify-center mb-6">
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
            <h2 className="text-2xl font-bold text-foreground">Créer un compte</h2>
            <p className="text-muted-foreground mt-1">Remplissez le formulaire ci-dessous</p>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="pt-4">
              <FieldGroup>
                {error && (
                  <Alert variant="destructive" className="mb-4" id="register-error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="mb-4 border-[#19542b] bg-[#19542b]/10" id="register-success">
                    <CheckCircle className="h-4 w-4 text-[#19542b]" />
                    <AlertDescription className="text-[#19542b]">
                      Compte créé avec succès ! Redirection en cours...
                    </AlertDescription>
                  </Alert>
                )}

                {/* Nom + Prénom sur 2 colonnes */}
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="prenom">Prénom</FieldLabel>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="prenom"
                        type="text"
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        placeholder="Prénom"
                        className="pl-9 h-11"
                        required
                        disabled={isLoading || success}
                        autoComplete="given-name"
                      />
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="nom">Nom</FieldLabel>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="nom"
                        type="text"
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Nom"
                        className="pl-9 h-11"
                        required
                        disabled={isLoading || success}
                        autoComplete="family-name"
                      />
                    </div>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="email">Adresse email</FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="pl-11 h-12"
                      required
                      disabled={isLoading || success}
                      autoComplete="email"
                    />
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Créez un mot de passe"
                      className="pl-11 pr-11 h-12"
                      required
                      disabled={isLoading || success}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      id="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2 p-3 bg-muted rounded-lg space-y-1">
                      <PasswordCheck valid={passwordChecks.length}    text="Au moins 8 caractères" />
                      <PasswordCheck valid={passwordChecks.uppercase}  text="Une majuscule" />
                      <PasswordCheck valid={passwordChecks.lowercase}  text="Une minuscule" />
                      <PasswordCheck valid={passwordChecks.number}     text="Un chiffre" />
                    </div>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="confirmPassword">Confirmer le mot de passe</FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirmez votre mot de passe"
                      className="pl-11 pr-11 h-12"
                      required
                      disabled={isLoading || success}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      id="toggle-confirm-password"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-sm text-destructive mt-1">
                      Les mots de passe ne correspondent pas
                    </p>
                  )}
                </Field>
              </FieldGroup>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button
                id="register-submit"
                type="submit"
                className="w-full h-12 text-base font-semibold bg-[#19542b] hover:bg-[#093215] text-white"
                disabled={isLoading || success || !isPasswordValid}
              >
                {isLoading ? (
                  <>
                    <Spinner className="mr-2 h-5 w-5" />
                    Inscription en cours...
                  </>
                ) : (
                  "Créer mon compte"
                )}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Déjà inscrit ?{" "}
                <Link href="/login" className="text-[#19542b] font-semibold hover:underline">
                  Se connecter
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
