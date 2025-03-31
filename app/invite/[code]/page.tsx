'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle, Home } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/lib/auth'
import { joinGameByInviteCode } from '@/lib/invite-code'

export default function InviteCodePage({ params }: { params: { code: string } }) {
  const [isLoading, setIsLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Checking invite code...')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const inviteCode = params.code
  const { user, session } = useAuth()

  useEffect(() => {
    const processInvite = async () => {
      if (!inviteCode) {
        setError('Invalid invite code provided.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        setLoadingMessage('Checking authentication...')
        
        if (!session) {
          toast({
            title: "Authentication Required",
            description: "Please sign in or sign up to join the game.",
            variant: "destructive"
          })
          const callbackUrl = encodeURIComponent(`/invite/${inviteCode}`)
          router.push(`/login?callbackUrl=${callbackUrl}&message=Please sign in to join the game`)
          return
        }

        if (!user || !user.id) {
           setError('Could not retrieve your user profile. Please try logging in again.')
           setIsLoading(false)
           return
         }
        
        setLoadingMessage('Attempting to join game...')
        const game = await joinGameByInviteCode(inviteCode, user.id)
        
        if (!game) {
          setError('Game not found, is full, or you are already part of it.') 
          setIsLoading(false)
          return
        }
        
        toast({
          title: 'Game joined successfully!',
          description: 'Redirecting you to the game...',
        })
        
        router.push(`/game/${game.id}`)
      } catch (error: unknown) {
        console.error('Error joining game:', error)
        const message = error instanceof Error ? error.message : 'An unexpected error occurred while trying to join the game.';
        setError(message)
        setIsLoading(false)
      }
    }

    processInvite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode, router, toast, session, user])

  const handleRetry = () => {
    setIsLoading(true)
    setError(null)
    router.refresh()
  }

  const goToHome = () => {
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-black p-4">
      <div className="w-full max-w-md p-8 bg-black/80 backdrop-blur-md rounded-xl border border-white/20 shadow-lg text-white">
        <h1 className="text-2xl font-bold text-center mb-6">Joining Game via Invite</h1>
        
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-300" />
            <p className="text-lg text-gray-300">{loadingMessage}</p>
          </div>
        ) : error ? (
          <div className="space-y-6 text-center">
             <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-red-400" />
             <h3 className="font-semibold text-xl text-red-300">Failed to Join Game</h3>
             <p className="text-sm text-red-200 px-4">{error}</p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
              <Button onClick={handleRetry} variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/30">
                <Loader2 size={16} className="mr-2 animate-spin hidden" />
                Try Again
              </Button>
              <Button onClick={goToHome} variant="secondary" className="bg-gray-700 hover:bg-gray-600 text-white">
                <Home size={16} className="mr-2" />
                Go to Home
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-lg text-green-300">Successfully joined! Redirecting...</p>
          </div>
        )}
      </div>
    </div>
  )
} 