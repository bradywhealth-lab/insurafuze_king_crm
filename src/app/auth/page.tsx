'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSession, signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Signup
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetTokenDisplay, setResetTokenDisplay] = useState<string | null>(null)

  // Reset password
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const session = await getSession()
        if (!cancelled && session?.user) {
          router.replace(session.user.mustChangePassword ? '/auth/password' : '/')
          router.refresh()
        }
      } catch {
        // Stay on auth page
      }
    })()
    return () => { cancelled = true }
  }, [router])

  const switchMode = (next: Mode) => {
    setError(null)
    setSuccess(null)
    setResetTokenDisplay(null)
    setMode(next)
  }

  const handleLoginSignup = async () => {
    setLoading(true)
    setError(null)
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: signupName, email: signupEmail, password: signupPassword, organizationName }),
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Signup failed')
      }

      const email = mode === 'login' ? loginEmail : signupEmail
      const password = mode === 'login' ? loginPassword : signupPassword
      const result = await signIn('credentials', { redirect: false, email, password, callbackUrl: '/' })

      if (!result || result.error) {
        throw new Error(mode === 'login' ? 'Invalid email or password.' : 'Authentication failed')
      }

      const session = await getSession()
      router.push(session?.user?.mustChangePassword ? '/auth/password' : '/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setLoading(true)
    setError(null)
    setResetTokenDisplay(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Request failed')
      if (data.token) {
        setResetTokenDisplay(data.token)
      } else {
        setSuccess('If that email exists, a reset token has been generated. Contact your admin.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setLoading(true)
    setError(null)
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Reset failed')
      setSuccess('Password reset successfully. You can now sign in.')
      switchMode('login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
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
            <CardDescription>
              {mode === 'forgot' && 'Enter your email to get a password reset token.'}
              {mode === 'reset' && 'Enter your reset token and choose a new password.'}
              {(mode === 'login' || mode === 'signup') && 'Sign in to your workspace or create a new organization.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* LOGIN / SIGNUP */}
            {(mode === 'login' || mode === 'signup') && (
              <>
                <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
                  <TabsList className="grid w-full grid-cols-2 bg-[#EEF2F7]">
                    <TabsTrigger value="login">Sign In</TabsTrigger>
                    <TabsTrigger value="signup">Create Account</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login" className="space-y-4 mt-4">
                    <div>
                      <Label>Email</Label>
                      <Input className="mt-1" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleLoginSignup()} />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input className="mt-1" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleLoginSignup()} />
                    </div>
                    <button
                      type="button"
                      className="text-sm text-[#2563EB] hover:underline"
                      onClick={() => switchMode('forgot')}
                    >
                      Forgot password?
                    </button>
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
                      <Input className="mt-1" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input className="mt-1" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
                    </div>
                  </TabsContent>
                </Tabs>
                {success && <p className="text-sm text-emerald-600">{success}</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button className="btn-gold w-full" onClick={() => void handleLoginSignup()} disabled={loading}>
                  {loading ? 'Working...' : mode === 'login' ? 'Sign In' : 'Create Workspace'}
                </Button>
                <p className="text-center text-sm text-gray-500">
                  Have a reset token?{' '}
                  <button type="button" className="text-[#2563EB] hover:underline" onClick={() => switchMode('reset')}>
                    Reset password
                  </button>
                </p>
              </>
            )}

            {/* FORGOT PASSWORD */}
            {mode === 'forgot' && (
              <>
                <div>
                  <Label>Email address</Label>
                  <Input className="mt-1" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleForgotPassword()} />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {success && <p className="text-sm text-emerald-600">{success}</p>}
                {resetTokenDisplay && (
                  <div className="rounded-lg border border-[#2563EB]/30 bg-[#2563EB]/5 p-4 space-y-2">
                    <p className="text-sm font-medium text-black">Your reset token (expires in 1 hour):</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all rounded bg-[#EEF2F7] px-3 py-2 text-xs font-mono text-black">
                        {resetTokenDisplay}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-[#D7DFEA]"
                        onClick={() => void navigator.clipboard.writeText(resetTokenDisplay)}
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Copy this token, then use it below to set a new password.</p>
                    <Button className="btn-gold w-full mt-2" onClick={() => { setResetToken(resetTokenDisplay); switchMode('reset') }}>
                      Use this token →
                    </Button>
                  </div>
                )}
                {!resetTokenDisplay && (
                  <Button className="btn-gold w-full" onClick={() => void handleForgotPassword()} disabled={loading}>
                    {loading ? 'Working...' : 'Get Reset Token'}
                  </Button>
                )}
                <button type="button" className="w-full text-center text-sm text-[#2563EB] hover:underline" onClick={() => switchMode('login')}>
                  ← Back to sign in
                </button>
              </>
            )}

            {/* RESET PASSWORD */}
            {mode === 'reset' && (
              <>
                <div>
                  <Label>Reset token</Label>
                  <Input className="mt-1 font-mono text-sm" value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="Paste your reset token" />
                </div>
                <div>
                  <Label>New password</Label>
                  <Input className="mt-1" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div>
                  <Label>Confirm new password</Label>
                  <Input className="mt-1" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleResetPassword()} />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {success && <p className="text-sm text-emerald-600">{success}</p>}
                <Button className="btn-gold w-full" onClick={() => void handleResetPassword()} disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
                <button type="button" className="w-full text-center text-sm text-[#2563EB] hover:underline" onClick={() => switchMode('forgot')}>
                  ← Get a new token
                </button>
              </>
            )}

          </CardContent>
        </Card>
      </div>
    </main>
  )
}
