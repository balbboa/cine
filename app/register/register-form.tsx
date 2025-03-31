'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { signUp } = useAuth()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Validate inputs
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await signUp(email, password, username)
      // The AuthProvider will handle redirect after successful signup
    } catch (error) {
      console.error('Registration error:', error)
      setError(error instanceof Error ? error.message : 'Failed to create account. Please try again.')
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
        <h2 className="mt-6 text-3xl font-extrabold text-white">Create your account</h2>
        <p className="mt-2 text-sm text-gray-300">
          Or <Link href="/login" className="text-blue-400 hover:text-blue-300">sign in to your existing account</Link>
        </p>
      </div>
      
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-900/70 text-white p-3 rounded-md">
            {error}
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="username" className="text-white">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-gray-900/50 border-gray-700 text-white"
            />
          </div>
          
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
            <Label htmlFor="password" className="text-white">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-900/50 border-gray-700 text-white"
            />
          </div>
          
          <div>
            <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
                Creating account...
              </>
            ) : (
              'Sign up'
            )}
          </Button>
        </div>
        
        <div className="text-center text-xs text-gray-400">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </div>
      </form>
    </div>
  )
} 