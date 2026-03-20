import { NextRequest, NextResponse } from 'next/server'
import { applySecurityHeaders } from '@/lib/security'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('session-token')?.value?.trim()
  const isAuthenticated = Boolean(sessionToken)
  const isAuthRoute = pathname === '/auth' || pathname.startsWith('/auth/')
  const isApiRoute = pathname.startsWith('/api/')

  let response: NextResponse

  if (!isApiRoute && !isAuthRoute && !isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    response = NextResponse.redirect(url)
  } else if (isAuthRoute && pathname !== '/auth/password' && isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    response = NextResponse.redirect(url)
  } else if (pathname === '/auth/password' && !isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    response = NextResponse.redirect(url)
  } else {
    response = NextResponse.next()
  }

  return applySecurityHeaders(request, response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.svg).*)'],
}
