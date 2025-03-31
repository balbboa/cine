// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';

// Cookie option interface
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

// Server-side client for use in Server Components, Route Handlers, Server Actions
export async function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // @ts-expect-error - Supabase expects this pattern but TS doesn't recognize it
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieOption[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Server-side client with service role (USE WITH CAUTION)
// Primarily for admin tasks or operations requiring elevated privileges
export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      cookies: {},
    }
  );
} 