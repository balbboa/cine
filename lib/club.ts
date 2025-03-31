import { createClient } from "@/lib/supabase/client";
import { Club, ClubMember, User } from "@/lib/db";

// Type for club join request with user details
export interface ClubJoinRequest {
  id: number; // BIGINT in the database
  club_id: number; // BIGINT in the database
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  message?: string;
  created_at: string;
  updated_at?: string; // Make this optional since it might not be in all results
  username?: string;
  avatar_url?: string;
}

// Define the structure returned by getUserJoinRequests
export interface UserJoinRequestWithClubData extends ClubJoinRequest {
  clubs: {
    id: number;
    name: string;
    description: string | null;
  } | null;
}

// Get all clubs
export async function getAllClubs(): Promise<Club[] | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error getting clubs:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting clubs:', error);
    return null;
  }
}

// Get user's clubs
export async function getUserClubs(userId: string): Promise<ClubMember[] | null> {
  try {
    const supabase = createClient();
    
    // First try with user_id (original schema)
    const { data: userData, error: userError } = await supabase
      .from('club_members')
      .select('*, clubs(*)')
      .eq('user_id', userId);
    
    // If no error, return data
    if (!userError && userData && userData.length > 0) {
      return userData;
    }
    
    // If no data found with user_id, try with member_id (new schema)
    const { data: memberData, error: memberError } = await supabase
      .from('club_members')
      .select('*, clubs(*)')
      .eq('member_id', userId);
    
    if (memberError) {
      console.error('Error getting user clubs:', memberError);
      return null;
    }
    
    return memberData;
  } catch (error) {
    console.error('Error getting user clubs:', error);
    return null;
  }
}

// Get user credits
export async function getUserCredits(userId: string): Promise<number | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error getting user credits:', error);
      return null;
    }
    
    return data?.credits || 0;
  } catch (error) {
    console.error('Error getting user credits:', error);
    return null;
  }
}

// Create a new club (guild)
export async function createClub(name: string, description: string, userId: string): Promise<Club | null> {
  try {
    const supabase = createClient();
    
    // Get user credits
    const credits = await getUserCredits(userId);
    if (credits === null) {
      throw new Error("Failed to get user credits");
    }
    
    // Check if user has enough credits
    if (credits < 2000) {
      throw new Error(`Not enough credits. Club creation costs 2000 credits, you have ${credits}.`);
    }
    
    // Check if club name already exists
    const { data: existingClub, error: checkError } = await supabase
      .from('clubs')
      .select('id')
      .ilike('name', name.trim())
      .maybeSingle();
      
    if (checkError) {
      console.error('Error checking existing clubs:', checkError);
      return null;
    }
    
    if (existingClub) {
      throw new Error('Club name already exists');
    }

    // Use the new guild creation function with unknown type before assertion
    const { data: result, error: rpcError } = await supabase
      .rpc('create_guild_with_membership', {
        club_name: name.trim(),
        club_description: description.trim() || "",
        creator_id: userId
      });

    if (rpcError) {
      console.error('Error creating guild:', rpcError);
      throw new Error(rpcError.message || 'Failed to create club');
    }
    
    // Safely handle the response with proper type checking
    const typedResult = result as unknown as { success: boolean; club_id?: number; message?: string };
    if (!typedResult || !typedResult.success || !typedResult.club_id) {
      throw new Error(typedResult?.message || 'Failed to create club');
    }

    // Get the newly created club details
    const { data: newClub, error: fetchError } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', typedResult.club_id)
      .single();

    if (fetchError) {
      console.error('Error fetching created club:', fetchError);
      return null;
    }
    
    return newClub;
  } catch (error: unknown) {
    console.error('Error creating club:', error);
    throw error;
  }
}

// Create a join request for a club
export async function requestToJoinClub(clubId: number, userId: string, message?: string): Promise<boolean> {
  try {
    const supabase = createClient();
    
    interface RequestResult {
      success: boolean;
      message?: string;
    }
    
    const { data, error } = await supabase
      .rpc('create_club_join_request', {
        p_club_id: clubId,
        p_user_id: userId,
        p_message: message || undefined
      });
    
    if (error) {
      console.error('Error requesting to join club:', error);
      throw new Error(error.message);
    }
    
    // Use proper typing instead of any
    const rpcResult = data as unknown as RequestResult;
    if (!rpcResult || !rpcResult.success) {
      throw new Error(rpcResult?.message || 'Failed to submit join request');
    }
    
    return true;
  } catch (error: unknown) {
    console.error('Error requesting to join club:', error);
    throw error;
  }
}

