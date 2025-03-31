'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { joinGameByInviteCode } from '@/lib/invite-code'
import { useAuth } from '@/lib/auth'
import { Loader2 } from 'lucide-react'

interface JoinGameProps {
  initialInviteCode?: string;
  className?: string;
}

export default function JoinGameComponent({ initialInviteCode = '', className = '' }: JoinGameProps) {
  const [code, setCode] = useState(initialInviteCode.toUpperCase());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { user /*, session */ } = useAuth();

  const handleJoinGame = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedCode) {
      setError("Please enter a valid invite code.");
      return;
    }
    
    if (!user || !user.id) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in or continue as guest to join a game.',
          variant: 'destructive',
        });
        setError("Authentication required to join.");
        return; 
    }
    
    setIsLoading(true);
    
    try {
      const game = await joinGameByInviteCode(trimmedCode, user.id);
      
      if (!game) {
        throw new Error('Game not found, is full, or you cannot join.');
      }
      
      toast({
        title: 'Game Joined!',
        description: 'Redirecting you to the game...',
      });
      
      router.push(`/game/${game.id}`);
    } catch (error: unknown) {
      console.error('Error joining game:', error);
      const message = error instanceof Error ? error.message : 'Failed to join game. Please check the code.';
      setError(message);
      toast({
        title: 'Error Joining Game',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    setCode(initialInviteCode.toUpperCase());
  }, [initialInviteCode]);

  return (
    <form onSubmit={handleJoinGame} className={`space-y-2 ${className}`}>
      <div className="flex space-x-2">
        <Input
          value={code}
          onChange={(e) => {
              setCode(e.target.value.toUpperCase()); 
              setError(null);
          }}
          placeholder="ENTER INVITE CODE"
          className="flex-1 bg-gray-800 border-gray-600 focus:border-teal-500 focus:ring-teal-500 text-center font-bold tracking-widest text-lg placeholder:tracking-normal placeholder:font-normal placeholder:text-gray-500"
          maxLength={6}
          disabled={isLoading}
        />
        <Button 
            type="submit" 
            disabled={isLoading || !code.trim()} 
            className="bg-teal-600 hover:bg-teal-700 text-white px-6"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join'}
        </Button>
      </div>
      {error && <p className="text-red-400 text-sm px-1">{error}</p>}
    </form>
  )
} 