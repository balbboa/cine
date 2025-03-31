'use client'

import { createClient } from './supabase/client'
import type { Database } from '@/types/database.types'
// Remove Game import if register/join functions are removed and Game type isn't needed elsewhere
// import type { Game } from './db'

// Simple storage to keep track of recent invite codes
interface InviteCodeCache {
  [code: string]: {
    gameId: string;
    timestamp: number;
  }
}

// Use a client-side cache to store recent invite codes
const getInviteCodeCache = (): InviteCodeCache => {
  if (typeof window === 'undefined') return {};
  
  const cached = localStorage.getItem('invite-code-cache');
  if (!cached) return {};
  
  try {
    return JSON.parse(cached);
  } catch {
    return {};
  }
}

const setInviteCodeCache = (code: string, gameId: string) => {
  if (typeof window === 'undefined') return;
  
  const cache = getInviteCodeCache();
  
  // Add the new code
  cache[code.toUpperCase()] = {
    gameId,
    timestamp: Date.now()
  };
  
  // Clean up old codes (older than 24 hours)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  Object.keys(cache).forEach(key => {
    if (cache[key].timestamp < oneDayAgo) {
      delete cache[key];
    }
  });
  
  localStorage.setItem('invite-code-cache', JSON.stringify(cache));
}

// Generate a random invite code
export const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters
  let result = '';
  
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

// Removed redundant registerGameWithInviteCode function
// Use createGame from lib/db.ts instead
/*
export const registerGameWithInviteCode = async (
  userId: string,
  gameMode: string = 'casual'
): Promise<{ game: Game | null, inviteCode: string }> => { ... }
*/

// Get a game ID from an invite code, either from cache or by querying
export const getGameIdFromInviteCode = async (inviteCode: string): Promise<string | null> => {
  const normalizedCode = inviteCode.trim().toUpperCase();
  
  // First check the cache
  const cache = getInviteCodeCache();
  const cachedItem = cache[normalizedCode];
  
  if (cachedItem?.gameId) {
    // Optional: Add a check here to ensure the cached game still exists/is valid if needed
    console.log('Found game ID in cache:', cachedItem.gameId);
    return cachedItem.gameId;
  }
  
  // If not in cache, try to find it via direct query
  try {
    const supabase = createClient();
    const { data: games, error } = await supabase
      .from('games')
      .select('id') // Only select the ID
      .ilike('invite_code', normalizedCode)
      // Add status check if we only want joinable games?
      // .eq('status', 'waiting') 
      .limit(1);
    
    if (!error && games && games.length > 0) {
      const gameId = games[0].id;
      // Add to cache for future use
      setInviteCodeCache(normalizedCode, gameId);
      return gameId;
    }
    
    // Remove the non-existent RPC call block
    /*
    try {
      const { data: gameData, error: rpcError } = await supabase.rpc('get_game_by_invite_code', { ... });
      // ... rest of RPC logic ...
    } catch (rpcError) {
      console.warn('RPC error:', rpcError);
    }
    */
    
    if (error) {
        console.error('Error finding game by invite code query:', error);
    } else {
        console.log('No game found with invite code via query:', normalizedCode);
    }
    return null;
  } catch (error) {
    console.error('Unexpected error finding game by invite code:', error);
    return null;
  }
}

// Define a type for Game based on the database schema
export type Game = Database['public']['Tables']['games']['Row'];

// Join a game by invite code
export const joinGameByInviteCode = async (inviteCode: string, userId: string): Promise<Game | null> => {
  try {
    const gameId = await getGameIdFromInviteCode(inviteCode);
    
    if (!gameId) {
      console.error('No game found with invite code:', inviteCode);
      return null;
    }
    
    const supabase = createClient();
    
    // Check if the game allows joining
    const { data: game, error: getError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (getError || !game) {
      console.error('Error fetching game details:', getError);
      return null;
    }
    
    if (game.player1_id === userId || game.player2_id === userId) {
      console.log('User is already in this game');
      return game;
    }
    
    if (game.player2_id && game.player1_id !== userId) {
      console.error('Game is already full');
      return null;
    }
    
    // Join the game as player 2 if possible
    const { data: updatedGame, error: updateError } = await supabase
      .from('games')
      .update({ player2_id: userId, status: 'active' })
      .eq('id', gameId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error joining game:', updateError);
      return null;
    }
    
    return updatedGame;
  } catch (error) {
    console.error('Unexpected error joining game:', error);
    return null;
  }
} 