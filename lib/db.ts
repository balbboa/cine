// import { createBrowserClient } from '@supabase/ssr';
// Import the type locally
import type { Database } from '../types/database.types';
// Re-export the Database type using 'export type'
export type { Database } from '../types/database.types';
import { createClient } from './supabase/client';
import { validate as isUUID } from 'uuid'; // Import UUID validation
// import { randomUUID } from 'crypto';

// Types - Now Database type is available locally
export type User = Database['public']['Tables']['users']['Row'];
export type Game = Database['public']['Tables']['games']['Row'];
export type GameMove = Database['public']['Tables']['game_moves']['Row'];
export type Badge = Database['public']['Tables']['badges']['Row'];
export type UserBadge = Database['public']['Tables']['user_badges']['Row'];
export type StoreItem = Database['public']['Tables']['store_items']['Row'];
export type Club = Database['public']['Tables']['clubs']['Row'];
export type ClubMember = Database['public']['Tables']['club_members']['Row'];
export type Friendship = Database['public']['Tables']['friendships']['Row'];
export type FriendRequest = Database['public']['Tables']['friend_requests']['Row'] & {
  sender?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  receiver?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
};
export type GameInvite = Database['public']['Tables']['game_invites']['Row'] & {
  sender?: {
    id: string;
    username: string;
    avatar_url: string | null;
    online_status: string | null;
  };
  receiver?: {
    id: string;
    username: string;
    avatar_url: string | null;
    online_status: string | null;
  };
  game?: {
    id: string;
    game_mode: string;
    status: string;
  };
};

// Define a placeholder UserInventory type - adjust based on your actual schema
export type UserInventory = {
  id: number; // Or string if UUID
  user_id: string;
  item_id: number; // Assuming link to store_items.id
  quantity?: number; // Optional quantity
  acquired_at?: string; // Optional acquisition timestamp
  // Add other relevant fields from your user inventory table
};

// Add specific types for RPC function arguments and return types if known
// Example (replace with actual types if available in database.types.ts or define manually)
// type UpdateUserXpArgs = Database['public']['Functions']['update_user_xp']['Args'];
// type JoinGameArgs = Database['public']['Functions']['join_game']['Args'];
// type JoinGameAsGuestArgs = Database['public']['Functions']['join_game_as_guest']['Args'];
// type CreateGameWithGuestArgs = Database['public']['Functions']['create_game_with_guest']['Args'];
// type GetTableColumnsArgs = Database['public']['Functions']['get_table_columns']['Args']; // If it exists
// type JoinGameByInviteCodeArgs = Database['public']['Functions']['join_game_by_invite_code']['Args']; // If it exists

// Align ExtendedGame with base Game type from schema
export interface ExtendedGame extends Game {
  // Ensure required fields from Game are not optional here unless truly nullable
  board_state: Game['board_state']; // Inherit type/optionality from Game
  status: Game['status'];         // Inherit type/optionality from Game
  // steal_mode: Game['steal_mode']; // Inherit type/optionality from Game

  // Add fields potentially missing from base Game type if needed
  player1_guest_id: string | null;
  player2_guest_id: string | null;
  updated_at?: string; // Might be different from DB default
  current_player?: number | null; 
  steals_left?: number[] | null; 
}

// Get a Supabase client for each function call
const getSupabase = () => createClient();

// User functions
export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error in getUserProfile:', error);
    return null;
  }
}

export async function updateUserProfile(userId: string, updates: Partial<User>): Promise<User | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating user profile:', error);
    return null;
  }
}

export async function checkUsernameUnique(username: string, currentUserId?: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    let query = supabase
      .from('users')
      .select('id')
      .eq('username', username);
    
    // If currentUserId is provided, exclude the current user from the check
    // This allows a user to "update" to their current username
    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }
    
    const { data, error } = await query;

    if (error) {
      console.error('Error checking username uniqueness:', error);
      return false;
    }

    // If no rows returned, the username is unique
    return data.length === 0;
  } catch (error) {
    console.error('Error checking username uniqueness:', error);
    return false;
  }
}

