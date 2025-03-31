"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Film, Trophy, Users, Play, X, Loader2, WifiOff, ArrowLeft, Medal, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GameModes from "@/components/game-modes"
import PlayerProfile from "@/components/player-profile"
import Leaderboard from "@/components/leaderboard"
import FriendsList from "@/components/friends-list"
import ClubManagement from "@/components/club-management"
import ClubDetailModal from "@/components/club-detail-modal"
import LoginPrompt from "@/components/login-prompt"
import { useAuth } from "@/lib/auth"
import { useTheme } from "@/lib/theme"
import { Skeleton } from "@/components/ui/skeleton"
import { Database, User, Badge } from "@/lib/db"

import { UserMenu } from '@/components/user-menu'
import { createClient } from "@/lib/supabase/client"
import { useRouter } from 'next/navigation'
import { 
  joinMatchmaking, 
  leaveMatchmaking, 
  getPoolSize,
  MatchmakingStatus, 
  MatchType,
  MatchmakingUser 
} from "@/lib/matchmaking-supabase"
import { ThemeToggle } from "@/components/ui/theme-toggle"

type UserBadgeWithBadge = Database['public']['Tables']['user_badges']['Row'] & {
  badges: Badge | null
};

export default function GameHub() {
  const { user, isLoading: authLoading, isGuest, autoCreateGuestUser, clearGuestSession } = useAuth()
  const { /* theme, toggleTheme */ } = useTheme()
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState("play")
  const [currentGameMode, setCurrentGameMode] = useState<MatchType | null>(null)
  const [matchmakingStatus, setMatchmakingStatus] = useState<MatchmakingStatus>(MatchmakingStatus.IDLE)
  const [matchmakingUserId, setMatchmakingUserId] = useState<string | null>(null)
  const [poolSize, setPoolSize] = useState(0)
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);

  const [userBadges, setUserBadges] = useState<UserBadgeWithBadge[]>([])
  const [loadingUserData, setLoadingUserData] = useState(false)

  const supabase = createClient();
  
  // Add states for club detail modal
  const [selectedClubId] = useState<number | null>(null);
  const [showClubDetail, setShowClubDetail] = useState(false);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);

  // Effect to update document title based on active tab
  useEffect(() => {
    const baseTitle = "Cine-Tac-Toe";
    switch (activeTab) {
      case 'play':
        document.title = `${baseTitle} - Play`;
        break;
      case 'profile':
        document.title = `${baseTitle} - Profile`;
        break;
      case 'leaderboard':
        document.title = `${baseTitle} - Leaderboard`;
        break;
      case 'friends':
        document.title = `${baseTitle} - Friends`;
        break;
      case 'clubs':
        document.title = `${baseTitle} - Clubs`;
        break;
      // Add cases for other potential tabs like 'store' if needed
      default:
        document.title = baseTitle;
    }
  }, [activeTab]);

  useEffect(() => {
    const loadAdditionalUserData = async () => {
      if (user && !isGuest) {
        setLoadingUserData(true);
        setUserBadges([]);
        try {
          const { data: badgesData, error: badgesError } = await supabase
            .from('user_badges')
            .select('*, badges (*)')
            .eq('user_id', user.id);

          if (badgesError) console.error("Error loading badges:", badgesError);
          setUserBadges((badgesData as UserBadgeWithBadge[]) || []);

        } catch (error) {
          console.error("Error loading additional user data (badges):", error);
        } finally {
          setLoadingUserData(false);
        }
      } else {
        setUserBadges([]);
        setLoadingUserData(false);
      }
    }

    loadAdditionalUserData();
  }, [user, isGuest, supabase]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (matchmakingStatus === MatchmakingStatus.SEARCHING && currentGameMode) {
      const fetchPoolSize = async () => {
        try {
            const size = await getPoolSize(currentGameMode);
            setPoolSize(size);
        } catch (err) {
            console.error("Error fetching pool size:", err);
            setPoolSize(0);
        }
      };
      fetchPoolSize();
      intervalId = setInterval(() => {
        fetchPoolSize();
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [matchmakingStatus, currentGameMode]);

  const leaveQueueAndReset = useCallback(() => {
    try {
      leaveMatchmaking();
    } catch (err) {
      console.error("Error leaving matchmaking:", err);
    }
    setMatchmakingStatus(MatchmakingStatus.IDLE);
    setMatchmakingUserId(null);
    setCurrentGameMode(null);
    setMatchmakingError(null);
    setPoolSize(0);

    if (isGuest) {
      console.log("[GameHub] Guest cancelled matchmaking, clearing guest session.");
      clearGuestSession();
    }
  }, [isGuest, clearGuestSession]);
  
  // Add array of matchmaking phrases for immersive experience
  const quickMatchPhrases = useMemo(() => [
    "Finding a worthy opponent...",
    "Summoning movie trivia masters...",
    "Scanning the cinematic universe...",
    "Reeling in your challenger...",
    "Rolling the credits on your wait time...",
    "Searching for a box office rival...",
    "Preparing the popcorn...",
    "Dimming the lights...",
    "Casting your opponent...",
    "Checking seat availability..."
  ], []);

  const rankedMatchPhrases = useMemo(() => [
    "Locating worthy competitors...",
    "Calculating ELO rankings...",
    "Searching for cinephile challengers...",
    "Finding a formidable adversary...",
    "Matching director's credentials...",
    "Scouting the festival circuit...",
    "Seeking award-winning opponents...",
    "Analyzing box office stats...",
    "Evaluating movie knowledge...",
    "Preparing your red carpet challenge..."
  ], []);

  // Update phrase every 3 seconds when searching
  useEffect(() => {
    if (matchmakingStatus === MatchmakingStatus.SEARCHING) {
      const phrases = currentGameMode === MatchType.RANKED 
        ? rankedMatchPhrases 
        : quickMatchPhrases;
      
      const interval = setInterval(() => {
        setCurrentPhraseIndex(prev => (prev + 1) % phrases.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [matchmakingStatus, currentGameMode, rankedMatchPhrases, quickMatchPhrases]);

  const renderMatchmakingState = () => {
    // Get appropriate phrase set based on game mode
    const phrases = currentGameMode === MatchType.RANKED 
      ? rankedMatchPhrases 
      : quickMatchPhrases;

    if (matchmakingStatus === MatchmakingStatus.SEARCHING) {
      return (
        <motion.div 
          key="searching"
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -20 }}
          className="text-center p-8 sm:p-12 md:p-16 flex flex-col items-center justify-center bg-gradient-to-b from-primary/10 to-primary-foreground/10 dark:from-gray-800/70 dark:to-gray-900/90 border border-primary/20 dark:border-blue-700/30 rounded-xl mt-8 shadow-xl backdrop-blur-md relative overflow-hidden transition-colors duration-200"
        >
          {/* Background particle effects */}
          <div className="absolute inset-0 z-0">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-primary dark:bg-blue-500"
                style={{
                  width: Math.random() * 6 + 2,
                  height: Math.random() * 6 + 2,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`
                }}
                animate={{
                  y: [0, -100],
                  x: [0, Math.random() * 40 - 20],
                  opacity: [0, 0.8, 0]
                }}
                transition={{
                  duration: Math.random() * 5 + 5,
                  repeat: Infinity,
                  delay: Math.random() * 5,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-10">
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/20 dark:bg-blue-500/20"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 0.2, 0.3]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/10 dark:bg-blue-400/20"
                animate={{
                  scale: [1.2, 1.7, 1.2],
                  opacity: [0.3, 0.1, 0.3]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.2
                }}
              />
              <motion.div className="relative z-10">
                <Loader2 className="h-16 w-16 sm:h-20 sm:w-20 animate-spin text-primary dark:text-blue-400" />
              </motion.div>
            </div>
            
            <motion.h2 
              className="text-xl sm:text-2xl font-bold text-foreground dark:text-white mb-4"
            >
              {currentGameMode === MatchType.RANKED ? 'Ranked' : 'Quick'} Match
            </motion.h2>
            
            <div className="h-14 overflow-hidden mb-6">
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentPhraseIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="text-primary/80 dark:text-blue-200 text-lg"
                >
                  {phrases[currentPhraseIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
            
            <motion.div 
              className="flex items-center justify-center gap-3 mb-8 bg-muted/80 dark:bg-gray-800/80 py-3 px-6 rounded-full"
              animate={{ 
                scale: [1, 1.03, 1],
                boxShadow: [
                  "0 0 0 0 rgba(59, 130, 246, 0)",
                  "0 0 0 4px rgba(59, 130, 246, 0.2)",
                  "0 0 0 0 rgba(59, 130, 246, 0)"
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Timer className="h-4 w-4 text-primary/70 dark:text-blue-300" />
              <p className="text-foreground dark:text-white">Players in queue: <span className="font-semibold text-primary dark:text-blue-300">{poolSize}</span></p>
            </motion.div>
            
            {matchmakingUserId && (
              <motion.div
                className="mb-6 text-xs text-muted-foreground bg-muted/50 dark:bg-gray-800/50 px-3 py-1 rounded-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                Session ID: {matchmakingUserId.substring(0, 8)}...
              </motion.div>
            )}
            
            <Button 
              variant="destructive" 
              onClick={leaveQueueAndReset}
              className="rounded-full px-8 py-6 text-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Cancel matchmaking search"
            >
              <X className="h-5 w-5 mr-2" /> Cancel Search
            </Button>
          </div>
        </motion.div>
      );
    } else {
      return (
        <motion.div 
          key="error"
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0, scale: 0.9 }}
          className="text-center p-8 sm:p-12 md:p-16 flex flex-col items-center justify-center bg-gradient-to-b from-destructive/20 to-destructive/30 dark:from-red-900/40 dark:to-red-950/60 border border-destructive/30 dark:border-red-700/50 rounded-xl mt-8 shadow-lg backdrop-blur-sm relative overflow-hidden transition-colors duration-200"
        >
          {/* Animated background elements */}
          <div className="absolute inset-0 z-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute bg-destructive/10 dark:bg-red-500/10"
                style={{
                  width: Math.random() * 100 + 50,
                  height: Math.random() * 100 + 50,
                  borderRadius: '40%',
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`
                }}
                animate={{
                  x: [0, Math.random() * 40 - 20],
                  y: [0, Math.random() * 40 - 20],
                  opacity: [0.1, 0.2, 0.1]
                }}
                transition={{
                  duration: Math.random() * 10 + 10,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
          
          <div className="relative z-10">
            <motion.div 
              className="mb-8 p-5 rounded-full bg-destructive/20 dark:bg-red-500/20"
              animate={{ 
                boxShadow: [
                  "0 0 0 0 rgba(239, 68, 68, 0)",
                  "0 0 0 10px rgba(239, 68, 68, 0.1)",
                  "0 0 0 0 rgba(239, 68, 68, 0)"
                ]
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <WifiOff className="h-14 w-14 sm:h-20 sm:w-20 text-destructive/90 dark:text-red-400" />
            </motion.div>
            
            <motion.h2 
              className="text-xl sm:text-2xl font-bold text-destructive-foreground dark:text-red-200 mb-6"
              animate={{ opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              Matchmaking Error
            </motion.h2>
            
            <motion.div
              className="max-w-md mx-auto mb-10 p-6 bg-muted/40 dark:bg-red-950/40 rounded-lg border border-destructive/20 dark:border-red-800/30"
              initial={{ y: 10 }}
              animate={{ y: 0 }}
            >
              <p className="text-foreground dark:text-red-100">{matchmakingError || "Could not find a match or an error occurred. Please try again."}</p>
            </motion.div>
            
            <Button 
              variant="outline" 
              onClick={leaveQueueAndReset} 
              className="bg-transparent hover:bg-background/10 dark:hover:bg-white/10 border-destructive/50 dark:border-red-500/50 hover:border-destructive dark:hover:border-red-400 rounded-full px-8 py-3 text-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Return to game modes"
            >
              <ArrowLeft className="h-5 w-5 mr-2"/> Return to Modes
            </Button>
          </div>
        </motion.div>
      );
    }
  };

  const handleStartMatchmaking = async (matchType: MatchType) => {
    console.log(`[GameHub] handleStartMatchmaking called with type: ${matchType}`);
    setMatchmakingError(null);
    setMatchmakingStatus(MatchmakingStatus.SEARCHING);
    
    let matchmakingUser = user;

    // If no logged-in user and not already a guest, create a guest user first
    if (!matchmakingUser && !isGuest) {
      console.log('[GameHub] No user, creating guest for Quick Match...');
      matchmakingUser = autoCreateGuestUser(); // Call guest creation
      if (!matchmakingUser) {
        console.error('[GameHub] Failed to create guest user for matchmaking.');
        setMatchmakingError('Could not start game as guest. Please try logging in.');
        setMatchmakingStatus(MatchmakingStatus.IDLE);
        return; // Stop if guest creation failed
      }
      console.log('[GameHub] Guest user created:', matchmakingUser.id);
    }

    // Ensure we have a user (guest or logged-in) before proceeding
    if (!matchmakingUser) {
      console.error('[GameHub] Cannot start matchmaking without a user (guest or logged-in).');
      setMatchmakingError('User session not found. Please log in or refresh.');
      setMatchmakingStatus(MatchmakingStatus.IDLE);
      return;
    }
    
    console.log(`[GameHub] Starting matchmaking for user: ${matchmakingUser.id}, type: ${matchType}`);

    try {
      // Use the new Supabase-based matchmaking service
      const mmUserId = await joinMatchmaking(matchType, matchmakingUser as MatchmakingUser, { 
        guestName: matchmakingUser.username,
        rating: (matchmakingUser as MatchmakingUser).rating || 1000,
        onMatchFound: (gameId) => {
          console.log(`Match found! Game ID: ${gameId}`);
          setMatchmakingStatus(MatchmakingStatus.FOUND);
          // Redirect to the game page
          router.push(`/game/${gameId}`);
        },
        onStatusUpdate: (status, data) => {
          console.log(`Matchmaking status update: ${status}`, data);
          setMatchmakingStatus(status);
          
          if (status === MatchmakingStatus.ERROR) {
            setMatchmakingError(typeof data === 'object' && data && 'message' in data
              ? String(data.message)
              : 'An error occurred during matchmaking.');
          } else if (status === MatchmakingStatus.TIMEOUT) {
            setMatchmakingError('Matchmaking timed out. Please try again.');
          }
        }
      });
      
      // Store the user ID used in matchmaking
      console.log("Joined matchmaking queue with ID:", mmUserId);
      setMatchmakingUserId(mmUserId);
      setCurrentGameMode(matchType);
    } catch (error) {
      console.error("Failed to join matchmaking queue:", error);
      setMatchmakingError(error instanceof Error ? error.message : "An unexpected error occurred");
      setMatchmakingStatus(MatchmakingStatus.IDLE);
    }
  };

  const startGame = (gameMode: string) => {
    console.log(`[GameHub] startGame called with mode: ${gameMode}`);
    // Map gameMode string to MatchType enum
    let matchType: MatchType | null = null;
    switch (gameMode.toLowerCase()) {
      case 'quick':
        matchType = MatchType.QUICK;
        break;
      case 'ranked':
        matchType = MatchType.RANKED;
        break;
      // Add cases for other modes like 'private'
    }

    if (matchType) {
      handleStartMatchmaking(matchType); // Call the main handler
    }
  };

  const handleLoginClick = () => {
    router.push('/login');
  };

  const renderMainContent = () => {
    if (authLoading) {
      // ... loading skeleton ...
    }

    if (!user && !isGuest) {
      // ... not logged in state ...
    }

    if (matchmakingStatus === MatchmakingStatus.SEARCHING || matchmakingStatus === MatchmakingStatus.FOUND) {
      return renderMatchmakingState();
    }

    // Main content with tabs
    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="grid grid-cols-5 w-full bg-gray-100/90 dark:bg-gray-800/90 rounded-t-md p-0 gap-0 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
          <TabsTrigger 
            value="play" 
            className="py-2.5 px-4 rounded-t-md rounded-b-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-b-0 data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-gray-50/80 dark:data-[state=inactive]:hover:bg-gray-700/50 data-[state=inactive]:hover:text-foreground/80 text-sm font-medium flex items-center justify-center relative border-r border-gray-200 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[1px] data-[state=active]:after:bg-background"
          >
            <Play className="w-4 h-4 mr-2" />
            Play
          </TabsTrigger>
          <TabsTrigger 
            value="profile" 
            className="py-2.5 px-4 rounded-t-md rounded-b-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-b-0 data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-gray-50/80 dark:data-[state=inactive]:hover:bg-gray-700/50 data-[state=inactive]:hover:text-foreground/80 text-sm font-medium flex items-center justify-center relative border-r border-gray-200 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[1px] data-[state=active]:after:bg-background"
          >
            <Film className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger 
            value="leaderboard" 
            className="py-2.5 px-4 rounded-t-md rounded-b-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-b-0 data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-gray-50/80 dark:data-[state=inactive]:hover:bg-gray-700/50 data-[state=inactive]:hover:text-foreground/80 text-sm font-medium flex items-center justify-center relative border-r border-gray-200 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[1px] data-[state=active]:after:bg-background"
          >
            <Trophy className="w-4 h-4 mr-2" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger 
            value="friends" 
            className="py-2.5 px-4 rounded-t-md rounded-b-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-b-0 data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-gray-50/80 dark:data-[state=inactive]:hover:bg-gray-700/50 data-[state=inactive]:hover:text-foreground/80 text-sm font-medium flex items-center justify-center relative border-r border-gray-200 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[1px] data-[state=active]:after:bg-background"
          >
            <Users className="w-4 h-4 mr-2" />
            Friends
          </TabsTrigger>
          <TabsTrigger 
            value="clubs" 
            className="py-2.5 px-4 rounded-t-md rounded-b-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-b-0 data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-gray-50/80 dark:data-[state=inactive]:hover:bg-gray-700/50 data-[state=inactive]:hover:text-foreground/80 text-sm font-medium flex items-center justify-center relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[1px] data-[state=active]:after:bg-background"
          >
            <Medal className="w-4 h-4 mr-2" />
            Clubs
          </TabsTrigger>
        </TabsList>

        <div className="flex-grow overflow-y-auto bg-background dark:bg-gray-900/50 rounded-b-lg p-4 sm:p-6 md:p-8 transition-colors duration-200">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'play' && (
                <GameModes
                  onStartGame={startGame}
                  error={matchmakingError}
                  isGuest={isGuest}
                />
              )}
              {activeTab === 'profile' && (
                <div className="bg-card dark:bg-gray-800/60 text-card-foreground rounded-lg shadow-sm border border-border/40 p-6 transition-colors duration-200">
                 {(user && !isGuest) ? (
                   <PlayerProfile
                    user={user as User}
                    badges={userBadges}
                    loading={loadingUserData || authLoading}
                  />
                 ) : (
                   <LoginPrompt featureName="Profile" />
                 )}
                </div>
              )}
              {activeTab === 'friends' && (
                <div className="bg-card dark:bg-gray-800/60 text-card-foreground rounded-lg shadow-sm border border-border/40 p-6 transition-colors duration-200">
                 {(user && !isGuest) ? (
                   <FriendsList userId={user.id} />
                 ) : (
                   <LoginPrompt featureName="Friends" />
                 )}
                </div>
              )}
              {activeTab === 'clubs' && (
                <div className="bg-card dark:bg-gray-800/60 text-card-foreground rounded-lg shadow-sm border border-border/40 p-6 transition-colors duration-200">
                 {(user && !isGuest) ? (
                   <ClubManagement userId={user.id} />
                 ) : (
                   <LoginPrompt featureName="Clubs" />
                 )}
                </div>
              )}
              {activeTab === 'leaderboard' && (
                <div className="bg-card dark:bg-gray-800/60 text-card-foreground rounded-lg shadow-sm border border-border/40 p-6 transition-colors duration-200">
                  <Leaderboard isLoggedIn={!!user || isGuest} currentUserId={user?.id} />
                </div>
              )}
              {activeTab === 'store' && (
                <div className="bg-card dark:bg-gray-800/60 text-card-foreground rounded-lg shadow-sm border border-border/40 p-6 transition-colors duration-200">
                  <div className="text-center text-muted-foreground py-10">Store Component Placeholder</div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 backdrop-blur bg-background/80 dark:bg-black/50 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ThemeToggle className="hover:bg-muted" />
          </div>
          <div>
            {authLoading ? (
              <Skeleton className="w-[100px] h-[36px] rounded-md" />
            ) : user ? (
              <UserMenu 
                username={user.username || 'Player'} 
                level={user.level} 
                avatarUrl={user.avatar_url}
                onProfileClick={() => setActiveTab("profile")} 
              />
            ) : (
              <Button 
                onClick={handleLoginClick}
                className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-primary-foreground shadow-md transition duration-300 ease-in-out transform hover:-translate-y-1 rounded-md px-6 py-2"
              >
                Log In
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-8 md:px-8 md:py-10">
        <main className="max-w-6xl mx-auto">
          {renderMainContent()}
        </main>
      </div>

      {/* Add the ClubDetailModal at the end */}
      <ClubDetailModal 
        clubId={selectedClubId}
        open={showClubDetail}
        onClose={() => setShowClubDetail(false)}
      />
    </div>
  )
}

