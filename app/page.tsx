"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Spinner } from "@/components/ui/spinner"
import Image from "next/image"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/analyses")
      } else {
        router.push("/login")
      }
    }
  }, [isAuthenticated, isLoading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#093215]">
      <div className="text-center">
        <div className="bg-white rounded-2xl p-6 mb-6 inline-block">
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
        <div className="flex items-center justify-center gap-3">
          <Spinner className="h-6 w-6 text-[#acc936]" />
          <p className="text-white/80">Chargement...</p>
        </div>
      </div>
    </div>
  )
}