// Game functions
// Comment out the unused empty GameOptions interface
/*
export interface GameOptions {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  // Placeholder for future game options
}
*/

export async function createGame(
  player1Id: string, // Can be UUID or guest ID
  player1DisplayName: string, // Always provide display name
  gameMode: string = 'casual', 
  generateCodeOnly: boolean = false,
  player2Id?: string | null, // Can be UUID or guest ID
  _player2DisplayName?: string | null // Prefixed unused param
): Promise<{ game: Game | null, inviteCode: string | null }> { 
  try {
    // Add validation or ensure player1Id is always a UUID if required by schema
    if (!isUUID(player1Id) && player1Id !== null) { // Assuming null is okay if guest
        console.error("[createGame] Invalid player1Id provided:", player1Id);
        // return { game: null, inviteCode: null }; // Or throw error
        // Temporary fix: Assume it should be null if not UUID for type checking
        // player1Id = null;
    }
    if (player2Id && !isUUID(player2Id)) {
        console.error("[createGame] Invalid player2Id provided:", player2Id);
        // return { game: null, inviteCode: null }; // Or throw error
        // player2Id = null;
    }
    if (_player2DisplayName && player2Id && !isUUID(player2Id)) {
        // Might want to log if display name is provided for a guest ID
        console.log("[createGame] player2DisplayName provided for a non-UUID player2Id.");
    }

    const supabase = getSupabase();
    const inviteCode = generateCodeOnly || !player2Id 
      ? Array.from({ length: 6 }, () => 
          Math.floor(Math.random() * 36).toString(36)
        ).join('').toUpperCase()
      : null; 

    const gameStatus = player2Id ? 'active' : (generateCodeOnly ? 'waiting_for_code' : 'waiting');

    // Use Database['public']['Tables']['games']['Insert'] for stricter typing
    const insertData: Database['public']['Tables']['games']['Insert'] = {
      // Removed '!' - Requires correct type alignment or schema change
      ...(isUUID(player1Id) ? { player1_id: player1Id } : {}),
      // TODO: Add player1_display_name column to 'games' table via migration
      // ...(player1DisplayName ? { player1_display_name: player1DisplayName } : {}),
      game_mode: gameMode,
      status: gameStatus,
      ...(inviteCode ? { invite_code: inviteCode } : {}),
      // Removed '!' - Requires correct type alignment or schema change
      ...(player2Id && isUUID(player2Id) ? { player2_id: player2Id } : {}),
      // TODO: Add player2_display_name column to 'games' table via migration
      // ...(player2DisplayName ? { player2_display_name: player2DisplayName } : {}),
    };

    // Log the data being inserted for debugging
    console.log('[createGame] Inserting game data:', insertData);

    const { data, error } = await supabase
      .from('games')
      .insert(insertData) 
      .select()
      .single();

    if (error) {
      console.error('Error creating game:', error);
      return { game: null, inviteCode: null };
    }
    
    console.log('[createGame] Game created successfully:', data);
    return { game: data, inviteCode }; 
  } catch (error) {
    console.error('Unexpected error in createGame:', error);
    return { game: null, inviteCode: null };
  }
}

