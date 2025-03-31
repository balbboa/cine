"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { 
  Trophy, 
  Medal, 
  Users, 
  Search, 
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { Club } from "@/lib/db"
import { createClient } from "@/lib/supabase/client"

interface LeaderboardProps {
  isLoggedIn: boolean
  currentUserId?: string | null
}

// New type for ranked player data
type LeaderboardPlayer = {
  id: string
  username: string
  avatar_url: string | null
  level: number
  xp: number
  wins: number
  losses: number
  rank?: number
  club?: string
};

// Updated type for ranked club data
type RankedClub = Omit<Club, 'avatar_url'> & { // Omit avatar_url if it doesn't exist
  member_count: number;
  rank: number;
  // avatar_url: string | null; // Removed as it cannot be fetched
};

export default function Leaderboard({ isLoggedIn, currentUserId }: LeaderboardProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [loadingGlobal, setLoadingGlobal] = useState(true)
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [loadingClubs, setLoadingClubs] = useState(true) // For the club ranking list
  const [globalPlayers, setGlobalPlayers] = useState<LeaderboardPlayer[]>([])
  const [friendPlayers, setFriendPlayers] = useState<LeaderboardPlayer[]>([])
  const [rankedClubs, setRankedClubs] = useState<RankedClub[]>([]) // New state for club rankings
  
  const supabaseClient = createClient();

  // Fetch Global Leaderboard
  const loadGlobalLeaderboard = useCallback(async () => {
    setLoadingGlobal(true);
    try {
      const { data: globalData, error: globalError } = await supabaseClient
        .from('users')
        .select('id, username, avatar_url, level, xp, wins, losses')
        .order('xp', { ascending: false })
        .limit(100);
      if (globalError) throw globalError;
      setGlobalPlayers(
        globalData.map((player, index) => ({ ...player, rank: index + 1 })) as LeaderboardPlayer[]
      );
    } catch (error) {
      console.error("Error loading global leaderboard data:", error);
      setGlobalPlayers([]); // Clear on error
    } finally {
      setLoadingGlobal(false);
    }
  }, [supabaseClient]);

  // Fetch Friends Leaderboard (only if logged in)
  const loadFriendsLeaderboard = useCallback(async () => {
    if (!isLoggedIn || !currentUserId) {
        setFriendPlayers([]);
        return;
    }
    setLoadingFriends(true);
    try {
        const { data: friendships, error: friendError } = await supabaseClient
            .from('friendships')
            .select('user_id, friend_id')
            .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);
        if (friendError) throw friendError;
        
        const friendIds = friendships
            .map(f => f.user_id === currentUserId ? f.friend_id : f.user_id)
            .filter(id => id !== currentUserId);

        if (friendIds.length > 0) {
            const { data: friendsData, error: friendsProfileError } = await supabaseClient
              .from('users')
              .select('id, username, avatar_url, level, xp, wins, losses')
              .in('id', [...friendIds, currentUserId])
              .order('xp', { ascending: false });
            if (friendsProfileError) throw friendsProfileError;
            setFriendPlayers(
              friendsData.map((player, index) => ({ ...player, rank: index + 1 })) as LeaderboardPlayer[]
            );
        } else {
            const { data: selfData } = await supabaseClient.from('users').select('id, username, avatar_url, level, xp, wins, losses').eq('id', currentUserId).single();
            setFriendPlayers(selfData ? [{ ...selfData, rank: 1 }] as LeaderboardPlayer[] : []);
        }
    } catch (error) {
        console.error("Error loading friends leaderboard data:", error);
        setFriendPlayers([]); // Clear on error
    } finally {
        setLoadingFriends(false);
    }
  }, [isLoggedIn, currentUserId, supabaseClient]);

  // Fetch Club Rankings
  const loadClubRankings = useCallback(async () => {
    setLoadingClubs(true);
    try {
        const { data: clubsData, error: clubsError } = await supabaseClient
            .from('clubs')
            .select('id, name, description') // Removed avatar_url
            .limit(50);
        
        if (clubsError) throw clubsError;

        if (clubsData) {
            // Get member counts in a separate query if needed
            const rankedClubsData = await Promise.all(
                clubsData.map(async (club, index) => {
                    // Get member count for each club
                    const { count } = await supabaseClient
                        .from('club_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('club_id', club.id);
                    
                    // Return properly formatted club with rank and member count
                    return {
                        ...club, // Spread should be safe now
                        member_count: count ?? 0,
                        rank: index + 1
                    } as RankedClub;
                })
            );
            
            // Sort by member count
            rankedClubsData.sort((a, b) => b.member_count - a.member_count);
            
            // Update state with properly ranked clubs
            setRankedClubs(rankedClubsData);
        } else {
            setRankedClubs([]);
        }
    } catch (error) {
        console.error("Error loading club rankings:", error);
        setRankedClubs([]); // Clear on error
    } finally {
        setLoadingClubs(false);
    }
  }, [supabaseClient]);

  useEffect(() => {
    loadGlobalLeaderboard();
    loadFriendsLeaderboard();
    loadClubRankings();
  }, [loadGlobalLeaderboard, loadFriendsLeaderboard, loadClubRankings]); // Depend on the useCallback functions

  // calculateWinRate is still used by renderPlayerRow
  const calculateWinRate = (wins: number, losses: number) => {
    const totalGames = wins + losses;
    if (totalGames === 0) return "0%";
    return `${Math.round((wins / totalGames) * 100)}%`;
  };
  
  // renderPlayerRow is used for Global and Friends tabs
  const renderPlayerRow = (player: LeaderboardPlayer, _idx: number) => {
    const rank = player.rank ?? 0;
    const winRate = calculateWinRate(player.wins ?? 0, player.losses ?? 0);
    return (
      <motion.tr
        key={player.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: _idx * 0.05 }}
        className={`border-b border-border ${player.id === currentUserId ? 'bg-primary/10 dark:bg-blue-500/10' : 'hover:bg-accent hover:dark:bg-gray-800/20'}`}
      >
        <td className="p-3 md:p-4 text-center font-medium">
          {rank <= 3 ? (
            <Medal
              className={`h-5 w-5 inline-block ${rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-400' : 'text-yellow-600'}`}
            />
          ) : (
            <span className="text-sm text-muted-foreground">{rank}</span>
          )}
        </td>
        <td className="p-3 md:p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 mr-2">
              <AvatarImage
                src={player.avatar_url ?? undefined}
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 text-white text-xs">
                {player.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold text-foreground">{player.username}</span>
            {player.id === currentUserId && (
              <Badge className="ml-2 bg-primary text-primary-foreground text-xs">You</Badge>
            )}
          </div>
        </td>
        <td className="p-3 md:p-4 text-right">
          <span className="font-medium text-foreground">{player.xp ?? 0}</span>
          <span className="text-xs text-muted-foreground ml-1">XP</span>
        </td>
        <td className="p-3 md:p-4 text-right hidden sm:table-cell">
          <span className="font-medium text-green-600 dark:text-green-500">{player.wins ?? 0}</span>
          <span className="text-xs text-muted-foreground ml-1">W</span> /
          <span className="font-medium text-red-600 dark:text-red-500 ml-1">{player.losses ?? 0}</span>
          <span className="text-xs text-muted-foreground ml-1">L</span>
        </td>
        <td className="p-3 md:p-4 text-right hidden md:table-cell">
            <span className="text-sm font-medium text-foreground/80">{winRate}</span>
        </td>
      </motion.tr>
    )
  }

  const renderLeaderboard = (players: LeaderboardPlayer[], title: string, isLoading: boolean) => { 
    if (isLoading) {
      return <LeaderboardSkeleton />
    }
    
    if (players.length === 0) {
      return (
        <div className="text-center py-10 text-muted-foreground">
          <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
          {title === "Friends" && !isLoggedIn ? "Log in to see friends." : 
           "No players found in this category."}
        </div>
      )
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-md">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 md:p-4 text-center w-16"><Trophy className="h-4 w-4 inline-block text-muted-foreground" /></th>
              <th className="p-3 md:p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Player</th>
              <th className="p-3 md:p-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">XP</th>
              <th className="p-3 md:p-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">W/L</th>
              <th className="p-3 md:p-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Win Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {players.map((player, index) => renderPlayerRow(player, index))}
          </tbody>
        </table>
      </div>
    )
  }

  // Renders the club ranking table
  const renderClubRankingTable = (clubs: RankedClub[], isLoading: boolean) => {
    if (isLoading) {
      return <LeaderboardSkeleton />; // Reuse or create a specific skeleton
    }

    if (clubs.length === 0) {
      return (
        <div className="text-center py-10 text-muted-foreground">
          <Medal className="mx-auto h-12 w-12 mb-4 opacity-50" />
          No club rankings available at the moment.
        </div>
      )
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-md">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 md:p-4 text-center w-16"><Trophy className="h-4 w-4 inline-block text-muted-foreground" /></th>
              <th className="p-3 md:p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Club</th>
              <th className="p-3 md:p-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Members</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clubs.map((club, index) => (
              <motion.tr
                key={club.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className='hover:bg-accent' 
              >
                <td className="p-3 md:p-4 text-center font-medium">
                  {club.rank <= 3 ? (
                    <Medal
                      className={`h-5 w-5 inline-block ${club.rank === 1 ? 'text-yellow-400' : club.rank === 2 ? 'text-gray-400' : 'text-yellow-600'}`}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">{club.rank}</span>
                  )}
                </td>
                <td className="p-3 md:p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 mr-2">
                      {/* <AvatarImage
                        src={club.avatar_url ?? undefined} // Removed avatar_url usage
                      /> */}
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 text-white text-xs">
                        {club.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-foreground">{club.name}</span>
                  </div>
                </td>
                <td className="p-3 md:p-4 text-right">
                  <span className="font-medium text-foreground">{club.member_count ?? 0}</span>
                  <Users className="h-4 w-4 inline-block ml-1 text-muted-foreground"/>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6"> 
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold text-foreground">Leaderboards</h2>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 bg-background border-input text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <Tabs defaultValue="global">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger
              value="global"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
            >
              <Trophy className="h-4 w-4 mr-1" />
              Global
            </TabsTrigger>
            <TabsTrigger
              value="friends"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
              disabled={!isLoggedIn}
            >
              <Users className="h-4 w-4 mr-1" />
              Friends
            </TabsTrigger>
            <TabsTrigger
              value="clubs"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
              disabled={loadingClubs && rankedClubs.length === 0}
            >
              <Medal className="h-4 w-4 mr-1" />
              Clubs Ranking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="mt-4">
            {renderLeaderboard(globalPlayers, "Global", loadingGlobal)}
          </TabsContent>

          <TabsContent value="friends" className="mt-4">
            {isLoggedIn ? (
              renderLeaderboard(friendPlayers, "Friends", loadingFriends)
            ) : (
              <div className="backdrop-blur-md bg-card/80 rounded-xl border border-border shadow-lg p-8 text-center">
                 <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                 <h3 className="text-xl font-semibold text-foreground mb-2">
                   Sign In to View Friend Leaderboards
                 </h3>
                 <p className="text-muted-foreground mb-4">
                   Connect with friends and track your progress against them!
                 </p>
                 <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white">
                   Sign In
                 </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="clubs" className="mt-4">
             {renderClubRankingTable(rankedClubs, loadingClubs)}
          </TabsContent>
        </Tabs>
      </div>

      {/* Sidebar removed */}
      {/* ClubDetailModal removed */}
    </div>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="backdrop-blur-md bg-card/80 rounded-xl border border-border shadow-lg overflow-hidden">
      <div className="bg-muted p-4 grid grid-cols-12 gap-2">
        <Skeleton className="col-span-1 h-6 bg-muted-foreground/20" />
        <Skeleton className="col-span-5 h-6 bg-muted-foreground/20" />
        <Skeleton className="col-span-2 h-6 bg-muted-foreground/20" />
        <Skeleton className="col-span-2 h-6 bg-muted-foreground/20" />
        <Skeleton className="col-span-2 h-6 bg-muted-foreground/20" />
      </div>

      <div className="divide-y divide-border">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="p-4 grid grid-cols-12 gap-2 items-center">
              <Skeleton className="col-span-1 h-6 bg-muted-foreground/20" />
              <div className="col-span-5 flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full bg-muted-foreground/20" />
                <Skeleton className="h-6 w-32 bg-muted-foreground/20" />
              </div>
              <Skeleton className="col-span-2 h-6 bg-muted-foreground/20" />
              <Skeleton className="col-span-2 h-6 bg-muted-foreground/20" />
              <Skeleton className="col-span-2 h-6 bg-muted-foreground/20" />
            </div>
          ))}
      </div>
    </div>
  )
}

