"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { ShieldCheck, AlertCircle, ArrowLeft, Smartphone } from "lucide-react"

export default function Verify2FAPage() {
  const router = useRouter()
  const { verify2FA } = useAuth()
  
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(30)
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const token = sessionStorage.getItem("pfe_temp_token")
    if (!token) {
      router.push("/login")
      return
    }
    setTempToken(token)
    inputRefs.current[0]?.focus()
  }, [router])

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 30 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (value && index === 5) {
      const fullCode = newCode.join("")
      if (fullCode.length === 6) {
        handleVerify(fullCode)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    
    if (pastedData.length > 0) {
      const newCode = [...code]
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newCode[i] = pastedData[i]
      }
      setCode(newCode)
      
      if (pastedData.length === 6) {
        handleVerify(pastedData)
      } else {
        inputRefs.current[pastedData.length]?.focus()
      }
    }
  }

  const handleVerify = async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join("")
    
    if (codeToVerify.length !== 6 || !tempToken) {
      setError("Veuillez entrer un code a 6 chiffres")
      return
    }

    setError("")
    setIsLoading(true)

    try {
      await verify2FA(codeToVerify, tempToken)
      sessionStorage.removeItem("pfe_temp_token")
      router.push("/profil")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code de verification invalide")
      setCode(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleVerify()
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
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
              style={{ width: 'auto', height: 'auto' }}
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-center mb-4">
            Verification en deux etapes
          </h1>
          <p className="text-lg text-center text-white/80 max-w-md">
            La double authentification protege votre compte contre les acces non autorises.
          </p>
          <div className="mt-12 flex items-center gap-6 bg-white/10 rounded-xl p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#acc936]">
              <Smartphone className="h-8 w-8 text-[#093215]" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-lg">Google Authenticator</p>
              <p className="text-white/70 text-sm">
                Ouvrez l&apos;application et entrez le code affiche
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - 2FA Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md shadow-xl border-0 bg-card">
          <CardHeader className="text-center pb-2">
            {/* Mobile Logo */}
            <div className="lg:hidden flex justify-center mb-6">
              <Image
                src="/images/logo-assurances-biat.jpg"
                alt="Assurances BIAT"
                width={200}
                height={70}
                className="object-contain"
                style={{ width: 'auto', height: 'auto' }}
                priority
              />
            </div>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#acc936]">
              <ShieldCheck className="h-8 w-8 text-[#093215]" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Verification 2FA
            </h2>
            <p className="text-muted-foreground mt-1">
              Entrez le code a 6 chiffres de Google Authenticator
            </p>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="pt-6">
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 focus:border-[#19542b] focus:ring-[#acc936]"
                    disabled={isLoading}
                  />
                ))}
              </div>
              
              {/* Countdown timer */}
              <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-full border-2 border-[#acc936] flex items-center justify-center font-mono font-bold text-[#19542b]">
                  {countdown}
                </div>
                <span>secondes restantes</span>
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-[#19542b] hover:bg-[#093215] text-white"
                disabled={isLoading || code.join("").length !== 6}
              >
                {isLoading ? (
                  <>
                    <Spinner className="mr-2 h-5 w-5" />
                    Verification en cours...
                  </>
                ) : (
                  "Verifier le code"
                )}
              </Button>
              
              <Link 
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour a la connexion
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
