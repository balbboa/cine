'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })
      
      if (error) {
        setError(error.message)
      } else {
        setMessage('Password updated successfully!')
        setTimeout(() => {
          router.push('/')
        }, 2000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/20 backdrop-blur-lg border-white/30">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Reset Password</CardTitle>
          <CardDescription className="text-white/80">
            Please enter your new password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/30 border-white/30 text-white placeholder:text-white/70"
                placeholder="Enter new password"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-white/30 border-white/30 text-white placeholder:text-white/70"
                placeholder="Confirm new password"
                required
              />
            </div>
            
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-white p-3 rounded-md">
                {error}
              </div>
            )}
            
            {message && (
              <div className="bg-green-500/20 border border-green-500/50 text-white p-3 rounded-md">
                {message}
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full bg-white/30 hover:bg-white/50 text-white font-bold"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Reset Password'}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <Button
            variant="link"
            onClick={() => router.push('/login')}
            className="w-full text-white/80 hover:text-white"
          >
            Back to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 