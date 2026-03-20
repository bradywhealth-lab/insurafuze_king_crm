"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export type WorkspaceUser = {
  id: string
  email: string
  name: string | null
  role: string
  organizationId: string
  organization?: { id: string; name: string; slug: string; plan: string }
}

export function useWorkspaceSession() {
  const router = useRouter()
  const [authLoading, setAuthLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<WorkspaceUser | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const response = await fetch("/api/auth", { credentials: "include" })
        const payload = await response.json()
        if (cancelled) return

        if (!response.ok || !payload.authenticated) {
          router.replace("/auth")
          return
        }

        if (payload.mustChangePassword) {
          router.replace("/auth/password")
          return
        }

        setCurrentUser(payload.user)
      } catch {
        if (!cancelled) router.replace("/auth")
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" })
    } finally {
      router.replace("/auth")
      router.refresh()
    }
  }, [router])

  return { authLoading, currentUser, signOut }
}