// Get join requests for a club
export async function getClubJoinRequests(clubId: number): Promise<ClubJoinRequest[]> {
  try {
    const supabase = createClient();
    
    // Define intermediate result type that matches actual database response
    interface JoinRequestResult {
      id: number;
      club_id: number;
      user_id: string;
      message: string | null;
      status: string;
      created_at: string;
      username: string | null;
      avatar_url: string | null;
    }
    
    // Use proper type casting through unknown
    const { data: requestsData, error } = await supabase
      .rpc('get_club_join_requests', {
        p_club_id: clubId
      }) as unknown as { data: JoinRequestResult[] | null; error: unknown };
    
    if (error) {
      console.error("Error fetching club join requests:", error);
      throw error;
    }
    
    if (!requestsData || !requestsData.length) {
      return [];
    }
    
    // Map to the expected format with proper undefined handling
    return requestsData.map(req => ({
      id: req.id,
      club_id: req.club_id,
      user_id: req.user_id,
      status: req.status as 'pending' | 'accepted' | 'rejected',
      created_at: req.created_at,
      // Convert nulls to undefined for optional fields
      message: req.message ?? undefined,
      username: req.username ?? undefined,
      avatar_url: req.avatar_url ?? undefined
    }));
  } catch (error) {
    console.error("Error fetching club join requests:", error);
    return [];
  }
}

/**
 * Respond to a club join request
 * @param requestId - The ID of the join request
 * @param accept - Whether to accept or reject the request
 * @returns A boolean indicating success
 */
export async function respondToJoinRequest(requestId: string, accept: boolean): Promise<boolean> {
  try {
    const supabase = createClient();
    
    interface ResponseResult {
      success: boolean;
    }
    
    // Use the stored procedure
    const { error } = await (supabase
      .rpc('respond_to_club_join_request', {
        p_request_id: parseInt(requestId),
        p_accept: accept
      }) as unknown as Promise<{ data: ResponseResult; error: unknown }>);
    
    if (error) {
      console.error("Error responding to join request:", error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error("Error responding to join request:", error);
    throw error;
  }
}

/**
 * Check if a user has a pending join request for a club
 * @param clubId - The ID of the club
 * @param userId - The ID of the user
 * @returns A boolean indicating if a pending request exists
 */
export async function checkPendingJoinRequest(clubId: number, userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    
    interface JoinRequest {
      id: number;
      club_id: number;
      user_id: string;
      status: string;
    }
    
    // Query for existing pending request with proper typing
    const query = supabase.from('club_join_requests') as unknown;
    try {
      const { data } = await (query as {
        select: (columns: string) => {
          eq: (field: string, value: number | string) => {
            eq: (field: string, value: string) => {
              eq: (field: string, value: string) => {
                single: () => Promise<{ data: JoinRequest | null; error: unknown }>
              }
            }
          }
        }
      }).select('id')
        .eq('club_id', clubId)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .single();
      
      return !!data;
    } catch {
      // Not found is expected sometimes
      return false;
    }
  } catch (error) {
    // Not found is expected sometimes
    console.error('Error:', error);
    return false;
  }
}

// Get a user's join requests
export async function getUserJoinRequests(userId: string): Promise<UserJoinRequestWithClubData[] | null> {
  try {
    const supabase = createClient();
    
    // Use proper typing for the query
    const { data } = await supabase
      .from('club_join_requests')
      .select('*, clubs(id, name, description)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    // Map the data to the expected format
    return data as unknown as UserJoinRequestWithClubData[];
  } catch (error) {
    console.error('Error getting user join requests:', error);
    return null;
  }
}

// Legacy joinClub now calls requestToJoinClub
export async function joinClub(clubId: number, userId: string): Promise<boolean> {
  try {
    return await requestToJoinClub(clubId, userId);
  } catch (error) {
    console.error('Error joining club:', error); 
    return false;
  }
}

// Leave a club
export async function leaveClub(clubId: number, userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    
    // Try delete with user_id
    const { error: userDeleteError } = await supabase
      .from('club_members')
      .delete()
      .eq('user_id', userId)
      .eq('club_id', clubId);
    
    // If no error, return true
    if (!userDeleteError) {
      return true;
    }
    
    // If error, try with member_id
    const { error: memberDeleteError } = await supabase
      .from('club_members')
      .delete()
      .eq('member_id', userId)
      .eq('club_id', clubId);
    
    if (memberDeleteError) {
      console.error('Error leaving club:', memberDeleteError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error leaving club:', error);
    return false;
  }
}

// Get club members with user data
export async function getClubMembers(clubId: number): Promise<ClubMember[] | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('club_members')
      .select(`
        *,
        user:users(*)
      `)
      .eq('club_id', clubId);

    if (error) {
      console.error('Error getting club members:', error);
      return null;
    }
    
    // Cast data to the expected type (array of ClubMember, potentially with nested user)
    // The exact type might need refinement based on the structure of 'users(*)'
    return data as ClubMember[] | null;

  } catch (error) {
    console.error('Error getting club members:', error);
    return null;
  }
}

/**
 * Check if a user is a club owner
 * @param clubId The ID of the club
 * @param userId The ID of the user to check
 * @returns A boolean indicating if the user is an owner
 */
export async function isClubOwner(clubId: number, userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    
    // Since we need to allow for is_owner column
    interface ClubMemberWithOwner {
      id: number;
      club_id: number;
      user_id: string;
      is_owner: boolean;
    }
    
    // Try to get member by user_id
    const { data: memberData, error: memberError } = await supabase
      .from('club_members')
      .select('*')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle();
      
    if (memberError) {
      console.error("Error checking club ownership:", memberError);
      return false;
    }
    
    // If found by user_id, use that
    if (memberData) {
      return (memberData as ClubMemberWithOwner).is_owner || false;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking club ownership:", error);
    return false;
  }
}

// Get club leaderboard data (users ordered by XP)
export async function getClubLeaderboard(clubId: number): Promise<User[] | null> { // Return User array or null
  try {
    const supabase = createClient();
    
    // 1. Get member IDs for the club
    const { data: memberIdsData, error: memberIdsError } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId);

    if (memberIdsError) {
      console.error("Error getting member IDs for leaderboard:", memberIdsError);
      return null;
    }
    
    const memberIds = memberIdsData.map(m => m.user_id);
    
    if (memberIds.length === 0) {
      return []; // No members, return empty array
    }

    // 2. Fetch user profiles for members, ordered by XP
    const { data: clubLeaderboardData, error: leaderboardError } = await supabase
      .from('users')
      .select('*') // Select all user fields
      .in('id', memberIds)
      .order('xp', { ascending: false });

    if (leaderboardError) {
      console.error("Error getting club leaderboard data:", leaderboardError);
      return null;
    }

    return clubLeaderboardData as User[] | null; // Cast to User array

  } catch (error) {
    console.error('Error getting club leaderboard:', error);
    return null;
  }
}

