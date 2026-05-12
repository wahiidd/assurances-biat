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
import { Mail, Lock, AlertCircle, ShieldCheck, CheckCircle } from "lucide-react"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { initPasswordReset, verifyPasswordReset2FA, resetPassword } = useAuth()

  const [step, setStep] = useState(1) // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  
  const [resetToken, setResetToken] = useState("")
  const [resetPwToken, setResetPwToken] = useState("")
  
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleInit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const res = await initPasswordReset(email)
      setResetToken(res.reset_token)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const res = await verifyPasswordReset2FA(code, resetToken)
      setResetPwToken(res.reset_pw_token)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code invalide")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }
    
    setIsLoading(true)
    try {
      await resetPassword(newPassword, resetPwToken)
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1/3 bg-[#093215] md:w-1/3 md:h-full z-0 pointer-events-none" />
      
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card z-10 relative">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-6">
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
          <h2 className="text-2xl font-bold text-foreground">Mot de passe oublié</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {step === 1 && "Entrez votre email pour réinitialiser votre mot de passe."}
            {step === 2 && "Vérification de sécurité via Authenticator."}
            {step === 3 && "Créez votre nouveau mot de passe."}
            {step === 4 && "Opération réussie !"}
          </p>
        </CardHeader>

        <CardContent className="pt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* STEP 1: Email */}
          {step === 1 && (
            <form onSubmit={handleInit}>
              <FieldGroup>
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
                    />
                  </div>
                </Field>
              </FieldGroup>
              <Button type="submit" className="w-full h-12 mt-6 bg-[#19542b] hover:bg-[#093215] text-white" disabled={isLoading}>
                {isLoading ? <Spinner className="h-5 w-5 mr-2" /> : null} Continuer
              </Button>
            </form>
          )}

          {/* STEP 2: 2FA TOTP */}
          {step === 2 && (
            <form onSubmit={handleVerify2FA}>
              <div className="text-center mb-4">
                <ShieldCheck className="h-12 w-12 text-[#19542b] mx-auto mb-2 opacity-80" />
                <p className="text-sm font-medium text-[#093215]">
                  Ouvrez Microsoft/Google Authenticator et entrez le code à 6 chiffres.
                </p>
              </div>
              <FieldGroup>
                <Field>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="text-center text-3xl tracking-[0.5em] font-mono h-16 border-2 focus:border-[#19542b]"
                    required
                    disabled={isLoading}
                  />
                </Field>
              </FieldGroup>
              <Button type="submit" className="w-full h-12 mt-6 bg-[#19542b] hover:bg-[#093215] text-white" disabled={isLoading || code.length !== 6}>
                {isLoading ? <Spinner className="h-5 w-5 mr-2" /> : null} Vérifier
              </Button>
            </form>
          )}

          {/* STEP 3: New Password */}
          {step === 3 && (
            <form onSubmit={handleReset}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="newPassword">Nouveau mot de passe</FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      className="pl-11 h-12 text-base"
                      required
                      minLength={8}
                      disabled={isLoading}
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirmPassword">Confirmer le mot de passe</FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Identique au précédent"
                      className="pl-11 h-12 text-base"
                      required
                      minLength={8}
                      disabled={isLoading}
                    />
                  </div>
                </Field>
              </FieldGroup>
              <Button type="submit" className="w-full h-12 mt-6 bg-[#19542b] hover:bg-[#093215] text-white" disabled={isLoading}>
                {isLoading ? <Spinner className="h-5 w-5 mr-2" /> : null} Réinitialiser le mot de passe
              </Button>
            </form>
          )}

          {/* STEP 4: Success */}
          {step === 4 && (
            <div className="text-center py-6">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Félicitations !</h3>
              <p className="text-muted-foreground mb-6">Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter.</p>
              <Button asChild className="w-full h-12 bg-[#19542b] hover:bg-[#093215] text-white">
                <Link href="/login">Retour à la connexion</Link>
              </Button>
            </div>
          )}
        </CardContent>

        {step < 4 && (
          <CardFooter className="justify-center border-t p-4 pb-6 bg-muted/20">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              ← Retour à la connexion
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
