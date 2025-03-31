"use client"

import { useState, useEffect, useCallback } from "react"
import { User, UserPlus, Users, Loader2, SendHorizontal } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"

import { getFriends, sendGameInvite } from "@/lib/db"
import type { User as UserType } from "@/lib/db"

interface GameInviteProps {
  userId: string
  gameId: string | null
  onInviteSuccess?: () => void
}

export function GameInvite({ userId, gameId, onInviteSuccess }: GameInviteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [friends, setFriends] = useState<UserType[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null)
  
  const { toast } = useToast()

  // Load friends when dialog opens
  useEffect(() => {
    if (isOpen && userId) {
      loadFriends()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId])

  const loadFriends = useCallback(async () => {
    if (!userId) return
    
    setLoading(true)
    try {
      const friendsData = await getFriends(userId)
      if (friendsData) {
        setFriends(friendsData)
      }
    } catch (error) {
      console.error("Error loading friends:", error)
      toast({
        title: "Error",
        description: "Failed to load your friends list.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [userId, toast])

  const filteredFriends = searchQuery.trim()
    ? friends.filter(friend => 
        friend.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        friend.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : friends

  const handleSendInvite = async (friendId: string) => {
    if (!userId || !gameId) {
      toast({
        title: "Error",
        description: "Cannot send invite. Game not created yet.",
        variant: "destructive"
      })
      return
    }

    setInvitingFriendId(friendId)
    
    try {
      const result = await sendGameInvite(userId, friendId, gameId)
      
      if (result.success) {
        toast({
          title: "Invite Sent",
          description: "Game invitation sent successfully!",
        })
        
        // Call the success callback if provided
        if (onInviteSuccess) {
          onInviteSuccess()
        }
      } else {
        throw new Error(result.message)
      }
    } catch (error: unknown) {
      console.error("Error sending game invite:", error)
      const message = error instanceof Error ? error.message : "Failed to send game invite.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      })
    } finally {
      setInvitingFriendId(null)
    }
  }

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1"
        disabled={!gameId}
      >
        <UserPlus size={16} />
        <span>Invite Friend</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users size={18} />
              Invite a Friend
            </DialogTitle>
            <DialogDescription>
              Select a friend from your list to invite them to this game.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Input
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
              <User className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <ScrollArea className="h-64 rounded-md border p-2">
                {filteredFriends.length > 0 ? (
                  <div className="space-y-2">
                    {filteredFriends.map(friend => (
                      <div 
                        key={friend.id}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={friend.avatar_url || undefined} alt={friend.username} />
                            <AvatarFallback className="bg-blue-600">
                              {friend.username?.substring(0, 2).toUpperCase() || '??'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{friend.username}</p>
                            <p className="text-xs text-gray-500">
                              {friend.online_status === 'online' ? (
                                <span className="text-green-500">● Online</span>
                              ) : (
                                <span>● Offline</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSendInvite(friend.id)}
                          disabled={invitingFriendId === friend.id}
                        >
                          {invitingFriendId === friend.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <SendHorizontal size={14} className="mr-1" />
                              Invite
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8 text-gray-500">
                    <Users size={32} className="mb-2 opacity-50" />
                    {friends.length === 0 ? (
                      <p>You don&apos;t have any friends yet.<br />Add friends to invite them to games.</p>
                    ) : (
                      <p>No friends match your search.</p>
                    )}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
} 