export async function joinGame(inviteCode: string, userId: string): Promise<Game | null> {
  try {
    const supabase = getSupabase();
    const normalizedCode = inviteCode.trim().toUpperCase();
    console.log(`Attempting to join game with code: "${normalizedCode}", user ID: ${userId}`);
    
    // Rely solely on the direct update logic
    try {
        const { data: games, error: findError } = await supabase
            .from('games')
            .select('id, status, player1_id') 
            .ilike('invite_code', normalizedCode)
            .eq('status', 'waiting')
            .is('player2_id', null) 
            .limit(1);

        if (findError) throw findError;
        if (!games || games.length === 0) {
            console.log('No joinable game found with invite code.');
            return null;
        }
        const gameToJoin = games[0];

        if (gameToJoin.player1_id === userId) {
            console.warn('Player 1 cannot join their own game as Player 2.');
            return null;
        }

        const { data: updatedGame, error: updateError } = await supabase
            .from('games')
            .update({ player2_id: userId, status: 'active' })
            .eq('id', gameToJoin.id)
            .eq('status', 'waiting') // Atomicity check
            .select()
            .single();

        if (updateError) throw updateError;
        
        console.log('Successfully joined game via direct update:', updatedGame);
        return updatedGame;

    } catch (fallbackError) {
       console.error('Join game direct update error:', fallbackError);
       return null; 
    }
    
  } catch (error) {
    console.error('Unexpected error in joinGame:', error);
    return null;
  }
}

export async function recordGameMove(
  gameId: string, 
  userId: string, 
  row: number, 
  col: number, 
  movie: string,
  timeToAnswer: number
): Promise<GameMove | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('game_moves')
      .insert({
        game_id: gameId,
        user_id: userId,
        row,
        col,
        movie,
        time_to_answer: timeToAnswer
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording game move:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error in recordGameMove:', error);
    return null;
  }
}

export async function completeGame(gameId: string, winnerId: string | null): Promise<Game | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('games')
      .update({
        status: 'completed',
        winner_id: winnerId,
        completed_at: new Date().toISOString()
      })
      .eq('id', gameId)
      .select()
      .single();

    if (error) {
      console.error('Error completing game:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error in completeGame:', error);
    return null;
  }
}

// Badges functions
export async function getUserBadges(userId: string): Promise<UserBadge[] | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('user_badges')
      .select('*, badges(*)')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user badges:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error in getUserBadges:', error);
    return null;
  }
}

// Store and inventory functions
export async function getStoreItems(): Promise<StoreItem[] | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('store_items')
      .select('*');

    if (error) {
      console.error('Error fetching store items:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error in getStoreItems:', error);
    return null;
  }
}

export async function getUserInventory(userId: string): Promise<UserInventory[] | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('user_inventory')
      .select('*, store_items (*)') // Fetch associated item details
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user inventory:', error);
      return null;
    }

    return data as UserInventory[]; // Adjust type assertion if needed
  } catch (error) {
    console.error('Unexpected error in getUserInventory:', error);
    return null;
  }
}

export async function purchaseItem(userId: string, itemId: number): Promise<boolean> {
  try {
    const supabase = getSupabase();

    // 1. Get the item price and user credits
    const { data: itemData, error: itemError } = await supabase
      .from('store_items')
      .select('price')
      .eq('id', itemId)
      .single();

    if (itemError || !itemData) {
      console.error('Error fetching item price:', itemError);
      throw new Error("Item not found or error fetching price.");
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user credits:', userError);
      throw new Error("User not found or error fetching credits.");
    }

    if (userData.credits < itemData.price) {
      console.log('Purchase failed: Not enough credits');
      throw new Error("Not enough credits to purchase this item.");
    }

    // Start transaction (conceptual, actual transaction done via RPC or backend logic)
    // Here we simulate by performing updates sequentially

    // Deduct credits
    const newCredits = userData.credits - itemData.price;
    const { error: updateCreditError } = await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('id', userId);

    if (updateCreditError) {
      console.error('Error updating credits:', updateCreditError);
      // Ideally, implement rollback logic here if possible
      throw new Error("Failed to update credits. Purchase cancelled.");
    }

    // 2. Add item to user's inventory
    const { error: inventoryError } = await supabase
      .from('user_inventory')
      .insert({ user_id: userId, item_id: itemId });

    if (inventoryError) {
      console.error('Error adding item to inventory:', inventoryError);
      // Attempt to roll back the credit change if the inventory add fails
      // This is a best-effort rollback in the absence of true transactions client-side
      await supabase
        .from('users')
        .update({ credits: userData.credits }) // Revert to original credits
        .eq('id', userId);
      throw new Error("Failed to add item to inventory after credit deduction. Purchase reverted. Please contact support.");
    }

    console.log(`Item ${itemId} purchased successfully by user ${userId}`);
    return true; // Purchase successful

  } catch (error) {
    console.error('Error in purchaseItem:', error);
    // Ensure the error message is propagated or handled appropriately
    // Re-throw the specific error message from the catch block
    throw error instanceof Error ? error : new Error("An unexpected error occurred during purchase.");
  }
}

