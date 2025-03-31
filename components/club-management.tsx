"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion } from "framer-motion"
import { Users, Plus, Search, X, UserPlus, Loader2, LogOut, AlertCircle, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/lib/supabase/client"
import { 
  leaveClub, 
  createClub, 
  getUserCredits, 
  requestToJoinClub, 
  getClubJoinRequests, 
  respondToJoinRequest, 
  getUserJoinRequests,
  ClubJoinRequest,
  UserJoinRequestWithClubData
} from "@/lib/club"
import ClubDetailModal from "@/components/club-detail-modal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Card, 
  CardContent, 
} from "@/components/ui/card"
import type { Database } from '@/types/database.types'

// Define derived types from Database
type Club = Database['public']['Tables']['clubs']['Row'];
type ClubMember = Database['public']['Tables']['club_members']['Row'];

// Add member_count to Club type
type ClubWithMemberCount = Club & { member_count: number };

// Update ClubMemberWithClub to use the new Club type
interface ClubMemberWithClub extends ClubMember {
  clubs: ClubWithMemberCount | null;
}

/* // Remove - Replaced by imported UserJoinRequestWithClubData
// Club join request with club data
// Update to extend the renamed local type
interface ClubJoinRequestWithClub extends DbClubJoinRequest {
  clubs: Club | null;
}
*/

interface ClubManagementProps {
  userId: string | undefined;
}

