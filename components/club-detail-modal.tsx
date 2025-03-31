"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Users, Trophy, Loader2, Edit, Save, XCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth"
import { getClubMembers, getClubLeaderboard, joinClub, leaveClub, updateClubDetails } from "@/lib/club"
import { createClient } from "@/lib/supabase/client"
import { Club, ClubMember } from "@/lib/db"
import ClubMembersTable from "@/components/club-members-table"

interface ClubDetailModalProps {
  clubId: number | null
  open: boolean
  onClose: () => void
}

interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  level: number;
  xp: number;
}

export default function ClubDetailModal({ clubId, open, onClose }: ClubDetailModalProps) {
  const { user } = useAuth()
  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<ClubMember[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState("")
  const [editedDescription, setEditedDescription] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    const loadClubDetails = async () => {
      if (!clubId || !open) {
        return
      }

      setLoading(true)

      try {
        // Get club details
        const { data: clubData, error: clubError } = await supabase
          .from("clubs")
          .select("*")
          .eq("id", clubId)
          .single()

        if (clubError) throw clubError
        if (!clubData) {
          onClose()
          return
        }

        setClub(clubData)
        setEditedName(clubData.name || "")
        setEditedDescription(clubData.description || "")

        // Get club members
        const membersData = await getClubMembers(clubId)
        setMembers(membersData || [])

        // Get club leaderboard
        const leaderboardData = await getClubLeaderboard(clubId)
        setLeaderboard(leaderboardData || [])

        // Check if user is a member and owner
        if (user?.id) {
          const { data: memberData, error: memberError } = await supabase
            .from("club_members")
            .select("id, is_owner")
            .eq("club_id", clubId)
            .eq("user_id", user.id)
            .maybeSingle()

          if (memberError) {
            console.error("Error checking membership:", memberError)
            setIsMember(false)
            setIsOwner(false)
          } else if (memberData) {
            setIsMember(true)
            setIsOwner(memberData.is_owner || false)
          } else {
            // Try with member_id if needed (though is_owner might only be reliable with user_id)
             const { data: memberData2 } = await supabase
              .from("club_members")
              .select("id, is_owner")
              .eq("club_id", clubId)
              .eq("member_id", user.id)
              .maybeSingle()
              
            setIsMember(!!memberData2)
            setIsOwner(memberData2?.is_owner || false)
          }
        }
      } catch (error: unknown) {
        console.error("Error loading club details:", error)
        onClose()
      } finally {
        setLoading(false)
      }
    }

    loadClubDetails()
    // Reset editing state when modal reopens or club changes
    setIsEditing(false)
  }, [clubId, open, user?.id, supabase, onClose])

  const handleJoinClub = async () => {
    if (!user?.id || !clubId) return

    setJoining(true)
    try {
      const joined = await joinClub(clubId, user.id)
      if (joined) {
        setIsMember(true)
        // Refresh member list
        const membersData = await getClubMembers(clubId)
        setMembers(membersData || [])
      }
    } catch (error) {
      console.error("Error joining club:", error)
    } finally {
      setJoining(false)
    }
  }

  const handleLeaveClub = async () => {
    if (!user?.id || !clubId) return

    setLeaving(true)
    try {
      const left = await leaveClub(clubId, user.id)
      if (left) {
        setIsMember(false)
        // Refresh member list
        const membersData = await getClubMembers(clubId)
        setMembers(membersData || [])
      }
    } catch (error) {
      console.error("Error leaving club:", error)
    } finally {
      setLeaving(false)
    }
  }

  // --- Edit Functions ---
  const handleEditToggle = () => {
    if (!isEditing) {
      // Entering edit mode, set initial values
      setEditedName(club?.name || "")
      setEditedDescription(club?.description || "")
    }
    setIsEditing(!isEditing)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    // Optionally reset fields to original values if needed
    setEditedName(club?.name || "")
    setEditedDescription(club?.description || "")
  }

  const handleSaveEdit = async () => {
    if (!clubId || !user?.id) return

    setIsSaving(true)
    try {
      // Call the updateClubDetails function from lib/club
      const success = await updateClubDetails(clubId, editedName, editedDescription);

      if (success) {
        // Update local club state optimistically
        setClub(prev => prev ? { ...prev, name: editedName, description: editedDescription } : null)
        toast({ title: "Club Updated", description: "Club details saved successfully." })
        setIsEditing(false)
      } else {
        throw new Error("Failed to save club details.")
      }
    } catch (error: unknown) {
      console.error("Error saving club details:", error)
      toast({ 
        title: "Save Failed", 
        description: error instanceof Error ? error.message : "Could not update club details.", 
        variant: "destructive" 
      })
    } finally {
      setIsSaving(false)
    }
  }
  // --- End Edit Functions ---

  const calculateWinRate = (wins: number, losses: number) => {
    const totalGames = wins + losses
    if (totalGames === 0) return "0%"
    return `${Math.round((wins / totalGames) * 100)}%`
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-gray-900 border-gray-800 text-white">
        {loading || !club ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                Loading Club Details
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Please wait while we load the club information...
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="club-name-edit" className="text-gray-400">Club Name</Label>
                    <Input 
                      id="club-name-edit"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="mt-1 bg-gray-800 border-gray-700 text-white text-2xl font-bold"
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="club-description-edit" className="text-gray-400">Description</Label>
                    <Textarea 
                      id="club-description-edit"
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      className="mt-1 bg-gray-800 border-gray-700 text-gray-300 h-24 resize-none"
                      placeholder="Enter club description"
                      disabled={isSaving}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-400" />
                    {club.name}
                  </DialogTitle>
                  <DialogDescription className="text-gray-400 mt-2">
                    {club.description || "No description provided."}
                  </DialogDescription>
                </>
              )}
            </DialogHeader>

            <div className="mt-4">
              <div className="mb-6 flex justify-end items-center gap-2">
                {isOwner && (
                  isEditing ? (
                    <>
                      <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                        <XCircle className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Save Changes</>}
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleEditToggle}>
                      <Edit className="h-4 w-4 mr-1" /> Edit Club
                    </Button>
                  )
                )}
                
                {user && (!isEditing || !isOwner) && (
                  isMember ? (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleLeaveClub}
                      disabled={leaving || isEditing}
                    >
                      {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave Club"}
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={handleJoinClub}
                      disabled={joining || isEditing}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Club"}
                    </Button>
                  )
                )}
              </div>

              {!isEditing && (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-gray-800/50 p-1">
                    <TabsTrigger
                      value="overview"
                      className="data-[state=active]:bg-gray-700/50 data-[state=active]:text-gray-100 text-gray-300/70"
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Members ({members.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="leaderboard"
                      className="data-[state=active]:bg-gray-700/50 data-[state=active]:text-gray-100 text-gray-300/70"
                    >
                      <Trophy className="h-4 w-4 mr-1" />
                      Leaderboard
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-6">
                    {clubId && (
                      <ClubMembersTable 
                        clubId={clubId} 
                        isOwner={isOwner} 
                        userId={user?.id}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="leaderboard" className="mt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-gray-700/50">
                            <th className="p-3 md:p-4 text-center">#</th>
                            <th className="p-3 md:p-4">Player</th>
                            <th className="p-3 md:p-4 text-center">Level</th>
                            <th className="p-3 md:p-4 text-center">XP</th>
                            <th className="p-3 md:p-4 text-center">W/L</th>
                            <th className="p-3 md:p-4 text-center">Win Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.map((player, index) => (
                            <tr 
                              key={player.id} 
                              className={`border-b border-gray-700/50 ${player.id === user?.id ? 'bg-blue-900/20' : 'hover:bg-gray-800/20'}`}
                            >
                              <td className="p-3 md:p-4 text-center font-medium">{index + 1}</td>
                              <td className="p-3 md:p-4">
                                <div className="flex items-center">
                                  <Avatar className="h-7 w-7 mr-2">
                                    {player.avatar_url ? (
                                      <AvatarImage
                                        src={player.avatar_url}
                                        alt={player.username || "User"}
                                      />
                                     ) : null}
                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">
                                      {player.username?.substring(0, 2)?.toUpperCase() || "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium">{player.username || "Unknown User"}</span>
                                </div>
                              </td>
                              <td className="p-3 md:p-4 text-center">
                                <Badge className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border-none">
                                  {player.level || 1}
                                </Badge>
                              </td>
                              <td className="p-3 md:p-4 text-center">{(player.xp || 0).toLocaleString()}</td>
                              <td className="p-3 md:p-4 text-center">{player.wins}/{player.losses}</td>
                              <td className="p-3 md:p-4 text-center">{calculateWinRate(player.wins, player.losses)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
} 