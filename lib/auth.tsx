'use client'

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Session } from '@supabase/supabase-js'
import { User } from './db'
import { 
  createGuestUser as dbCreateGuestUser, 
  getGuestUser as dbGetGuestUser, 
  clearGuestUser as dbClearGuestUser,
} from './guest-user'
import { createClient } from './supabase/client'

// Define a more flexible User type for the context
// Merges required fields and optional fields from DB User and LocalStorage Guest
export interface ContextUser extends Partial<User> { // Add export keyword
  id: string;       // Always required
  username: string; // Always required
  isGuest?: boolean; // Explicitly define isGuest as optional boolean
  // Add optional guest-specific fields if not covered by Partial<User>
  xp?: number;      // Ensure XP is available (default 0)
  wins?: number;    // Ensure wins is available (default 0)
  losses?: number;  // Ensure losses is available (default 0)
  // email is inherited from Partial<User> as string | undefined
}

// Create auth context
interface AuthContextType {
  user: ContextUser | null
  session: Session | null
  isLoading: boolean
  isGuest: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, username: string) => Promise<void>
  signOut: () => Promise<void>
  autoCreateGuestUser: () => ContextUser | null
  playLocal: () => void
  upgradeGuest: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: unknown }>
  clearGuestSession: () => void
}

// Export the context directly to make sure it's accessible
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Auth Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ContextUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const router = useRouter()
  
  // Get the Supabase client instance
  const supabase = createClient(); 
  
  // Renamed internal functions to avoid conflict
  const createGuestUser = dbCreateGuestUser;
  const getGuestUser = dbGetGuestUser;
  const clearLocalStorageGuestUser = dbClearGuestUser;

  // Helper function to set user data (defined before useEffect)
  const setUserData = React.useCallback(async (session: Session) => {
    console.log('[setUserData] Starting for user:', session.user.id); // Log start
    try {
      setSession(session)
      
      // Restore DB fetch
      console.log('[setUserData] Fetching user data from DB...'); // Log before DB call
      const { data: userData, error } = await supabase
        .from('users')
        .select<string, User>('*') // Selects the full User profile
        .eq('id', session.user.id)
        .single()
      console.log('[setUserData] DB fetch complete. Error:', error, 'Data:', userData); // Log after DB call

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('[setUserData] Error fetching user data:', error) // Log actual error
        setUser(null);
        console.log('[setUserData] Set user to null due to error.');
        return; // Exit on error
      }
      
      if (userData) { 
        console.log('[setUserData] User data loaded successfully')
        setUser({ ...userData, isGuest: false })
        console.log('[setUserData] Set user state with DB data.');
      } else { 
        console.log('[setUserData] User profile not found, creating minimal context user')
        const minimalUser: ContextUser = { 
           id: session.user.id, 
           username: session.user.email?.split('@')[0] || 'NewUser',
           xp: 0,
           wins: 0,
           losses: 0,
           isGuest: false // Assume not guest if logged in
        }; 
        setUser(minimalUser);
        console.log('[setUserData] Set user state with minimal data.');
      }

    } catch (error) {
      console.error('[setUserData] Exception caught:', error) // Log exception
      setUser(null);
      console.log('[setUserData] Set user to null due to exception.');
    }
    console.log('[setUserData] Finished for user:', session.user.id); // Log end
  }, [supabase]); // Add supabase dependency

  // Add a function to sync guest cookie with localStorage 
  const syncGuestCookie = useCallback(() => {
    if (isGuest && user?.id) {
      // Ensure cookie exists for middleware
      document.cookie = `guest-user-token=${user.id}; path=/; max-age=604800; SameSite=Lax`;
    }
  }, [isGuest, user]);

  // Initialize auth state
  useEffect(() => {
    console.log('Auth state change listener initialized')
    
    // Get initial session
    const initializeAuth = async () => {
      setIsLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('Initial session:', session ? 'FOUND' : 'NONE')
        
        if (session) {
          console.log('User authenticated:', session.user.id)
          await setUserData(session)
        } else {
          console.log('No active session found')
          
          // Check for guest user in localStorage
          const guestUser = getGuestUser()
          if (guestUser) {
            console.log('Guest user found:', guestUser.username)
            setUser({ ...guestUser, isGuest: true })
            setIsGuest(true)
            
            // Sync cookie for middleware
            document.cookie = `guest-user-token=${guestUser.id}; path=/; max-age=604800; SameSite=Lax`;
          } else {
            console.log('No guest user found either')
            setUser(null)
            setIsGuest(false)
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        setUser(null)
        setIsGuest(false)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session ? `User: ${session.user.id}` : 'No session')
        
        if (session) {
          await setUserData(session)
          // Clear any guest user data when signing in
          clearLocalStorageGuestUser()
          setIsGuest(false)
        } else {
          setUser(null)
          setSession(null)
          
          // Check for guest user when logging out
          const guestUser = getGuestUser()
          if (guestUser) {
            setUser({ ...guestUser, isGuest: true })
            setIsGuest(true)
            
            // Sync cookie for middleware
            document.cookie = `guest-user-token=${guestUser.id}; path=/; max-age=604800; SameSite=Lax`;
          }
        }
        
        setIsLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
    // Add dependencies identified by linter
  }, [supabase, clearLocalStorageGuestUser, getGuestUser, setUserData]) // setUserData is now stable
  
  // Add this effect to ensure guest cookie is always in sync
  useEffect(() => {
    if (typeof window !== 'undefined') {
      syncGuestCookie();
      
      // Use navigation events instead of router events
      const handleRouteChange = () => {
        if (isGuest && user?.id) {
          syncGuestCookie();
        }
      };
      
      // Listen for history changes
      window.addEventListener('popstate', handleRouteChange);
      
      return () => {
        window.removeEventListener('popstate', handleRouteChange);
      };
    }
  }, [isGuest, user, syncGuestCookie]);

  // Effect to handle redirection after login/signup
  useEffect(() => {
    // Check if user exists and we are on a login/register page
    if (user && !isLoading && !isGuest) { // Ensure user is loaded, not a guest
      // Use window.location to check current path reliably in useEffect
      const currentPath = window.location.pathname;
      if (currentPath === '/login' || currentPath === '/register') {
        console.log('[Redirect Effect] User logged in, redirecting from auth page to /');
        router.replace('/');
      }
    }
  }, [user, isLoading, isGuest, router]); // Depend on user, loading state, and router

  // Sign in user
  const signIn = async (email: string, password: string) => {
    try {
      console.log('Signing in user:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Sign in error:', error)
        throw error
      }

      console.log('Sign in successful, session:', data.session?.user.id)
      
      if (data.session) {
        await setUserData(data.session)
        clearLocalStorageGuestUser()
        setIsGuest(false)
      }
    } catch (error) {
      console.error('Exception during sign in:', error)
      throw error
    }
  }
  
  // Sign up user
  const signUp = async (email: string, password: string, username: string) => {
    try {
      console.log('Signing up user:', email, username)
      
      // Step 1: Create Supabase auth account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      })

      if (error) {
        console.error('Sign up error:', error)
        throw error
      }

      console.log('Sign up successful, session:', data.session?.user.id)
      
      if (data.session && data.user) {
        // Now we need to create a user profile in the users table
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            username,
            email,
            xp: 0,
            level: 1,
            xp_to_next_level: 100,
            created_at: new Date().toISOString(),
          })

        if (profileError) {
          console.error('Error creating user profile:', profileError)
          // Continue anyway, as the auth account was created
        }
        
        // Clear any guest user data
        clearLocalStorageGuestUser()
        
        // Set user data
        await setUserData(data.session)
      }
    } catch (error) {
      console.error('Error in signUp:', error)
      throw error
    }
  }
  
  // Sign out user
  const signOut = async () => {
    console.log('Signing out user')
    try {
      await supabase.auth.signOut()
      clearLocalStorageGuestUser() // Use the alias for localStorage clearing
      setIsGuest(false)
      setUser(null)
      setSession(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }
  
  // Auto-create a guest user if no user is logged in
  const autoCreateGuestUser = (): ContextUser | null => {
    console.log('[autoCreateGuestUser] Attempting to create guest user...'); // Log start
    // Clear any existing guest user first
    try {
      clearLocalStorageGuestUser()
      
      // Generate a new guest user
      const guestUser = createGuestUser() // Assuming this is synchronous or handles its own errors
      if (!guestUser) {
        console.error('[autoCreateGuestUser] Failed to create guest user object')
        return null
      }
      
      console.log('[autoCreateGuestUser] Created guest user object:', guestUser.username);
      
      // Set as current user
      const contextUser: ContextUser = {
        id: guestUser.id,
        username: guestUser.username,
        isGuest: true,
        xp: guestUser.xp || 0,
        wins: guestUser.wins || 0,
        losses: guestUser.losses || 0,
      }
      
      setUser(contextUser)
      setIsGuest(true)
      console.log('[autoCreateGuestUser] Set user state to guest.', contextUser);
      
      return contextUser
    } catch (error) {
       console.error('[autoCreateGuestUser] Exception caught during guest creation:', error); // Log exception
       return null;
    }
  }

  // Function to play locally, completely bypassing the database
  const playLocal = () => {
    router.push('/game/pokestyle-local')
  }

  // Upgrade a guest user to a regular account
  const upgradeGuest = async () => {
    // Implementation will be added later
    throw new Error('Not implemented yet')
  }
  
  // Reset user password
  const resetPassword = async (email: string) => {
    try {
      console.log('Requesting password reset for:', email)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        console.error('Password reset error:', error)
        return { success: false, error }
      }

      console.log('Password reset email sent successfully')
      return { success: true }
    } catch (error) {
      console.error('Error in resetPassword:', error)
      return { success: false, error }
    }
  }

  // Define the function exposed by the context to clear storage AND state
  const clearGuestSession = () => {
    clearLocalStorageGuestUser(); // Clear from localStorage
    setUser(null);                // Clear user state
    setIsGuest(false);              // Update guest status state
    console.log("[AuthProvider] Cleared guest user state and localStorage.");
  }

  const value = {
    user,
    session,
    isLoading,
    isGuest,
    signIn,
    signUp,
    signOut,
    autoCreateGuestUser,
    playLocal,
    upgradeGuest,
    resetPassword,
    clearGuestSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext)
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
} 