export default function ClubManagement({ userId }: ClubManagementProps) {
  const [activeTab, setActiveTab] = useState("my-clubs");
  const [allClubs, setAllClubs] = useState<ClubWithMemberCount[]>([])
  const [userClubs, setUserClubs] = useState<ClubMemberWithClub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newClubName, setNewClubName] = useState("")
  const [newClubDescription, setNewClubDescription] = useState("")
  const [newJoinRequestMessage, setNewJoinRequestMessage] = useState("")
  const [creatingClub, setCreatingClub] = useState(false)
  const [joiningClubIds, setJoiningClubIds] = useState<Set<number>>(new Set());
  const [leavingClubIds, setLeavingClubIds] = useState<Set<number>>(new Set());
  const [userCredits, setUserCredits] = useState<number | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)
  const [selectedClub, setSelectedClub] = useState<number | null>(null);
  const [showClubDetailModal, setShowClubDetailModal] = useState(false);
  const [showJoinRequestDialog, setShowJoinRequestDialog] = useState(false);
  const [targetClubForJoinRequest, setTargetClubForJoinRequest] = useState<Club | null>(null);
  const [clubJoinRequests, setClubJoinRequests] = useState<ClubJoinRequest[]>([]);
  const [userJoinRequests, setUserJoinRequests] = useState<UserJoinRequestWithClubData[]>([]);
  const [loadingJoinRequests, setLoadingJoinRequests] = useState(false);
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<number>>(new Set());
  const [ownedClubs, setOwnedClubs] = useState<Set<number>>(new Set());
  const [pendingRequestClubIds, setPendingRequestClubIds] = useState<Set<number>>(new Set());
  const [showRequestsDialog, setShowRequestsDialog] = useState(false);
  const [selectedClubForRequests, setSelectedClubForRequests] = useState<Club | null>(null);
  
  const { toast } = useToast();
  
  // Instantiate the Supabase client
  const supabase = createClient();

  // Memoize user club IDs for quick lookups
  const userClubIds = useMemo(() => new Set(userClubs.map(m => m.clubs?.id).filter(id => id !== null)), [userClubs]);

  // Filtered clubs based on search query
  const filteredClubs = useMemo(() => {
    if (!searchQuery) return allClubs;
    return allClubs.filter(club => 
      club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allClubs, searchQuery]);

  // Load user's credits
  const loadUserCredits = useCallback(async () => {
    if (!userId) return;
    
    setLoadingCredits(true);
    try {
      const credits = await getUserCredits(userId);
      setUserCredits(credits);
    } catch (err) {
      console.error("Error loading user credits:", err);
    } finally {
      setLoadingCredits(false);
    }
  }, [userId]);
  
  // Load user's join requests
  const loadUserJoinRequests = useCallback(async () => {
    if (!userId) return;
    
    setLoadingJoinRequests(true);
    try {
      const requests = await getUserJoinRequests(userId);
      if (requests) {
        setUserJoinRequests(requests);
        
        // Set pending request club IDs
        const pendingIds = new Set(
          requests
            .filter(req => req.status === 'pending')
            .map(req => req.club_id)
        );
        setPendingRequestClubIds(pendingIds);
      }
    } catch (err) {
      console.error("Error loading join requests:", err);
    } finally {
      setLoadingJoinRequests(false);
    }
  }, [userId]);
  
  // Check owned clubs
  const checkOwnedClubs = useCallback(async () => {
    if (!userId) return;

    try {
      const ownedIds = new Set<number>();

      // TODO: Fix ownership check. 'created_by' does not exist on the Club type in database.types.ts.
      // Determine the correct way to check if the current user owns this club.
      // The loop below is currently unused.
      // for (const _ of allClubs) {
      //   // if (club.created_by === userId) {
      //   //   ownedIds.add(club.id);
      //   // }
      // }

      setOwnedClubs(ownedIds);
    } catch (err) {
      console.error("Error checking owned clubs:", err);
    }
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [userId, allClubs]);

  // Fetch initial data
  const loadClubs = useCallback(async (showLoading = true) => {
    if (!userId) {
      setError("User ID not available.");
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);

    try {
      // Get all clubs with member count
      const { data: clubsData, error: clubsError } = await supabase
        .from('clubs')
        .select('*, members:club_members(count)') // Fetch member count
        .order('name', { ascending: true });

      if (clubsError) throw clubsError;
      
      // Map the result to include member_count
      const clubsWithCount = clubsData?.map(club => ({
        ...club,
        member_count: club.members[0]?.count || 0,
      })) || [];
      setAllClubs(clubsWithCount);

      // Try to get user memberships with user_id first
      const { data: userClubsData, error: userClubsError } = await supabase
        .from('club_members')
        .select('*, clubs(*, members:club_members(count))') // Fetch member count for user's clubs
        .eq('user_id', userId);

      // If we got data with user_id, use it
      if (!userClubsError && userClubsData && userClubsData.length > 0) {
        // Map the result to include member_count in the nested clubs object
        const mappedUserClubs = userClubsData.map(member => ({
          ...member,
          clubs: member.clubs ? {
            ...member.clubs,
            member_count: member.clubs.members[0]?.count || 0,
          } : null
        })) as ClubMemberWithClub[];
        setUserClubs(mappedUserClubs);
        setError(null);
      } else {
        // Otherwise, try with member_id
        const { data: memberClubsData, error: memberClubsError } = await supabase
          .from('club_members')
          .select('*, clubs(*, members:club_members(count))') // Fetch member count for member's clubs
          .eq('member_id', userId);

        if (memberClubsError) throw memberClubsError;
        
        // Map the result to include member_count in the nested clubs object
        const mappedMemberClubs = memberClubsData?.map(member => ({
            ...member,
            clubs: member.clubs ? {
              ...member.clubs,
              member_count: member.clubs.members[0]?.count || 0,
            } : null
          })) as ClubMemberWithClub[] || [];
        setUserClubs(mappedMemberClubs);
        setError(null);
      }
      
      // Load credits
      await loadUserCredits();
      
      // Load join requests
      await loadUserJoinRequests();

    } catch (err: unknown) {
      console.error("Error loading clubs:", err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load clubs: ${message}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [userId, supabase, loadUserCredits, loadUserJoinRequests]);

  // When clubs are loaded, check which ones the user owns
  useEffect(() => {
    checkOwnedClubs();
  }, [allClubs, userId, checkOwnedClubs]);

  // Initial load and real-time subscriptions
  useEffect(() => {
    if (userId) {
      loadClubs();
    } else {
        setLoading(false);
        setError("Waiting for user authentication...");
    }

    // Real-time subscriptions
    const clubsSubscription = supabase
      .channel("public:clubs")
      .on<Club>(
        "postgres_changes",
        { event: "*", schema: "public", table: "clubs" },
        (payload) => {
          console.log('Club change received:', payload);
          loadClubs(false);
        }
      )
      .subscribe();

    // Subscribe to both user_id and member_id changes
    const userMembershipSubscription = supabase
      .channel(`public:club_members:user_id=eq.${userId}`)
      .on<ClubMember>(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "club_members", 
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Membership change received (user_id):', payload);
          loadClubs(false);
        }
      )
      .subscribe();

    const memberMembershipSubscription = supabase
      .channel(`public:club_members:member_id=eq.${userId}`)
      .on<ClubMember>(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "club_members", 
          filter: `member_id=eq.${userId}`
        },
        (payload) => {
          console.log('Membership change received (member_id):', payload);
          loadClubs(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(clubsSubscription).catch(console.error);
      supabase.removeChannel(userMembershipSubscription).catch(console.error);
      supabase.removeChannel(memberMembershipSubscription).catch(console.error);
    };
  }, [userId, supabase, loadClubs]);

  const handleCreateClub = async () => {
    if (!userId || !newClubName.trim()) return;

    setCreatingClub(true);
    setError(null);

    try {
      // Check credits
      if (userCredits !== null && userCredits < 2000) {
        throw new Error(`Not enough credits. Club creation costs 2000 credits, you have ${userCredits}.`);
      }
      
      // Use the enhanced createClub function from lib/club.ts
      const newClub = await createClub(newClubName.trim(), newClubDescription.trim(), userId);
      
      if (!newClub) {
        throw new Error("Failed to create club. The name might already be taken or there was a server error.");
      }

      toast({ title: "Club Created!", description: `"${newClub.name}" has been created successfully.` });
      setShowCreateDialog(false);
      setNewClubName("");
      setNewClubDescription("");
      
      // Reload credits
      await loadUserCredits();
      
      // Data reloads via subscription

    } catch (err: unknown) {
      console.error("Error creating club:", err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to create club: ${message}`);
      toast({ title: "Error Creating Club", description: message, variant: "destructive" });
    } finally {
      setCreatingClub(false);
    }
  }

  const handleJoinRequest = async () => {
    if (!userId || !targetClubForJoinRequest) return;
    
    setJoiningClubIds(prev => new Set(prev).add(targetClubForJoinRequest.id));
    setError(null);
    
    try {
      if (userClubIds.has(targetClubForJoinRequest.id)) {
        throw new Error("You are already a member of this club.");
      }
      
      // Submit join request
      await requestToJoinClub(
        targetClubForJoinRequest.id, 
        userId, 
        newJoinRequestMessage.trim() || undefined
      );
      
      toast({ 
        title: "Join Request Sent", 
        description: `Your request to join "${targetClubForJoinRequest.name}" has been submitted to the club owner.` 
      });
      
      setShowJoinRequestDialog(false);
      setTargetClubForJoinRequest(null);
      setNewJoinRequestMessage("");
      
      // Update pending requests
      await loadUserJoinRequests();
      
    } catch (err: unknown) {
      console.error("Error sending join request:", err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to send join request: ${message}`);
      toast({ 
        title: "Error Sending Request", 
        description: message, 
        variant: "destructive" 
      });
    } finally {
      if (targetClubForJoinRequest) {
        setJoiningClubIds(prev => {
          const next = new Set(prev);
          next.delete(targetClubForJoinRequest.id);
          return next;
        });
      }
    }
  };

  const handleJoinClubAction = (club: Club) => {
    // Check if already pending
    if (pendingRequestClubIds.has(club.id)) {
      toast({
        title: "Already Requested",
        description: "You already have a pending request to join this club."
      });
      return;
    }
    
    // Show join request dialog
    setTargetClubForJoinRequest(club);
    setShowJoinRequestDialog(true);
  };

  const handleViewJoinRequests = async (club: Club) => {
    if (!userId) return;
    
    setSelectedClubForRequests(club);
    setLoadingJoinRequests(true);
    
    try {
      const requests = await getClubJoinRequests(club.id);
      if (requests) {
        setClubJoinRequests(requests);
      }
      setShowRequestsDialog(true);
    } catch (err) {
      console.error("Error loading join requests:", err);
      toast({
        title: "Error",
        description: "Failed to load join requests.",
        variant: "destructive"
      });
    } finally {
      setLoadingJoinRequests(false);
    }
  };

  const handleRespondToRequest = async (requestId: number, accept: boolean) => {
    if (!userId) return;
    
    setProcessingRequestIds(prev => new Set(prev).add(requestId));
    
    try {
      const success = await respondToJoinRequest(requestId.toString(), accept);
      
      if (success) {
        toast({
          title: accept ? "Request Accepted" : "Request Declined",
          description: accept 
            ? "The user has been added to your club." 
            : "The join request has been declined."
        });
        
        // Remove from the list
        setClubJoinRequests(prev => prev.filter(req => req.id !== requestId));
      } else {
        throw new Error("Failed to process request.");
      }
    } catch (err: unknown) {
      console.error("Error responding to request:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to process request.",
        variant: "destructive"
      });
    } finally {
      setProcessingRequestIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleLeaveClub = async (clubId: number, clubName: string) => {
    if (!userId) return;

    setLeavingClubIds(prev => new Set(prev).add(clubId));
    setError(null);

    try {
      // Try to leave using the function from lib/club.ts
      const left = await leaveClub(clubId, userId);
      
      if (!left) {
        throw new Error("Failed to leave club. Please try again.");
      }

      toast({ title: "Left Club", description: `You have successfully left "${clubName}".` });
      // Data reloads via subscription

    } catch (err: unknown) {
      console.error("Error leaving club:", err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to leave club: ${message}`);
      toast({ title: "Error Leaving Club", description: message, variant: "destructive" });
    } finally {
      setLeavingClubIds(prev => {
        const next = new Set(prev);
        next.delete(clubId);
        return next;
      });
    }
  }

  const renderClubCard = (club: ClubWithMemberCount) => {
    const isJoining = joiningClubIds.has(club.id as number);
    const isUserClub = userClubIds.has(club.id as number);
    const isOwned = ownedClubs.has(club.id as number);
    const hasPendingRequest = pendingRequestClubIds.has(club.id as number);
    
    const handleCardClick = () => {
      setSelectedClub(club.id as number);
      setShowClubDetailModal(true);
    }
    
    return (
      <motion.div
        key={club.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-card border-border rounded-lg p-6 hover:bg-accent/50 transition-colors relative"
      >
        <div className="flex items-start justify-between">
          <div className="cursor-pointer flex-1" onClick={handleCardClick}>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground text-lg">{club.name}</h3>
              {isOwned && (
                <span className="flex items-center text-yellow-400 text-xs">
                  <Crown className="h-3.5 w-3.5 mr-1" />
                  Owner
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-2 text-sm line-clamp-2 min-h-[2.5rem]">
              {club.description || "No description provided."}
            </p>
          </div>
        </div>
      
        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center">
            <Users className="h-4 w-4 text-blue-400 mr-1.5" />
            <span className="text-sm text-muted-foreground">
              {/* Display actual member count */}
              {club.member_count} {club.member_count === 1 ? 'member' : 'members'}
            </span>
          </div>
          
          {isUserClub ? (
            <Button 
              size="sm" 
              variant="outline" 
              className="text-foreground"
              onClick={handleCardClick}
            >
              View
            </Button>
          ) : isOwned ? (
            <Button 
              size="sm" 
              variant="outline" 
              className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-600/20"
              onClick={() => handleViewJoinRequests(club)}
            >
              Manage Requests
            </Button>
          ) : hasPendingRequest ? (
            <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 px-3 py-1">
              Request Pending
            </Badge>
          ) : (
            <Button 
              size="sm" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isJoining}
              onClick={(e) => {
                e.stopPropagation();
                handleJoinClubAction(club);
              }}
            >
              {isJoining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Request to Join'}
            </Button>
          )}
        </div>
      </motion.div>
    );
  };
  
  const renderMemberClubCard = (membership: ClubMemberWithClub) => {
    const club = membership.clubs;
    if (!club) return null;
    
    const isLeaving = leavingClubIds.has(club.id);
    const isOwned = ownedClubs.has(club.id);
    
    const handleCardClick = () => {
      setSelectedClub(club.id);
      setShowClubDetailModal(true);
    }
    
    return (
      <motion.div
        key={membership.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-card border-border rounded-lg p-6 hover:bg-accent/50 transition-colors"
      >
        <div className="cursor-pointer" onClick={handleCardClick}>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground text-lg">{club.name}</h3>
            {isOwned && (
              <span className="flex items-center text-yellow-400 text-xs">
                <Crown className="h-3.5 w-3.5 mr-1" />
                Owner
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-2 text-sm line-clamp-2">
            {club.description || "No description provided."}
          </p>
        </div>
        
        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center">
            <Users className="h-4 w-4 text-blue-400 mr-1.5" />
            <span className="text-sm text-muted-foreground">
              {/* Display actual member count */}
              {club.member_count} {club.member_count === 1 ? 'member' : 'members'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {isOwned && (
              <Button 
                size="sm" 
                variant="outline" 
                className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-600/20"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewJoinRequests(club);
                }}
              >
                Requests
              </Button>
            )}
            
            {!isOwned && (
              <Button 
                size="sm" 
                variant="outline" 
                className="border-destructive/30 text-destructive hover:text-destructive/90 hover:bg-destructive/10 hover:border-destructive/50"
                disabled={isLeaving}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLeaveClub(club.id, club.name);
                }}
              >
                {isLeaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>
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
                    Please log in to manage your clubs.
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex space-x-4">
          <h2 className="text-2xl font-bold text-foreground">Movie Clubs</h2>
          {userCredits !== null && (
            <div className="rounded-full bg-yellow-500/20 border border-yellow-500/30 px-4 py-1 text-yellow-600 dark:text-yellow-400 text-sm flex items-center">
              <span className="mr-1">Credits:</span>
              {loadingCredits ? (
                <Skeleton className="w-12 h-5 bg-yellow-500/10" />
              ) : (
                <span className="font-semibold">{userCredits.toLocaleString()}</span>
              )}
            </div>
          )}
        </div>
        <Button 
          onClick={() => setShowCreateDialog(true)} 
          size="sm" 
          className="bg-gradient-to-r from-primary to-purple-600 text-primary-foreground hover:from-primary/90 hover:to-purple-700 px-4 py-2 h-auto"
        >
          <Plus className="h-4 w-4 mr-2" /> Create Club
        </Button>
      </div>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 p-1.5 mb-4">
          <TabsTrigger 
            value="my-clubs" 
            className="data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground py-2 px-4"
          >
            My Clubs
          </TabsTrigger>
          <TabsTrigger 
            value="browse" 
            className="data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground py-2 px-4"
          >
            Browse Clubs
          </TabsTrigger>
          <TabsTrigger 
            value="requests" 
            className="data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground py-2 px-4"
          >
            My Requests
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="my-clubs">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="space-y-2 bg-white/10 dark:bg-gray-800/30 border border-white/20 dark:border-gray-700/40 rounded-lg p-4">
                  <Skeleton className="h-6 w-1/2 bg-white/20" />
                  <Skeleton className="h-4 w-full bg-white/10" />
                  <Skeleton className="h-4 w-3/4 bg-white/10" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-4 w-1/4 bg-white/10" />
                    <Skeleton className="h-8 w-16 bg-white/20" />
                  </div>
                </div>
              ))}
            </div>
          ) : userClubs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {userClubs.map(membership => renderMemberClubCard(membership))}
            </div>
          ) : (
            <div className="text-center py-16 bg-muted/30 rounded-lg border border-border">
              <UserPlus className="h-14 w-14 mx-auto text-muted-foreground" />
              <h3 className="mt-6 text-lg font-medium text-foreground">You haven&apos;t joined any clubs yet</h3>
              <p className="mt-3 text-muted-foreground">Join existing clubs or create your own to get started.</p>
              <Button 
                onClick={() => setActiveTab("browse")} 
                variant="outline" 
                className="mt-6 border-border hover:border-input text-foreground bg-transparent hover:bg-accent"
              >
                Browse Clubs
              </Button>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="browse">
          <div className="flex mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 dark:text-gray-500 h-4 w-4" />
              <Input
                placeholder="Search clubs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/10 dark:bg-gray-800/30 border-white/20 dark:border-gray-700/40 text-white"
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white/80"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="space-y-2 bg-white/10 dark:bg-gray-800/30 border border-white/20 dark:border-gray-700/40 rounded-lg p-4">
                  <Skeleton className="h-6 w-1/2 bg-white/20" />
                  <Skeleton className="h-4 w-full bg-white/10" />
                  <Skeleton className="h-4 w-3/4 bg-white/10" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-4 w-1/4 bg-white/10" />
                    <Skeleton className="h-8 w-16 bg-white/20" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredClubs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClubs.map(club => renderClubCard(club))}
            </div>
          ) : (
            <div className="text-center py-16 bg-muted/30 rounded-lg border border-border">
              <Search className="h-14 w-14 mx-auto text-muted-foreground" />
              <h3 className="mt-6 text-lg font-medium text-foreground">No clubs found</h3>
              <p className="mt-3 text-muted-foreground">
                {searchQuery ? "Try a different search term." : "No clubs are available. Create your own club to get started."}
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="requests">
          {loading || loadingJoinRequests ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="flex justify-between bg-white/10 dark:bg-gray-800/30 border border-white/20 dark:border-gray-700/40 rounded-lg p-4">
                  <div className="flex space-x-3">
                    <Skeleton className="h-10 w-10 rounded-full bg-white/20" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40 bg-white/20" />
                      <Skeleton className="h-4 w-24 bg-white/10" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-24 bg-white/20" />
                </div>
              ))}
            </div>
          ) : userJoinRequests.length > 0 ? (
            <div className="space-y-4">
              {userJoinRequests.map(request => (
                <Card key={request.id} className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-foreground">{request.clubs?.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Status: <Badge variant={
                            request.status === 'pending' ? 'outline' : 
                            request.status === 'accepted' ? 'secondary' : 'destructive'
                          } className={`ml-1 ${request.status === 'accepted' ? 'bg-green-700 hover:bg-green-700 text-white' : ''}`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-2">
                          Requested on {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      {request.status === 'accepted' && (
                        <Button
                          size="sm" 
                          variant="outline"
                          className="border-green-500/30 text-green-400"
                          onClick={() => {
                            setSelectedClub(request.club_id);
                            setShowClubDetailModal(true);
                          }}
                        >
                          View Club
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-muted/30 rounded-lg border border-border">
              <UserPlus className="h-14 w-14 mx-auto text-muted-foreground" />
              <h3 className="mt-6 text-lg font-medium text-foreground">No club requests</h3>
              <p className="mt-3 text-muted-foreground">You haven&apos;t requested to join any clubs yet.</p>
              <Button 
                onClick={() => setActiveTab("browse")} 
                variant="outline" 
                className="mt-6 border-border hover:border-input hover:bg-accent"
              >
                Browse Clubs
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Create Club Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-background border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Club</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create your own movie club. This will cost 2000 credits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <Label htmlFor="club-name" className="text-foreground">Club Name</Label>
              <Input
                id="club-name"
                value={newClubName}
                onChange={(e) => setNewClubName(e.target.value)}
                placeholder="Enter club name"
                className="bg-background border-input mt-2"
              />
            </div>
            <div>
              <Label htmlFor="club-description" className="text-foreground">Description (Optional)</Label>
              <Textarea
                id="club-description"
                value={newClubDescription}
                onChange={(e) => setNewClubDescription(e.target.value)}
                placeholder="Describe your club"
                className="bg-background border-input mt-2 h-24 resize-none"
              />
            </div>
            
            <div className="p-4 rounded-md bg-yellow-900/20 border border-yellow-800/50">
              <p className="text-yellow-300 text-sm font-medium flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                This will cost <span className="font-bold mx-1">2000</span> credits
              </p>
              <p className="text-yellow-400/70 text-xs mt-1">
                Current balance: {userCredits !== null ? userCredits.toLocaleString() : '...'}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setShowCreateDialog(false)}
              className="text-muted-foreground hover:text-foreground"
              disabled={creatingClub}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateClub} 
              disabled={!newClubName.trim() || creatingClub || (userCredits !== null && userCredits < 2000)}
              className={userCredits !== null && userCredits < 2000 
                ? "bg-muted text-muted-foreground cursor-not-allowed" 
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }
            >
              {creatingClub ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {creatingClub ? 'Creating...' : 'Create Club'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Join Request Dialog */}
      <Dialog open={showJoinRequestDialog} onOpenChange={setShowJoinRequestDialog}>
        <DialogContent className="bg-background border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Request to Join Club</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {targetClubForJoinRequest ? `Send a request to join "${targetClubForJoinRequest.name}". The club owner will review your request.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <Label htmlFor="request-message" className="text-foreground">Message (Optional)</Label>
              <Textarea
                id="request-message"
                value={newJoinRequestMessage}
                onChange={(e) => setNewJoinRequestMessage(e.target.value)}
                placeholder="Why do you want to join this club?"
                className="bg-background border-input mt-2 h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="ghost" 
              onClick={() => {
                setShowJoinRequestDialog(false);
                setTargetClubForJoinRequest(null);
                setNewJoinRequestMessage("");
              }}
              className="text-muted-foreground hover:text-foreground"
              disabled={joiningClubIds.has(targetClubForJoinRequest?.id || -1)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleJoinRequest} 
              disabled={joiningClubIds.has(targetClubForJoinRequest?.id || -1)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {joiningClubIds.has(targetClubForJoinRequest?.id || -1) 
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> 
                : null
              }
              {joiningClubIds.has(targetClubForJoinRequest?.id || -1) 
                ? 'Sending...' 
                : 'Send Request'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* View Join Requests Dialog */}
      <Dialog open={showRequestsDialog} onOpenChange={setShowRequestsDialog}>
        <DialogContent className="bg-background border-border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle>Club Join Requests</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedClubForRequests 
                ? `Manage join requests for "${selectedClubForRequests.name}"` 
                : 'Review and respond to join requests'
              }
            </DialogDescription>
          </DialogHeader>
          
          {loadingJoinRequests ? (
            <div className="space-y-4 py-2">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="flex justify-between bg-card border-border rounded-lg p-5">
                  <div className="flex space-x-3">
                    <Skeleton className="h-10 w-10 rounded-full bg-muted" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40 bg-muted" />
                      <Skeleton className="h-4 w-24 bg-muted/70" />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Skeleton className="h-9 w-20 bg-muted" />
                    <Skeleton className="h-9 w-20 bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : clubJoinRequests.length === 0 ? (
            <div className="text-center py-10 bg-muted/30 rounded-lg border border-border my-4">
              <UserPlus className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No pending join requests</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 py-2">
              {clubJoinRequests
                .filter(request => request.status === 'pending')
                .map(request => (
                <Card key={request.id} className="bg-card border-border">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={request.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {request.username?.substring(0, 2).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-foreground">{request.username}</h4>
                          <p className="text-xs text-muted-foreground">
                            Requested {new Date(request.created_at).toLocaleDateString()}
                          </p>
                          {request.message && (
                            <p className="text-sm text-foreground/80 mt-2 max-w-md">
                              &quot;{request.message}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex space-x-3">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="bg-destructive/90 hover:bg-destructive text-destructive-foreground"
                          onClick={() => handleRespondToRequest(request.id, false)}
                          disabled={processingRequestIds.has(request.id)}
                        >
                          {processingRequestIds.has(request.id) 
                            ? <Loader2 className="h-4 w-4 animate-spin" /> 
                            : 'Decline'
                          }
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-700 hover:bg-green-600 text-white"
                          onClick={() => handleRespondToRequest(request.id, true)}
                          disabled={processingRequestIds.has(request.id)}
                        >
                          {processingRequestIds.has(request.id) 
                            ? <Loader2 className="h-4 w-4 animate-spin" /> 
                            : 'Accept'
                          }
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          <DialogFooter className="pt-2">
            <Button 
              onClick={() => setShowRequestsDialog(false)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Club Detail Modal */}
      {selectedClub && (
        <ClubDetailModal
          clubId={selectedClub}
          open={showClubDetailModal}
          onClose={() => setShowClubDetailModal(false)}
        />
      )}
    </div>
  );
}