// Friend functions
export async function getFriends(userId: string): Promise<User[] | null> {
  try {
    const supabase = getSupabase();
    
    // Query for friendships where the user is either the user_id or friend_id
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      
    if (friendshipsError) {
      console.error('Error fetching friendships:', friendshipsError);
      return null;
    }
    
    if (!friendships || friendships.length === 0) {
      return [];
    }
    
    // Get the IDs of all friends (either from user_id or friend_id)
    const friendIds = friendships.map(friendship => 
      friendship.user_id === userId ? friendship.friend_id : friendship.user_id
    );
    
    // Fetch user data for all friends
    const { data: friendData, error: userDataError } = await supabase
      .from('users')
      .select('*')
      .in('id', friendIds);
      
    if (userDataError) {
      console.error('Error fetching friend user data:', userDataError);
      return null;
    }
    
    return friendData;
  } catch (error) {
    console.error('Unexpected error in getFriends:', error);
    return null;
  }
}

export async function findUserByUsername(username: string): Promise<User | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('username', username)
      .maybeSingle();
    
    if (error) {
      console.error('Error finding user by username:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Unexpected error in findUserByUsername:', error);
    return null;
  }
}

export async function sendFriendRequest(userId: string, username: string): Promise<{ success: boolean, message: string, receiver?: { id: string, username: string } }> {
  try {
    const supabase = getSupabase();
    const receiver = await findUserByUsername(username);

    if (!receiver) {
      return { success: false, message: "User not found" };
    }

    if (receiver.id === userId) {
      return { success: false, message: "You cannot send a friend request to yourself" };
    }

    // Check if already friends
    const { count: friendCount, error: friendCheckError } = await supabase
      .from('friendships')
      .select('* ', { count: 'exact', head: true })
      .or(`(user_id.eq.${userId}, friend_id.eq.${receiver.id}), (user_id.eq.${receiver.id}, friend_id.eq.${userId})`);

    if (friendCheckError) {
      console.error('Error checking friendship:', friendCheckError);
      return { success: false, message: "Failed to check friendship status." };
    }

    if (friendCount && friendCount > 0) {
      return { success: false, message: "You are already friends with this user." };
    }

    // Check for existing pending request
    const { count: requestCount, error: requestCheckError } = await supabase
      .from('friend_requests')
      .select('* ', { count: 'exact', head: true })
      .or(`(sender_id.eq.${userId}, receiver_id.eq.${receiver.id}), (sender_id.eq.${receiver.id}, receiver_id.eq.${userId})`)
      .eq('status', 'pending');

    if (requestCheckError) {
      console.error('Error checking friend requests:', requestCheckError);
      return { success: false, message: "Failed to check existing requests." };
    }

    if (requestCount && requestCount > 0) {
      return { success: false, message: "Friend request already pending." };
    }

    // Send request
    const { error: insertError } = await supabase
      .from('friend_requests')
      .insert({ sender_id: userId, receiver_id: receiver.id, status: 'pending' });

    if (insertError) {
      console.error('Error sending friend request:', insertError);
      return { success: false, message: "Failed to send friend request." };
    }

    return { success: true, message: "Friend request sent", receiver: { id: receiver.id, username: receiver.username } };

  } catch (error: unknown) { // Change any to unknown
    console.error('Unexpected error in sendFriendRequest:', error);
    return { success: false, message: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function getFriendRequests(userId: string): Promise<FriendRequest[] | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        *,
        sender:"sender_id" (id, username, avatar_url),
        receiver:"receiver_id" (id, username, avatar_url)
      `)
      .or(`receiver_id.eq.${userId},sender_id.eq.${userId}`)
      .neq('status', 'friends'); 

    if (error) {
        console.error('Error fetching friend requests:', error);
        return null; 
    }
    // TODO: Fix relationship query/schema for sender/receiver. Casting to unknown first.
    // The SelectQueryError indicates Supabase cannot determine the relationship.
    // Verify FK constraints between friend_requests and users.
    // Consider restructuring the query if schema is correct.
    return data as unknown as FriendRequest[] | null; // Cast via unknown
  } catch (error) {
    console.error('Unexpected error in getFriendRequests:', error);
    return null;
  }
}

export async function respondToFriendRequest(requestId: number, userId: string, accept: boolean): Promise<{ success: boolean, message: string }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .rpc('respond_to_friend_request', {
        request_id_param: requestId, // Renamed param
        user_id_param: userId,     // Renamed param
        accept: accept
      });

    if (error) {
      console.error('Error responding to friend request via RPC:', error);
      return { success: false, message: error.message || 'RPC error' };
    }

    // Cast the result to the expected type
    const result = data as { success: boolean, message: string }; 

    if (!result || typeof result.success !== 'boolean') {
        console.error('Invalid response from respond_to_friend_request RPC:', result);
        return { success: false, message: 'Invalid response from server.' };
    }

    return result;

  } catch (error) {
    console.error('Unexpected error in respondToFriendRequest:', error);
    return { success: false, message: 'Unexpected server error' };
  }
}

export async function deleteFriendship(userId: string, friendId: string): Promise<boolean> {
  try {
    // Add null checks for safety
    if (!userId || !friendId) {
        console.error('deleteFriendship requires valid userId and friendId.');
        return false;
    }
    const supabase = getSupabase();
    // Reverted to using .delete() as RPC name was invalid
    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(`(user_id.eq.${userId},friend_id.eq.${friendId}),(user_id.eq.${friendId},friend_id.eq.${userId})`);

    if (error) {
      console.error('Error deleting friendship:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error in deleteFriendship:', error);
    return false;
  }
}

export async function sendGameInvite(senderId: string, receiverId: string, gameId: string): Promise<{ success: boolean, message: string }> {
  try {
    const supabase = getSupabase();

    // Check for existing pending invite
    const { count, error: checkError } = await supabase
      .from('game_invites')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId)
      .eq('game_id', gameId)
      .eq('status', 'pending');
    
    if (checkError) {
      console.error("Error checking for existing game invite:", checkError);
      return { success: false, message: "Failed to check for existing invites." };
    }
    
    if (count && count > 0) {
      return { success: false, message: "Invite already sent and pending." };
    }

    // Send invite
    const { error } = await supabase
      .from('game_invites')
      .insert({ 
        sender_id: senderId, 
        receiver_id: receiverId, 
        game_id: gameId, 
        status: 'pending' 
      });

    if (error) {
      console.error('Error sending game invite:', error);
      return { success: false, message: "Failed to send game invite." };
    }

    return { success: true, message: "Game invite sent successfully!" };
  } catch (error: unknown) { // Change any to unknown
    console.error('Unexpected error in sendGameInvite:', error);
    return { success: false, message: "An unexpected error occurred." };
  }
}

export async function getGameInvites(userId: string): Promise<GameInvite[] | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('game_invites')
      .select(`
        *,
        sender: users!sender_id ( id, username, avatar_url, online_status ),
        receiver: users!receiver_id ( id, username, avatar_url, online_status ),
        game: games ( id, game_mode, status )
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching game invites:', error);
      return null;
    }
    return data as GameInvite[] | null;
  } catch (error: unknown) {
    console.error('Unexpected error in getGameInvites:', error);
    return null;
  }
}

