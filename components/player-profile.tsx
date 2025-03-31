"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Star, Award, ChevronRight, Edit, Check, Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateUserProfile, checkUsernameUnique, getGameHistory, type GameHistoryItem } from "@/lib/db"
import { useToast } from "@/components/ui/use-toast"
import type { User as DbUser } from "@/lib/db" // Only import DbUser now
import Image from 'next/image'; // Added Next Image import

// Define Badge type locally (if not shared)
// Based on Badge type from game-hub.tsx or DB schema
type Badge = {
  id: number;
  name: string;
  description: string;
  icon: string;
  created_at: string;
};

// Define UserBadgeWithBadge type locally (if not shared)
// Based on type from game-hub.tsx
type UserBadgeWithBadge = {
  id: number;
  user_id: string;
  badge_id: number;
  earned_at: string;
  badges: Badge | null; // Relation to Badge type
};

interface PlayerProfileProps {
  user: DbUser // User profile data
  badges?: UserBadgeWithBadge[] // Use the locally defined type
  loading?: boolean
}

// Define available avatars
const availableAvatars = [
  '/avatars/halloween.png',
  '/avatars/alien.png',
  '/avatars/cat.png',
  '/avatars/dog.png',
  '/avatars/ghosts.png',
  '/avatars/ninja.png',
  '/avatars/robot.png',
  '/avatars/superhero.png',
  '/avatars/villain.png',
  '/avatars/zombie.png',
];

