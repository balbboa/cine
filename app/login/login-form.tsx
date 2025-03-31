'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { signIn } = useAuth()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    
    try {
      await signIn(email, password)
      // Will redirect in the signIn function
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invalid credentials. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="max-w-md w-full space-y-8 bg-black/30 p-8 rounded-xl backdrop-blur-sm">
      <div className="text-center">
        <div className="flex items-center justify-center gap-4 mx-auto mb-4">
          <Image 
            src="/clapperboard.png"
            alt="Clapperboard Icon"
            width={80}
            height={80}
            priority
          />
        </div>
        <h2 className="mt-6 text-3xl font-extrabold text-white">Sign in to Cine-Tac-Toe</h2>
        <p className="mt-2 text-sm text-gray-300">
          Or <button onClick={() => router.push('/register')} className="text-blue-400 hover:text-blue-300">create a new account</button>
        </p>
        {message && (
          <p className="mt-2 text-sm bg-blue-900/70 p-2 rounded text-white">
            {message}
          </p>
        )}
      </div>
      
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-900/70 text-white p-3 rounded-md">
            {error}
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-900/50 border-gray-700 text-white"
            />
          </div>
          
          <div>
            <div className="flex justify-between">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Link href="/auth/reset-password" className="text-sm text-blue-400 hover:text-blue-300">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-900/50 border-gray-700 text-white"
            />
          </div>
        </div>
        
        <div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
} 