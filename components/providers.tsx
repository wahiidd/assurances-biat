"use client"

import { AuthProvider } from "@/lib/auth-context"
import { AutoLogout } from "@/components/auto-logout"
import type { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AutoLogout />
      {children}
    </AuthProvider>
  )
}
