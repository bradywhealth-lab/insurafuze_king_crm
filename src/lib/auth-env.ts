export function getAuthBaseUrl(): string | null {
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim()
  if (!nextAuthUrl) return null

  try {
    return new URL(nextAuthUrl).origin
  } catch {
    return null
  }
}

export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret) throw new Error('Missing NEXTAUTH_SECRET')
  return secret
}
