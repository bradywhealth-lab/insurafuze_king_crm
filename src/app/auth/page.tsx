'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/auth', { credentials: 'include' })
        const data = await res.json()
        if (!cancelled && res.ok && data.authenticated) {
          router.replace(data.mustChangePassword ? '/auth/password' : '/')
          router.refresh()
        }
      } catch {
        // Stay on auth page when session lookup fails.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload =
        mode === 'login'
          ? { action: 'login', email: loginEmail, password: loginPassword }
          : {
              action: 'signup',
              name: signupName,
              email: signupEmail,
              password: signupPassword,
              organizationName,
            }

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Authentication failed')
      router.push(data.mustChangePassword ? '/auth/password' : '/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#EFF4FB] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-16">
        <Card className="w-full border-[#D7DFEA] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-black">Insurafuze CRM</CardTitle>
            <CardDescription>Sign in to your workspace or create a new organization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={mode} onValueChange={(value) => setMode(value as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2 bg-[#EEF2F7]">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Create Account</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="space-y-4 mt-4">
                <div>
                  <Label>Email</Label>
                  <Input className="mt-1" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input className="mt-1" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
              </TabsContent>
              <TabsContent value="signup" className="space-y-4 mt-4">
                <div>
                  <Label>Your name</Label>
                  <Input className="mt-1" value={signupName} onChange={(e) => setSignupName(e.target.value)} />
                </div>
                <div>
                  <Label>Organization name</Label>
                  <Input className="mt-1" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input className="mt-1" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input className="mt-1" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
                </div>
              </TabsContent>
            </Tabs>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="btn-gold w-full" onClick={() => void submit()} disabled={loading}>
              {loading ? 'Working...' : mode === 'login' ? 'Sign In' : 'Create Workspace'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