// Update club details (name, description) - Owner only
export async function updateClubDetails(clubId: number, name: string, description: string): Promise<boolean> {
  try {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Club name cannot be empty');
    }
    
    const supabase = createClient();
    
    // Get the current user session
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    // First check if user is owner
    const { data: memberData, error: memberError } = await supabase
      .from('club_members')
      .select('is_owner')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .single();
      
    if (memberError || !memberData?.is_owner) {
      throw new Error('Only club owners can update club details');
    }

    // Check if club name already exists (for other clubs)
    const { data: existingClub, error: checkError } = await supabase
      .from('clubs')
      .select('id')
      .ilike('name', trimmedName)
      .not('id', 'eq', clubId)
      .maybeSingle();
      
    if (checkError) {
      console.error('Error checking existing clubs:', checkError);
      throw checkError;
    }
    
    if (existingClub) {
      throw new Error('Club name already exists');
    }
    
    // Update club - only update the name field which should always be safe
    const { error: nameError } = await supabase
      .from('clubs')
      .update({ name: trimmedName })
      .eq('id', clubId);

    if (nameError) {
      console.error("Error updating club name:", nameError);
      throw nameError;
    }
    
    // If description is provided, update it in a separate query
    const trimmedDescription = description.trim();
    if (trimmedDescription) {
      const { error: descError } = await supabase
        .from('clubs')
        .update({ description: trimmedDescription })
        .eq('id', clubId);
        
      if (descError) {
        console.error("Error updating club description:", descError);
        // At least we updated the name, so don't throw this error
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to update club details:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while updating club details.');
  }
}

/**
 * Add a user to a club
 * @param clubId - The ID of the club
 * @param userId - The ID of the user to add
 * @param isOwner - Whether the user should be an owner (default: false)
 * @returns A boolean indicating success
 */
export async function addClubMember(
  clubId: number,
  userId: string,
  isOwner: boolean = false
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('club_members')
      .upsert({
        club_id: clubId,
        user_id: userId,
        is_owner: isOwner
      });

    if (error) {
      console.error('Error adding club member:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error adding club member:', error);
    throw error;
  }
}

/**
 * Remove a user from a club
 * @param clubId - The ID of the club
 * @param userId - The ID of the user to remove
 * @returns A boolean indicating success
 */
export async function removeClubMember(
  clubId: number,
  userId: string
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing club member:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error removing club member:', error);
    throw error;
  }
} 