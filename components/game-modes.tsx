"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from "framer-motion"
import { Zap, Trophy, Ticket, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, RefreshCcw, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { getGameIdFromInviteCode } from '@/lib/invite-code'
import { createClient } from "@/lib/supabase/client"
import { 
  Card, 
  CardContent, 
  CardDescription,
  CardHeader, 
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface GameModesProps {
  onStartGame: (mode: string) => void;
  error: string | null;
  isGuest: boolean;
}

export default function GameModes({ 
  onStartGame, 
  error,
  isGuest,
}: GameModesProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState<{[key in 'quick' | 'ranked']: boolean}>({
    quick: false,
    ranked: false,
  })
  const [inviteCode, setInviteCode] = useState('');
  const [isJoiningWithCode, setIsJoiningWithCode] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    quickMatch: string | null,
    rankedMatch: string | null,
  }>({
    quickMatch: null,
    rankedMatch: null,
  })
  const [showInviteInput, setShowInviteInput] = useState(false);

  const combinedErrors = {
    quickMatch: errors.quickMatch,
    rankedMatch: errors.rankedMatch || error
  };

  const handleQuickMatch = async () => {
    setLoading(prev => ({ ...prev, quick: true }))
    setErrors(prev => ({ ...prev, quickMatch: null }))
    try {
      await onStartGame('quick');
    } catch (error: unknown) {
      console.error('Error starting quick match (from GameModes):', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start quick match.';
      setErrors(prev => ({ ...prev, quickMatch: errorMessage }))
      toast({ variant: "destructive", title: "Quick Match Error", description: errorMessage });
    } finally {
      setLoading(prev => ({ ...prev, quick: false }))
    }
  }
  
  const handleRankedMatch = async () => {
    setLoading(prev => ({ ...prev, ranked: true }))
    setErrors(prev => ({ ...prev, rankedMatch: null }))
    try {
      if (!user || isGuest) {
        const msg = "Please sign in to play Ranked mode.";
        toast({ title: "Login Required", description: msg });
        setErrors(prev => ({ ...prev, rankedMatch: msg }));
        setLoading(prev => ({ ...prev, ranked: false }));
        return; 
      }
      await onStartGame('ranked');
    } catch (error: unknown) {
      console.error('Error starting ranked match (from GameModes):', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start ranked match.';
      setErrors(prev => ({ ...prev, rankedMatch: errorMessage }))
      toast({ variant: "destructive", title: "Ranked Match Error", description: errorMessage });
    } finally {
      setLoading(prev => ({ ...prev, ranked: false }))
    }
  }
  
  const retryRankedMatch = () => {
    setErrors(prev => ({ ...prev, rankedMatch: null }))
    handleRankedMatch()
  }
  
  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinCodeError(null);

    if (!inviteCode.trim()) {
      const msg = 'Please enter a valid invite code';
      setJoinCodeError(msg);
      toast({ title: 'Invite code required', description: msg, variant: 'destructive' });
      return;
    }

    setIsJoiningWithCode(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        router.push(`/login?callbackUrl=/invite/${inviteCode}`);
        return; 
      }

      const gameId = await getGameIdFromInviteCode(inviteCode);

      if (!gameId) {
        throw new Error('Game not found or code is invalid/expired.');
      }

      router.push(`/invite/${inviteCode}`); 

    } catch (error) {
      console.error('Error joining game with code:', error);
      const msg = error instanceof Error ? error.message : 'Could not find game with this invite code.';
      setJoinCodeError(msg);
      toast({ title: 'Error joining game', description: msg, variant: 'destructive' });
    } finally {
      setIsJoiningWithCode(false); 
    }
  };
  
  const renderErrorAlerts = () => {
    return (
      <>
        {combinedErrors.quickMatch && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Quick Match Error</AlertTitle>
            <AlertDescription>
              {combinedErrors.quickMatch}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 flex items-center gap-1"
                onClick={handleQuickMatch}
              >
                <RefreshCcw className="h-3 w-3" /> Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {combinedErrors.rankedMatch && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Ranked Match Error</AlertTitle>
            <AlertDescription>
              {combinedErrors.rankedMatch}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 flex items-center gap-1"
                onClick={retryRankedMatch}
              >
                <RefreshCcw className="h-3 w-3" /> Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </>
    );
  };

  const toggleInviteInput = () => {
    setShowInviteInput(!showInviteInput);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {renderErrorAlerts()}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-gradient-to-br from-blue-900/70 to-purple-900/70 border-blue-700/50 overflow-hidden shadow-lg">
          <CardHeader className="p-6 pb-4">
            <CardTitle className="flex items-center text-2xl text-white"><Zap className="mr-3 text-yellow-400"/> Quick Match</CardTitle>
            <CardDescription className="text-blue-200 mt-2">Jump into a game against a random opponent. Casual play.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-3">
            <Button 
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 text-lg"
              onClick={handleQuickMatch} 
              disabled={loading.quick}
            >
              {loading.quick ? <Loader2 className="h-5 w-5 animate-spin mr-3"/> : null}
              {loading.quick ? 'Starting...' : 'Find Opponent'}
            </Button>
            
            <Separator className="my-5 bg-blue-700/30" />
            
            <Button
              variant="ghost"
              onClick={toggleInviteInput}
              className="w-full flex items-center justify-between text-blue-100 hover:text-white hover:bg-blue-800/30 mb-2 py-3"
            >
              <div className="flex items-center">
                <Ticket className="mr-3 text-green-400" /> 
                <span>Join with Invite Code</span>
              </div>
              {showInviteInput ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
          </CardContent>
          
          <CardContent className={cn("px-6 py-4", {
            "hidden": !showInviteInput
          })}>
            <form onSubmit={handleJoinWithCode} className="mt-2 space-y-3">
              <div className="flex flex-col gap-2">
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter code..."
                  className="bg-blue-900/40 border-blue-700/60 text-white placeholder:text-blue-300/60 py-5"
                  maxLength={10}
                  aria-label="Invite Code"
                  disabled={isJoiningWithCode}
                />
                {joinCodeError && (
                  <p className="text-red-300 text-xs">{joinCodeError}</p>
                )}
              </div>
              <Button 
                type="submit" 
                disabled={isJoiningWithCode || !inviteCode.trim()}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                size="lg"
              >
                {isJoiningWithCode ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                {isJoiningWithCode ? 'Joining...' : 'Join Game'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-900/70 to-orange-900/70 border-red-700/50 overflow-hidden shadow-lg">
          <CardHeader className="p-6 pb-4">
            <CardTitle className="flex items-center text-2xl text-white"><Trophy className="mr-3 text-orange-400"/> Ranked Match</CardTitle>
            <CardDescription className="text-orange-200 mt-2">Play against opponents of similar skill for leaderboard points. Requires login.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Button 
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 text-lg"
              onClick={handleRankedMatch} 
              disabled={loading.ranked || !user || isGuest} 
              title={!user || isGuest ? "Login required for Ranked Play" : "Find Ranked Match"}
            >
              {loading.ranked ? <Loader2 className="h-5 w-5 animate-spin mr-3"/> : null}
              {loading.ranked ? 'Starting...' : 'Find Ranked Match'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