export async function respondToGameInvite(inviteId: number, userId: string, accept: boolean): Promise<boolean> {
  try {
    const supabase = getSupabase();
    
    const { data: invite, error: fetchError } = await supabase
      .from('game_invites')
      .select('id, sender_id, receiver_id, game_id, status')
      .eq('id', inviteId)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .single(); // Removed explicit type cast here, rely on inference
      
    if (fetchError || !invite || !invite.game_id) { // Added null check for invite.game_id
      console.error('Error fetching game invite or invite missing game_id:', fetchError);
      return false;
    }
    
    // Update invite status
    const newStatus = accept ? 'accepted' : 'rejected';
    const { error: updateError } = await supabase
      .from('game_invites')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', inviteId);
      
    if (updateError) {
      console.error('Error updating game invite status:', updateError);
      return false;
    }
    
    // If accepted, update the game to add the user as player2
    if (accept) {
      // invite.game_id is now checked for null above
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('id, status, player1_id, player2_id')
        .eq('id', invite.game_id) // Use checked game_id
        .single();
        
      if (gameError || !game) {
        console.error('Error fetching game associated with invite:', gameError);
        // Consider if invite status should be reverted
        return false;
      }
      
      // Only update if the game is still waiting
      if (game.status === 'waiting' && !game.player2_id) {
        // invite.game_id is checked for null above
        const { error: joinError } = await supabase
          .from('games')
          .update({ 
            player2_id: userId, 
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', invite.game_id); // Use checked game_id
          
        if (joinError) {
          console.error('Error joining game after accepting invite:', joinError);
          // Consider if invite status should be reverted
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error in respondToGameInvite:', error);
    return false;
  }
}

/**
 * Fetches the recent game history for a specific user.
 * @param userId The ID of the user whose game history is being fetched.
 * @param limit The maximum number of recent games to fetch (default: 5).
 * @returns A promise that resolves to an array of GameHistoryItem objects or null if an error occurs.
 */
export interface GameHistoryItem {
  id: string;
  opponentUsername: string;
  opponentAvatarUrl: string | null;
  result: "win" | "loss" | "draw";
  completedAt: string;
  gameMode: string;
}

export async function getGameHistory(userId: string, limit: number = 5): Promise<GameHistoryItem[] | null> {
  try {
    // Add null check for userId
    if (!userId) {
        console.error('getGameHistory requires a valid userId.');
        return null;
    }
    const supabase = getSupabase();
    const { data: games, error } = await supabase
      .from('games')
      .select(`
        id,
        player1_id,
        player2_id,
        winner_id,
        completed_at,
        game_mode,
        player1:users!games_player1_id_fkey(username, avatar_url),
        player2:users!games_player2_id_fkey(username, avatar_url)
      `)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .eq('status', 'completed')
      .not('completed_at', 'is', null) // Ensure game is actually completed
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching game history:', error);
      return null;
    }

    if (!games) {
      return [];
    }
    
    // Process the data into the desired format
    const history: GameHistoryItem[] = games.map(game => {
      const isPlayer1 = game.player1_id === userId;
      const opponent = isPlayer1 ? game.player2 : game.player1;
      const opponentUsername = opponent?.username ?? 'Opponent';
      const opponentAvatarUrl = opponent?.avatar_url ?? null;
      let result: "win" | "loss" | "draw";

      if (game.winner_id === null) {
        result = "draw";
      } else if (game.winner_id === userId) {
        result = "win";
      } else {
        result = "loss";
      }

      return {
        id: game.id,
        opponentUsername: opponentUsername,
        opponentAvatarUrl: opponentAvatarUrl,
        result: result,
        completedAt: game.completed_at!, // Not null because of the filter
        gameMode: game.game_mode ?? 'casual'
      };
    }).filter(item => item !== null) as GameHistoryItem[]; // Filter out any nulls just in case

    return history;
  } catch (error) {
    console.error('Unexpected error in getGameHistory:', error);
    return null;
  }
}
