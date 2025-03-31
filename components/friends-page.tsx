"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { motion } from "framer-motion"
import { UserPlus, X, Search, Users, UserMinus, Mail, Loader2, AlertCircle, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription, 
  DialogClose 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/lib/supabase/client"
import { getFriends, sendFriendRequest, deleteFriendship, getFriendRequests, respondToFriendRequest } from "@/lib/db"
import type { User as UserType, FriendRequest } from "@/lib/db"

interface FriendsPageProps {
  userId: string | undefined;
}

export default function FriendsPage({ userId }: FriendsPageProps) {
  const { toast } = useToast()
  const [friends, setFriends] = useState<UserType[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [friendUsername, setFriendUsername] = useState("")
  const [addingFriend, setAddingFriend] = useState(false)
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false)
  const [removingFriendIds, setRemovingFriendIds] = useState<Set<string>>(new Set())
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<string>("friends")

  const supabase = createClient();

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
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load data: ${message}`);
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
     if (!userId || !friendUsername.trim()) return;
 
     setAddingFriend(true);
     setError(null);
     
     try {
       const result = await sendFriendRequest(userId, friendUsername.trim());

       if (result.success) {
         toast({ 
           title: "Friend Request Sent", 
           description: `Request sent to ${result.receiver?.username || friendUsername}.` 
         });
         setFriendUsername("");
         setShowAddFriendDialog(false);
       } else {
         throw new Error(result.message);
       }
     } catch (err: unknown) {
       console.error("Error adding friend:", err);
       const message = err instanceof Error ? err.message : 'An unknown error occurred';
       setError(message);
       toast({ title: "Error", description: message, variant: "destructive" });
     } finally {
       setAddingFriend(false);
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
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to remove friend: ${message}`);
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
      const message = err instanceof Error ? err.message : 'Failed to process request.';
      toast({ 
        title: "Error", 
        description: message, 
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
        className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg mb-2"
      >
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={friend.avatar_url || undefined} alt={friend.username || 'User'} />
            <AvatarFallback className="bg-gray-600">
              {friend.username?.substring(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-white">{friend.username || 'Unknown user'}</p>
            {friend.online_status && (
              <Badge variant="outline" className="text-xs">
                {friend.online_status}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
  };

  const renderFriendRequestItem = (request: FriendRequest, type: 'incoming' | 'outgoing') => {
    const isProcessing = processingRequestIds.has(request.id);
    const otherUser = type === 'incoming' ? request.sender : request.receiver;
    
    return (
      <motion.div
        key={request.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg mb-2"
      >
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={otherUser?.avatar_url || undefined} alt={otherUser?.username || 'User'} />
            <AvatarFallback className="bg-gray-600">
              {otherUser?.username?.substring(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-white">{otherUser?.username || 'Unknown user'}</p>
            <Badge variant="outline" className="text-xs">
              {type === 'incoming' ? 'Incoming Request' : 'Outgoing Request'}
            </Badge>
          </div>
        </div>
        
        {type === 'incoming' && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="text-green-500 border-green-500 hover:bg-green-500/20"
              onClick={() => handleRespondToRequest(request.id, true)}
              disabled={isProcessing}
              aria-label="Accept request"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={18} />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="text-red-500 border-red-500 hover:bg-red-500/20"
              onClick={() => handleRespondToRequest(request.id, false)}
              disabled={isProcessing}
              aria-label="Reject request"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X size={18} />}
            </Button>
          </div>
        )}
        
        {type === 'outgoing' && (
          <Badge className="bg-gray-600">Pending</Badge>
        )}
      </motion.div>
    );
  };

  if (!userId) {
    return (
      <div className="p-6 bg-gray-900 text-white rounded-lg shadow-xl border border-gray-700">
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Required</AlertTitle>
            <AlertDescription>
                Please log in to manage your friends list.
            </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-900 text-white rounded-lg shadow-xl border border-gray-700 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold flex items-center"><Users className="mr-2"/> Friends</h2>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowAddFriendDialog(true)} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <UserPlus className="mr-2" /> Add Friend
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="friends" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="friends" className="flex-1">
            Friends
            {friends.length > 0 && <Badge className="ml-2 bg-gray-600">{friends.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex-1">
            Requests
            {pendingRequests.length > 0 && (
              <Badge className="ml-2 bg-blue-600">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="friends" className="mt-6">
          {!loading && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search friends..."
                className="pl-10 bg-gray-800 border-gray-700"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
          
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : filteredFriends.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700">
              <Users className="h-12 w-12 mx-auto text-gray-500" />
              <h3 className="mt-4 text-lg font-medium text-gray-300">You haven&apos;t added any friends yet.</h3>
              <p className="mt-2 text-sm text-gray-400">Use the button above to add friends by username.</p>
            </div>
          ) : (
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {filteredFriends.map(renderFriendItem)}
            </motion.div>
          )}
        </TabsContent>
        
        <TabsContent value="requests" className="mt-6">
          <div className="grid grid-cols-1 gap-6">
            <section>
              <h2 className="text-xl font-semibold mb-4 text-blue-300 flex items-center">
                <Mail className="mr-2 h-5 w-5" />
                Incoming Requests
                <Badge variant="secondary" className="ml-2 bg-blue-500/20 text-blue-300">{incomingRequests.length}</Badge>
              </h2>
              {incomingRequests.length > 0 ? (
                <motion.div 
                  className="space-y-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {incomingRequests.map(req => renderFriendRequestItem(req, 'incoming'))}
                </motion.div>
              ) : (
                <p className="text-gray-400 italic">No incoming friend requests.</p>
              )}
            </section>
            
            <div className="border-t border-gray-700 my-4"></div>
            
            <section>
              <h2 className="text-xl font-semibold mb-4 text-purple-300 flex items-center">
                <UserPlus className="mr-2 h-5 w-5" />
                Sent Requests
                <Badge variant="secondary" className="ml-2 bg-purple-500/20 text-purple-300">{outgoingRequests.length}</Badge>
              </h2>
              {outgoingRequests.length > 0 ? (
                <motion.div 
                  className="space-y-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {outgoingRequests.map(req => renderFriendRequestItem(req, 'outgoing'))}
                </motion.div>
              ) : (
                <p className="text-gray-400 italic">You haven&apos;t sent any friend requests.</p>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Add Friend Dialog */}
      <Dialog open={showAddFriendDialog} onOpenChange={setShowAddFriendDialog}>
        <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Add Friend</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter a username to send a friend request.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                Username
              </Label>
              <Input
                id="username"
                value={friendUsername}
                onChange={(e) => setFriendUsername(e.target.value)}
                placeholder="Enter username"
                className="col-span-3 bg-gray-800 border-gray-700"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleAddFriend} 
              disabled={addingFriend || !friendUsername.trim()} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              {addingFriend ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

