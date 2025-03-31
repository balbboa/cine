"use client"

import { useState, useEffect, useCallback } from "react"
import { Gamepad2, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { motion } from "framer-motion"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

import { getGameInvites, respondToGameInvite } from "@/lib/db"
import type { GameInvite } from "@/lib/db"
import { createClient } from "@/lib/supabase/client"

interface GameInvitesListProps {
  userId: string
}

export default function GameInvitesList({ userId }: GameInvitesListProps) {
  const [invites, setInvites] = useState<GameInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [processingInviteIds, setProcessingInviteIds] = useState<Set<number>>(new Set())
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const loadInvites = useCallback(async () => {
    if (!userId) return
    
    try {
      setLoading(true)
      const invitesData = await getGameInvites(userId)
      if (invitesData) {
        // Only show pending invites where user is the receiver
        const pendingInvites = invitesData.filter(invite => 
          invite.status === 'pending' && invite.receiver_id === userId
        )
        setInvites(pendingInvites)
      }
    } catch (error) {
      console.error("Error loading game invites:", error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId) {
      loadInvites()
      
      // Subscribe to changes in game invites
      const invitesSubscription = supabase
        .channel(`game_invites_for_${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "game_invites",
            filter: `receiver_id=eq.${userId}`
          },
          () => {
            loadInvites()
          }
        )
        .subscribe()
        
      return () => {
        supabase.removeChannel(invitesSubscription)
      }
    }
  }, [userId, supabase, loadInvites])

  const handleRespondToInvite = async (inviteId: number, accept: boolean) => {
    if (!userId) return
    
    setProcessingInviteIds(prev => new Set(prev).add(inviteId))
    
    try {
      const success = await respondToGameInvite(inviteId, userId, accept)
      
      if (success) {
        toast({
          title: accept ? "Invite Accepted" : "Invite Declined",
          description: accept ? "Joining the game..." : "Game invite declined",
          variant: accept ? "default" : "destructive"
        })
        
        // Remove this invite from the list
        setInvites(prev => prev.filter(invite => invite.id !== inviteId))
        
        // If accepted, navigate to the game
        if (accept) {
          const invite = invites.find(inv => inv.id === inviteId)
          if (invite?.game?.id) {
            router.push(`/game/${invite.game.id}`)
          }
        }
      } else {
        throw new Error("Failed to process invite")
      }
    } catch (error) {
      console.error("Error responding to invite:", error)
      toast({
        title: "Error",
        description: "Failed to process game invite. Please try again.",
        variant: "destructive"
      })
    } finally {
      setProcessingInviteIds(prev => {
        const next = new Set(prev)
        next.delete(inviteId)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (invites.length === 0) {
    return null
  }

  return (
    <div className="space-y-4 mb-6">
      <Alert className="bg-blue-500/10 border-blue-500/20">
        <Gamepad2 className="h-4 w-4 text-blue-500" />
        <AlertTitle>Game Invites</AlertTitle>
        <AlertDescription>
          You have {invites.length} pending game {invites.length === 1 ? "invite" : "invites"}
        </AlertDescription>
      </Alert>
      
      <div className="space-y-3">
        {invites.map(invite => {
          const sender = invite.sender
          const isProcessing = processingInviteIds.has(invite.id)
          
          if (!sender) return null
          
          return (
            <motion.div
              key={invite.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={sender.avatar_url || undefined} alt={sender.username} />
                  <AvatarFallback className="bg-blue-600">
                    {sender.username?.substring(0, 2).toUpperCase() || '??'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-white">{sender.username}</p>
                  <div className="flex items-center gap-1">
                    <Gamepad2 className="h-3 w-3 text-blue-400" />
                    <p className="text-xs text-blue-400">
                      Invited you to play {invite.game?.game_mode || "a game"}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleRespondToInvite(invite.id, true)}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={16} className="mr-1" />}
                  Join
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRespondToInvite(invite.id, false)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X size={16} />}
                </Button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
} 