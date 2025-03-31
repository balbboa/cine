"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { motion } from "framer-motion"
import { UserPlus, X, Check, Search, Loader2, UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import type { User as UserType, FriendRequest } from "@/lib/db"
import { getFriends, sendFriendRequest, deleteFriendship, getFriendRequests, respondToFriendRequest } from "@/lib/db"
import { createClient } from "@/lib/supabase/client"

interface FriendsListProps {
  userId: string | undefined
}

export default function FriendsList({ userId }: FriendsListProps) {
  const [friends, setFriends] = useState<UserType[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [addUsername, setAddUsername] = useState("")
  const [isAddingFriend, setIsAddingFriend] = useState(false)
  const [isShowingAddFriend, setIsShowingAddFriend] = useState(false)
  const [removingFriendIds, setRemovingFriendIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<string>("friends")
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<number>>(new Set())
  
  const supabase = createClient();
  const { toast } = useToast();

  const loadData = useCallback(async (showLoading = true) => {
    if (!userId) {
      setError("User ID not available.");
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    setError(null);

    try {
      // Load friends
      const friendsData = await getFriends(userId);
      if (friendsData) {
        setFriends(friendsData);
      }

      // Load friend requests
      const requestsData = await getFriendRequests(userId);
      if (requestsData) {
        setFriendRequests(requestsData);
      }
    } catch (err: unknown) {
      console.error("Error loading friends data:", err);
      setError(`Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadData();
    } else {
      setLoading(false);
      setError("Waiting for user authentication...");
    }

    // Subscribe to changes in friendships and friend requests
    if (userId) {
      const friendsSubscription = supabase
        .channel(`friends_changes_for_${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "friendships",
            filter: `user_id=eq.${userId},friend_id=eq.${userId}`
          },
          () => {
            loadData(false);
          }
        )
        .subscribe();

      const requestsSubscription = supabase
        .channel(`friend_requests_for_${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "friend_requests",
            filter: `sender_id=eq.${userId},receiver_id=eq.${userId}`
          },
          () => {
            loadData(false);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(friendsSubscription);
        supabase.removeChannel(requestsSubscription);
      };
    }
  }, [userId, supabase, loadData]);

  const handleAddFriend = async () => {
    if (!userId || !addUsername.trim()) return;

    setIsAddingFriend(true);
    setError(null);
    
    try {
      const result = await sendFriendRequest(userId, addUsername.trim());

      if (result.success) {
        toast({ 
          title: "Friend Request Sent", 
          description: `Request sent to ${result.receiver?.username || addUsername}.` 
        });
        setAddUsername("");
        setIsShowingAddFriend(false);
      } else {
        throw new Error(result.message);
      }
    } catch (err: unknown) {
      console.error("Error adding friend:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Failed to add friend.', variant: "destructive" });
    } finally {
      setIsAddingFriend(false);
    }
  }

  const handleRemoveFriend = async (friendId: string) => {
    if (!userId) return;
    
    setRemovingFriendIds(prev => new Set(prev).add(friendId));
    setError(null);
    
    try {
      const success = await deleteFriendship(userId, friendId);

      if (success) {
        toast({ title: "Friend Removed", description: "Friendship removed successfully.", variant: "destructive" });
        setFriends(prev => prev.filter(friend => friend.id !== friendId));
      } else {
        throw new Error("Failed to remove friend.");
      }
    } catch (err: unknown) {
      console.error("Error removing friend:", err);
      setError(`Failed to remove friend: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast({ title: "Error", description: `Failed to remove friend.`, variant: "destructive" });
    } finally {
      setRemovingFriendIds(prev => {
        const next = new Set(prev);
        next.delete(friendId);
        return next;
      });
    }
  }

  const handleRespondToRequest = async (requestId: number, accept: boolean) => {
    if (!userId) return;
    
    setProcessingRequestIds(prev => new Set(prev).add(requestId));
    
    try {
      const result = await respondToFriendRequest(requestId, userId, accept);
      
      if (result.success) {
        toast({ 
          title: accept ? "Friend Request Accepted" : "Friend Request Rejected", 
          description: result.message,
          variant: accept ? "default" : "destructive" 
        });
        
        // Update the UI
        setFriendRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, status: accept ? 'accepted' : 'rejected' } 
              : req
          )
        );
        
        // If accepted, reload friends list
        if (accept) {
          loadData(false);
        }
      } else {
        throw new Error(result.message);
      }
    } catch (err: unknown) {
      console.error("Error responding to request:", err);
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : 'Failed to process request.', 
        variant: "destructive" 
      });
    } finally {
      setProcessingRequestIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  }

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    
    const query = searchQuery.toLowerCase();
    return friends.filter(friend => 
      friend.username?.toLowerCase().includes(query) ||
      friend.email?.toLowerCase().includes(query)
    );
  }, [friends, searchQuery]);

  const pendingRequests = useMemo(() => {
    return friendRequests.filter(req => req.status === 'pending');
  }, [friendRequests]);

  const incomingRequests = useMemo(() => {
    return pendingRequests.filter(req => req.receiver_id === userId);
  }, [pendingRequests, userId]);

  const outgoingRequests = useMemo(() => {
    return pendingRequests.filter(req => req.sender_id === userId);
  }, [pendingRequests, userId]);

  const renderFriendItem = (friend: UserType) => {
    const isRemoving = removingFriendIds.has(friend.id);
    
    return (
      <motion.div
        key={friend.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg"
      >
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={friend.avatar_url || undefined} alt={friend.username} />
            <AvatarFallback className="bg-gray-600">
              {friend.username?.substring(0, 2).toUpperCase() || '??'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-white">{friend.username}</p>
            <p className="text-xs text-gray-400">
              {friend.online_status === 'online' ? (
                <span className="text-green-500">● Online</span>
              ) : (
                <span className="text-gray-500">● Offline</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Invite to game button would go here */}
          <Button
            variant="destructive"
            size="icon"
            onClick={() => handleRemoveFriend(friend.id)}
            disabled={isRemoving}
            aria-label={`Remove ${friend.username}`}
          >
            {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus size={18} />}
          </Button>
        </div>
      </motion.div>
    );
  }

  const renderFriendRequestItem = (request: FriendRequest, type: 'incoming' | 'outgoing') => {
    const isProcessing = processingRequestIds.has(request.id);
    const user = type === 'incoming' ? request.sender : request.receiver;
    
    if (!user) return null;
    
    return (
      <motion.div
        key={request.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg"
      >
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
            <AvatarFallback className="bg-gray-600">
              {user.username?.substring(0, 2).toUpperCase() || '??'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-white">{user.username}</p>
            <p className="text-xs text-gray-400">
              {type === 'incoming' ? 'Wants to be your friend' : 'Request sent'}
            </p>
          </div>
        </div>
        
        {type === 'incoming' && (
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="icon"
              onClick={() => handleRespondToRequest(request.id, true)}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={18} />}
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => handleRespondToRequest(request.id, false)}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X size={18} />}
            </Button>
          </div>
        )}
        
        {type === 'outgoing' && (
          <Badge variant="outline" className="text-gray-400">Pending</Badge>
        )}
      </motion.div>
    );
  }

  if (loading && friends.length === 0 && friendRequests.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full bg-white/20 dark:bg-gray-800/30" />
        <Skeleton className="h-10 w-full bg-white/20 dark:bg-gray-800/30" />
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-white/20 dark:bg-gray-800/30" />
          ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="friends" className="relative">
              Friends
              {friends.length > 0 && (
                <Badge className="ml-1 bg-blue-600">{friends.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Requests
              {incomingRequests.length > 0 && (
                <Badge className="ml-1 bg-red-600">{incomingRequests.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsShowingAddFriend(true)}
            className="flex items-center gap-1"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Add Friend</span>
          </Button>
        </div>
        
        <TabsContent value="friends" className="mt-0">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-3">
            {filteredFriends.length > 0 ? (
              filteredFriends.map(renderFriendItem)
            ) : (
              <div className="text-center py-8 text-gray-400">
                {searchQuery ? "No matching friends found" : "No friends yet. Add some friends!"}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-0">
          {incomingRequests.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Incoming Requests</h3>
              <div className="space-y-3 mb-6">
                {incomingRequests.map(req => renderFriendRequestItem(req, 'incoming'))}
              </div>
            </>
          )}
          
          {outgoingRequests.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Sent Requests</h3>
              <div className="space-y-3">
                {outgoingRequests.map(req => renderFriendRequestItem(req, 'outgoing'))}
              </div>
            </>
          )}

          {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No friend requests
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isShowingAddFriend} onOpenChange={setIsShowingAddFriend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Friend</DialogTitle>
            <DialogDescription>
              Enter a username to send a friend request
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Input
                placeholder="Enter username..."
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsShowingAddFriend(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddFriend} 
              disabled={isAddingFriend || !addUsername.trim()}
            >
              {isAddingFriend ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>Send Request</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

