"use client"

import { useState, useEffect } from "react"
import { addClubMember, removeClubMember } from "@/lib/club"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Trash2, UserPlus, AlertCircle, ShieldCheck } from "lucide-react"
import type { Database } from '@/types/database.types'

// Define types
type ClubMember = Database['public']['Tables']['club_members']['Row'];
type User = Database['public']['Tables']['users']['Row'];

type ClubMemberWithUser = ClubMember & { 
  users: User | null;
  isCurrentUser: boolean;
}

interface ClubMembersTableProps {
  clubId: number;
  isOwner: boolean;
  userId?: string;
}

export default function ClubMembersTable({ clubId, isOwner, userId }: ClubMembersTableProps) {
  const [members, setMembers] = useState<ClubMemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState("");
  const [makeOwner, setMakeOwner] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberIds, setRemovingMemberIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const supabase = createClient();
  
  // Load members
  useEffect(() => {
    async function loadMembers() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('club_members')
          .select('*, users(*)')
          .eq('club_id', clubId)
          .order('is_owner', { ascending: false })
          .order('joined_at', { ascending: true });
          
        if (error) throw error;
        
        // Add isCurrentUser flag to each member
        const membersWithCurrentFlag = data.map(member => ({
          ...member,
          isCurrentUser: member.user_id === userId
        })) as ClubMemberWithUser[];
        
        setMembers(membersWithCurrentFlag);
      } catch (err) {
        console.error('Error loading members:', err);
        setError('Failed to load club members');
      } finally {
        setLoading(false);
      }
    }
    
    loadMembers();
    
    // Set up real-time subscription for club members
    const membersSubscription = supabase
      .channel(`club_members_${clubId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'club_members',
          filter: `club_id=eq.${clubId}`
        },
        () => {
          loadMembers();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(membersSubscription);
    };
  }, [clubId, supabase, userId]);
  
  // Handle adding a new member
  const handleAddMember = async () => {
    if (!newMemberUsername.trim()) return;
    
    setAddingMember(true);
    setError(null);
    
    try {
      // First, look up the user ID from the username
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('username', newMemberUsername.trim())
        .single();
        
      if (userError || !userData) {
        throw new Error(`User "${newMemberUsername}" not found`);
      }
      
      // Now add the member
      const success = await addClubMember(clubId, userData.id, makeOwner);
      
      if (success) {
        toast({
          title: "Member Added",
          description: `${newMemberUsername} has been added to the club.`
        });
        setShowAddMemberDialog(false);
        setNewMemberUsername("");
        setMakeOwner(false);
      } else {
        throw new Error("Failed to add member");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast({
        title: "Error Adding Member",
        description: message,
        variant: "destructive"
      });
    } finally {
      setAddingMember(false);
    }
  };
  
  // Handle removing a member
  const handleRemoveMember = async (memberId: string, username: string) => {
    setRemovingMemberIds(prev => new Set(prev).add(memberId));
    
    try {
      const success = await removeClubMember(clubId, memberId);
      
      if (success) {
        toast({
          title: "Member Removed",
          description: `${username} has been removed from the club.`
        });
      } else {
        throw new Error("Failed to remove member");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error Removing Member",
        description: message,
        variant: "destructive"
      });
    } finally {
      setRemovingMemberIds(prev => {
        const updated = new Set(prev);
        updated.delete(memberId);
        return updated;
      });
    }
  };
  
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center space-x-2 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
      
      {isOwner && (
        <div className="flex justify-end mb-2">
          <Button 
            onClick={() => setShowAddMemberDialog(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            size="sm"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      )}
      
      <div className="bg-card border-border rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-xs font-medium text-foreground/70 p-3 text-left">Member</th>
              <th className="text-xs font-medium text-foreground/70 p-3 text-left">Role</th>
              <th className="text-xs font-medium text-foreground/70 p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <tr key={i} className="border-t border-border animate-pulse">
                  <td className="p-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-muted"></div>
                      <div className="h-4 w-32 bg-muted rounded"></div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 w-16 bg-muted rounded"></div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="h-8 w-8 bg-muted rounded ml-auto"></div>
                  </td>
                </tr>
              ))
            ) : members.length > 0 ? (
              members.map(member => (
                <tr key={member.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={member.users?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {member.users?.username?.substring(0, 2).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-foreground">
                          {member.users?.username}
                          {member.isCurrentUser && (
                            <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Joined {new Date(member.joined_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    {member.is_owner ? (
                      <div className="flex items-center space-x-1 text-yellow-500">
                        <ShieldCheck className="h-4 w-4" />
                        <span className="text-sm font-medium">Owner</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Member</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {isOwner && !member.isCurrentUser && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveMember(member.user_id, member.users?.username || '')}
                        disabled={removingMemberIds.has(member.user_id)}
                      >
                        {removingMemberIds.has(member.user_id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-border">
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
                  No members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Add New Member</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter the username of the person you want to add to this club.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={newMemberUsername}
                onChange={e => setNewMemberUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="make-owner"
                checked={makeOwner}
                onCheckedChange={setMakeOwner}
              />
              <Label htmlFor="make-owner" className="text-sm">
                Make this user a club owner
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddMemberDialog(false);
                setNewMemberUsername("");
                setMakeOwner(false);
              }}
              disabled={addingMember}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={!newMemberUsername.trim() || addingMember}
            >
              {addingMember ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 