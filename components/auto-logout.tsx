"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const INACTIVITY_LIMIT = 25 * 60 * 1000 // 25 min (en millisecondes)
const WARNING_LIMIT = 5 * 60 * 1000 // 5 min (en millisecondes)

export function AutoLogout() {
  const router = useRouter()
  const { isAuthenticated, logout } = useAuth()

  const [lastActivity, setLastActivity] = useState<number>(Date.now())
  const [showWarning, setShowWarning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(WARNING_LIMIT / 1000)

  // Suivi de l'activité via événements natifs
  const updateActivity = useCallback(() => {
    // On ne met à jour l'activité que si l'utilisateur n'est pas déjà dans la phase d'avertissement
    // S'il est sous avertissement, il DOIT cliquer sur le bouton pour confirmer sa présence.
    if (!showWarning) {
      setLastActivity(Date.now())
    }
  }, [showWarning])

  useEffect(() => {
    if (!isAuthenticated) return

    setLastActivity(Date.now())

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"]
    events.forEach(e => document.addEventListener(e, updateActivity, { passive: true }))

    return () => {
      events.forEach(e => document.removeEventListener(e, updateActivity))
    }
  }, [isAuthenticated, updateActivity])

  // Boucle de vérification du temps
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      const now = Date.now()
      const timeInactive = now - lastActivity

      // Phase 1 : Limite des 25min dépassée, affichage du popup
      if (!showWarning && timeInactive >= INACTIVITY_LIMIT) {
        setShowWarning(true)
      }
      // Phase 2 : Le popup est affiché, compte à rebours de 5min
      else if (showWarning) {
        const remaining = INACTIVITY_LIMIT + WARNING_LIMIT - timeInactive
        if (remaining <= 0) {
          clearInterval(interval)
          setShowWarning(false)
          logout()
          router.push("/login")
        } else {
          setTimeLeft(Math.ceil(remaining / 1000))
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated, lastActivity, showWarning, logout, router])

  const handleConfirmPresence = () => {
    setLastActivity(Date.now())
    setShowWarning(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isAuthenticated) return null

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent className="border-[#19542b]/20">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#093215]">Êtes-vous toujours là ?</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-muted-foreground mt-2">
            Suite à une inactivité prolongée, et pour des raisons de sécurité, vous serez déconnecté automatiquement dans{" "}
            <span className="font-bold text-[#19542b]">{formatTime(timeLeft)}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={handleConfirmPresence}
            className="w-full bg-[#19542b] hover:bg-[#093215] text-white"
          >
            Je suis là
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
