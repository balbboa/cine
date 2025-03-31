import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database.types'

// Define the cookie interface to match what Supabase expects
interface CookieOption {
  name: string;
  value: string;
  options?: {
    path?: string;
    maxAge?: number;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  };
}

export async function middleware(request: NextRequest) {
  // For debugging
  console.log('Middleware running on:', request.nextUrl.pathname)
  
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // @ts-expect-error - Supabase expects this pattern
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieOption[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). This can make it hard to debug
  // issues with users being randomly logged out.
  
  const {
    data: { user },
  } = await supabase.auth.getUser()
  
  // Log authentication state
  console.log('Auth state:', user ? 'Authenticated' : 'Not authenticated', 'on path:', request.nextUrl.pathname)

  // List of paths that require authentication
  const protectedRoutes = ['/game-hub', '/game/', '/profile', '/social']
  const isProtectedRoute = protectedRoutes.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  // Redirect to login if user is not authenticated and trying to access a protected route
  if (
    !user &&
    isProtectedRoute &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/register') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/reset-password')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('callbackUrl', request.nextUrl.pathname)
    console.log('Redirecting unauthenticated user to login from restricted path')
    return NextResponse.redirect(url)
  }

  // If user is on login page but already authenticated, redirect to game-hub
  if (
    user && 
    (request.nextUrl.pathname === '/login' ||
     request.nextUrl.pathname === '/register')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/game-hub'
    url.search = ''
    console.log('Redirecting authenticated user to game-hub')
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You must return the supabaseResponse object as is
  console.log('Middleware completed for:', request.nextUrl.pathname)
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth (Supabase auth routes)
     * - Files with extensions (e.g. .png, .jpg)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
} 