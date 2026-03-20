'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function PasswordSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/auth', { credentials: 'include' })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok || !data.authenticated) {
          router.replace('/auth')
          return
        }
        if (!data.mustChangePassword) {
          router.replace('/')
          return
        }
      } catch {
        if (!cancelled) router.replace('/auth')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-password',
          currentPassword,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to update password')
      router.replace('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#EFF4FB] flex items-center justify-center text-gray-500">
        Loading password setup…
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#EFF4FB] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-16">
        <Card className="w-full border-[#D7DFEA] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-black">Set Your Password</CardTitle>
            <CardDescription>Finish account setup by replacing the temporary password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Current temporary password</Label>
              <Input className="mt-1" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <Label>New password</Label>
              <Input className="mt-1" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="btn-gold w-full" onClick={() => void submit()} disabled={saving}>
              {saving ? 'Updating...' : 'Update password'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