export default function PlayerProfile({ user, badges = [], loading = false }: PlayerProfileProps) {
  const winRate = user.wins + user.losses > 0 ? Math.round((user.wins / (user.wins + user.losses)) * 100) : 0
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [showNicknameDialog, setShowNicknameDialog] = useState(false)
  const [newNickname, setNewNickname] = useState(user.username || "")
  const [updatingNickname, setUpdatingNickname] = useState(false)
  const [nicknameError, setNicknameError] = useState<string | null>(null)
  const { toast } = useToast()

  // States for avatar selection
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(user.avatar_url)
  const [updatingAvatar, setUpdatingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  // Load game history and stats
  useEffect(() => {
    const loadGameStats = async () => {
      if (!user) return

      setLoadingStats(true)

      try {
        const fetchedHistory = await getGameHistory(user.id, 5); // Fetch last 5 games
        if (fetchedHistory) {
          setGameHistory(fetchedHistory);
        }
      } catch (error) {
        console.error("Error loading game stats:", error)
        setGameHistory([]) // Reset history on error
      } finally {
        setLoadingStats(false)
      }
    }

    loadGameStats()
  }, [user])

  const handleUpdateNickname = async () => {
    if (!newNickname.trim() || !user) return;
    
    setUpdatingNickname(true);
    setNicknameError(null);
    
    try {
      // First check if the username is unique
      const isUnique = await checkUsernameUnique(newNickname.trim(), user.id);
      
      if (!isUnique) {
        setNicknameError("This username is already taken. Please choose another one.");
        setUpdatingNickname(false);
        return;
      }
      
      // Update the user profile
      const updatedUser = await updateUserProfile(user.id, { username: newNickname.trim() });
      
      if (updatedUser) {
        toast({
          title: "Nickname updated",
          description: `Your nickname has been updated to ${updatedUser.username}`,
        });
        
        // Close the dialog
        setShowNicknameDialog(false);
        
        // Force a reload to show the updated nickname
        window.location.reload();
      } else {
        throw new Error("Failed to update nickname. Please try again.");
      }
    } catch (error: unknown) {
      console.error("Error updating nickname:", error);
      const message = error instanceof Error ? error.message : "An error occurred while updating your nickname.";
      setNicknameError(message);
    } finally {
      setUpdatingNickname(false);
    }
  };

  // Function to handle avatar update
  const handleUpdateAvatar = async () => {
    if (!selectedAvatar || !user || selectedAvatar === user.avatar_url) {
      setShowAvatarDialog(false); // Close dialog if no change or no selection
      return;
    }
    
    setUpdatingAvatar(true);
    setAvatarError(null);
    
    try {
      const updatedUser = await updateUserProfile(user.id, { avatar_url: selectedAvatar });
      
      if (updatedUser) {
        toast({
          title: "Avatar updated",
          description: "Your profile avatar has been successfully updated.",
        });
        setShowAvatarDialog(false); // Close dialog
        window.location.reload(); // Reload to show the change
      } else {
        throw new Error("Failed to update avatar. Please try again.");
      }
    } catch (error: unknown) {
      console.error("Error updating avatar:", error);
      const message = error instanceof Error ? error.message : "An error occurred while updating your avatar.";
      setAvatarError(message);
    } finally {
      setUpdatingAvatar(false);
    }
  };

  if (loading) {
    return <ProfileSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="backdrop-blur-md bg-card/80 rounded-xl p-6 border border-border shadow-lg md:w-1/3"
        >
          <div className="flex flex-col items-center">
            {/* Avatar with Edit Button */}
            <div className="relative mb-4">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  src={user.avatar_url || `/placeholder.svg?height=96&width=96&text=${user.username.substring(0, 2)}`}
                  alt={user.username}
                  className="object-cover" // Ensure image covers the area
                />
                <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-primary-foreground text-xl">
                  {user.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button 
                variant="outline"
                size="icon"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-background/80 border-border text-foreground hover:bg-background"
                onClick={() => {
                  setSelectedAvatar(user.avatar_url);
                  setShowAvatarDialog(true);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-foreground">{user.username}</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                onClick={() => {
                  setNewNickname(user.username);
                  setShowNicknameDialog(true);
                }}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="bg-gradient-to-r from-yellow-400 to-amber-600 text-amber-900 text-xs font-bold px-3 py-1 rounded-full mb-4">
              Level {user.level}
            </div>

            <div className="w-full space-y-2 mb-6">
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>XP Progress</span>
                <span>
                  {user.xp} / {user.xp_to_next_level}
                </span>
              </div>
              <Progress value={(user.xp / user.xp_to_next_level) * 100} className="h-2" />
            </div>

            <div className="grid grid-cols-3 w-full gap-4 text-center">
              <div className="bg-accent/50 rounded-lg p-3">
                <p className="text-foreground font-bold text-xl">{user.wins}</p>
                <p className="text-muted-foreground text-xs">Wins</p>
              </div>

              <div className="bg-accent/50 rounded-lg p-3">
                <p className="text-foreground font-bold text-xl">{user.losses}</p>
                <p className="text-muted-foreground text-xs">Losses</p>
              </div>

              <div className="bg-accent/50 rounded-lg p-3">
                <p className="text-foreground font-bold text-xl">{winRate}%</p>
                <p className="text-muted-foreground text-xs">Win Rate</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-md bg-card/80 rounded-xl p-6 border border-border shadow-lg flex-1"
        >
          <Tabs defaultValue="badges">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger
                value="badges"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground"
              >
                <Award className="h-4 w-4 mr-1" />
                Badges
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground"
              >
                <Star className="h-4 w-4 mr-1" />
                Game History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="badges" className="mt-4 space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Your Badges</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {badges.length > 0 ? (
                  badges.map((userBadge) => (
                    <motion.div
                      key={userBadge.id}
                      whileHover={{ scale: 1.02 }}
                      className="bg-accent/50 rounded-lg p-4 flex items-center"
                    >
                      <div className="bg-gradient-to-br from-amber-400 to-amber-600 w-12 h-12 rounded-full flex items-center justify-center mr-4 text-2xl">
                        {userBadge.badges?.icon}
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">{userBadge.badges?.name}</h4>
                        <p className="text-muted-foreground text-sm">{userBadge.badges?.description}</p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-accent/30 rounded-lg p-4 border-2 border-dashed border-border flex items-center col-span-2"
                  >
                    <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center mr-4">
                      <Star className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-muted-foreground">No Badges Yet</h4>
                      <p className="text-muted-foreground/70 text-sm">Keep playing to unlock badges!</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Game History</h3>

              {loadingStats ? (
                <div className="space-y-4">
                  <Skeleton className="h-40 w-full bg-accent/20" />
                  <Skeleton className="h-40 w-full bg-accent/20" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-accent/50 rounded-lg p-4">
                    <h4 className="text-foreground font-medium mb-2">Game History</h4>
                    <div className="space-y-2">
                      {gameHistory.map((game) => (
                        <div
                          key={game.id}
                          className={`flex justify-between items-center p-2 rounded-md ${
                            game.result === "win"
                              ? "bg-green-500/20 dark:bg-green-600/20"
                              : game.result === "loss"
                                ? "bg-red-500/20 dark:bg-red-600/20"
                                : "bg-gray-500/20 dark:bg-gray-600/20"
                          }`}
                        >
                          <div>
                            <p className="text-foreground font-medium">vs. {game.opponentUsername}</p>
                            <p className="text-muted-foreground text-xs">{new Date(game.completedAt).toLocaleDateString()}</p>
                          </div>
                          <Badge
                            className={
                              game.result === "win"
                                ? "bg-green-500 dark:bg-green-600 text-white"
                                : game.result === "loss"
                                  ? "bg-red-500 dark:bg-red-600 text-white"
                                  : "bg-gray-500 dark:bg-gray-600 text-white"
                            }
                          >
                            {game.result === "win" ? "Win" : game.result === "loss" ? "Loss" : "Draw"}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="ghost"
                      className="w-full mt-2 text-foreground hover:text-foreground hover:bg-accent/10 dark:hover:bg-gray-800/50"
                    >
                      View All Games
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Nickname Update Dialog */}
      <Dialog open={showNicknameDialog} onOpenChange={setShowNicknameDialog}>
        <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Update Nickname</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter a new nickname. It must be unique.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nickname" className="text-right">
                Nickname
              </Label>
              <Input
                id="nickname"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="col-span-3 bg-gray-800 border-gray-700"
              />
            </div>
            {nicknameError && (
              <Alert variant="destructive">
                <AlertDescription>{nicknameError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowNicknameDialog(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              disabled={updatingNickname}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateNickname} 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!newNickname.trim() || newNickname === user.username || updatingNickname}
            >
              {updatingNickname ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Update
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avatar Selection Dialog */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="max-w-lg bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Choose Your Avatar</DialogTitle>
            <DialogDescription className="text-gray-400">
              Select a new avatar from the options below.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {avatarError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{avatarError}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-4 max-h-[400px] overflow-y-auto pr-2">
              {availableAvatars.map((avatarPath) => (
                <button
                  key={avatarPath}
                  onClick={() => setSelectedAvatar(avatarPath)}
                  className={`relative rounded-full overflow-hidden border-4 transition-all duration-200 ${selectedAvatar === avatarPath ? 'border-blue-500 scale-105' : 'border-transparent hover:border-gray-600'}`}
                >
                  <Image
                    src={avatarPath}
                    alt={`Avatar option ${avatarPath}`}
                    width={80}
                    height={80}
                    className="aspect-square object-cover bg-gray-700"
                    // Add error handling if needed
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg?height=80&width=80&text=ERR'; }}
                  />
                  {selectedAvatar === avatarPath && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Check className="h-6 w-6 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAvatarDialog(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              disabled={updatingAvatar}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateAvatar} 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!selectedAvatar || selectedAvatar === user.avatar_url || updatingAvatar}
            >
              {updatingAvatar ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Avatar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="backdrop-blur-md bg-card/80 rounded-xl p-6 border border-border shadow-lg md:w-1/3">
          <div className="flex flex-col items-center">
            <Skeleton className="h-24 w-24 rounded-full mb-4 bg-accent/20" />
            <Skeleton className="h-8 w-40 mb-1 bg-accent/20" />
            <Skeleton className="h-6 w-24 mb-4 bg-accent/20" />

            <div className="w-full space-y-2 mb-6">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20 bg-accent/20" />
                <Skeleton className="h-4 w-20 bg-accent/20" />
              </div>
              <Skeleton className="h-2 w-full bg-accent/20" />
            </div>

            <div className="grid grid-cols-3 w-full gap-4">
              <Skeleton className="h-20 rounded-lg bg-accent/20" />
              <Skeleton className="h-20 rounded-lg bg-accent/20" />
              <Skeleton className="h-20 rounded-lg bg-accent/20" />
            </div>
          </div>
        </div>

        <div className="backdrop-blur-md bg-card/80 rounded-xl p-6 border border-border shadow-lg flex-1">
          <Skeleton className="h-10 w-full mb-6 bg-accent/20" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-40 bg-accent/20" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-24 rounded-lg bg-accent/20" />
              <Skeleton className="h-24 rounded-lg bg-accent/20" />
              <Skeleton className="h-24 rounded-lg bg-accent/20" />
              <Skeleton className="h-24 rounded-lg bg-accent/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

