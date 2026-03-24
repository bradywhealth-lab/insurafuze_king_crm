"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSession, signOut as nextAuthSignOut } from "next-auth/react"

export type WorkspaceUser = {
  id: string
  email: string
  name: string | null
  role: string
  organizationId: string
  organization?: { id: string; name: string; slug: string; plan: string }
  mustChangePassword?: boolean
}

export function useWorkspaceSession() {
  const router = useRouter()
  const [authLoading, setAuthLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<WorkspaceUser | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const session = await getSession()
        if (cancelled) return

        if (!session?.user) {
          router.replace("/auth")
          return
        }

        if (session.user.mustChangePassword) {
          router.replace("/auth/password")
          return
        }

        setCurrentUser(session.user as WorkspaceUser)
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
      await nextAuthSignOut({ redirect: false })
    } finally {
      router.replace("/auth")
      router.refresh()
    }
  }, [router])

  return { authLoading, currentUser, signOut }
}
