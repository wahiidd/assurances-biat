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
import { Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail]               = useState("")
  const [password, setPassword]         = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState("")
  const [isLoading, setIsLoading]       = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await login(email, password)

      if (result.requires_2fa && result.temp_token) {
        sessionStorage.setItem("pfe_temp_token", result.temp_token)
        router.push("/verify-2fa")
      } else {
        router.push("/profil")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion")
    } finally {
      setIsLoading(false)
    }
  }

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
          <h1 className="text-3xl font-bold text-center mb-4">
            Bienvenue sur notre plateforme
          </h1>
          <p className="text-lg text-center text-white/80 max-w-md">
            Gérez vos opérations en toute sécurité avec notre système
            d&apos;authentification à double facteur.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-[#acc936]">100%</div>
              <div className="text-sm text-white/70 mt-1">Sécurisé</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#acc936]">2FA</div>
              <div className="text-sm text-white/70 mt-1">Protection</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#acc936]">24/7</div>
              <div className="text-sm text-white/70 mt-1">Disponible</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md shadow-xl border-0 bg-card">
          <CardHeader className="text-center pb-2">
            {/* Mobile logo */}
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
            <h2 className="text-2xl font-bold text-foreground">Connexion</h2>
            <p className="text-muted-foreground mt-1">
              Entrez votre email et mot de passe pour accéder à votre espace
            </p>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="pt-6">
              <FieldGroup>
                {error && (
                  <Alert variant="destructive" className="mb-4" id="login-error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

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
                      className="pl-11 h-12 text-base"
                      required
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                </Field>

                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                    <Link href="/forgot-password" className="text-sm font-semibold text-[#19542b] hover:underline">
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Votre mot de passe"
                      className="pl-11 pr-11 h-12 text-base"
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      id="toggle-password-visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </Field>
              </FieldGroup>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button
                id="login-submit"
                type="submit"
                className="w-full h-12 text-base font-semibold bg-[#19542b] hover:bg-[#093215] text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Spinner className="mr-2 h-5 w-5" />
                    Connexion en cours...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Pas encore de compte ?{" "}
                <Link href="/register" className="text-[#19542b] font-semibold hover:underline">
                  Créer un compte
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
