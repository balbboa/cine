import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
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

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  const cookieStore = cookies()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    return NextResponse.redirect(`${requestUrl.origin}/login?error=configuration_error`)
  }

  // Initialize response - not storing in variable since we're not using it
  NextResponse.next({
    request,
  })

  if (code) {
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          // @ts-expect-error - Supabase expects this pattern but TS doesn't recognize it
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: CookieOption[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )
    
    try {
      await supabase.auth.exchangeCodeForSession(code)
    } catch (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_error`)
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(requestUrl.origin)
} 