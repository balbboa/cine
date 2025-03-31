import { nanoid } from 'nanoid';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { createGame } from './db';

// Types for matchmaking system
export interface MatchmakingUser {
  id: string;
  name: string;
  isGuest: boolean;
  timestamp: number;
  rating?: number; // Optional for ranked matches
  onMatchFound?: (gameId: string) => void;
  onStatusUpdate?: (status: MatchmakingStatus) => void;
}

export enum MatchmakingStatus {
  IDLE = 'idle',
  SEARCHING = 'searching',
  FOUND = 'found',
  ERROR = 'error'
}

export enum MatchType {
  QUICK = 'quick',
  RANKED = 'ranked'
}

interface MatchmakingPool {
  users: Map<string, MatchmakingUser>;
  checkIntervalId?: NodeJS.Timeout;
}

// Singleton for matchmaking pools
class MatchmakingService {
  private static instance: MatchmakingService;
  private quickMatchPool: MatchmakingPool = { users: new Map() };
  private rankedMatchPool: MatchmakingPool = { users: new Map() };
  private readonly CHECK_INTERVAL = 2000; // Check every 2 seconds
  private readonly TIMEOUT_THRESHOLD = 60000; // 1 minute timeout

  private constructor() {
    // Start the match checking process for both pools
    this.startMatchChecking(MatchType.QUICK);
    this.startMatchChecking(MatchType.RANKED);
  }

  public static getInstance(): MatchmakingService {
    if (!MatchmakingService.instance) {
      MatchmakingService.instance = new MatchmakingService();
    }
    return MatchmakingService.instance;
  }

  /**
   * Add a user to the appropriate matchmaking pool
   */
  public joinMatchmaking(
    matchType: MatchType,
    user: SupabaseUser | null,
    options: {
      guestName?: string;
      rating?: number;
      onMatchFound?: (gameId: string) => void;
      onStatusUpdate?: (status: MatchmakingStatus) => void;
    } = {}
  ): string {
    const isGuest = !user;
    const userId = user?.id || nanoid();
    const userName = user?.user_metadata?.full_name || options.guestName || 'Guest';
    
    const matchmakingUser: MatchmakingUser = {
      id: userId,
      name: userName,
      isGuest,
      timestamp: Date.now(),
      rating: matchType === MatchType.RANKED ? options.rating || 1000 : undefined,
      onMatchFound: options.onMatchFound,
      onStatusUpdate: options.onStatusUpdate
    };

    // Add to appropriate pool
    if (matchType === MatchType.QUICK) {
      this.quickMatchPool.users.set(userId, matchmakingUser);
    } else {
      this.rankedMatchPool.users.set(userId, matchmakingUser);
    }

    // Notify the user they're now searching
    if (options.onStatusUpdate) {
      options.onStatusUpdate(MatchmakingStatus.SEARCHING);
    }

    // Return the user ID for reference (to leave the queue later)
    return userId;
  }

  /**
   * Remove a user from matchmaking
   */
  public leaveMatchmaking(matchType: MatchType, userId: string): boolean {
    if (matchType === MatchType.QUICK) {
      return this.quickMatchPool.users.delete(userId);
    } else {
      return this.rankedMatchPool.users.delete(userId);
    }
  }

  /**
   * Get current status of matchmaking for a user
   */
  public getMatchmakingStatus(matchType: MatchType, userId: string): MatchmakingStatus {
    const pool = matchType === MatchType.QUICK ? this.quickMatchPool : this.rankedMatchPool;
    return pool.users.has(userId) ? MatchmakingStatus.SEARCHING : MatchmakingStatus.IDLE;
  }

  /**
   * Get number of users in a matchmaking pool
   */
  public getPoolSize(matchType: MatchType): number {
    return matchType === MatchType.QUICK 
      ? this.quickMatchPool.users.size 
      : this.rankedMatchPool.users.size;
  }

  /**
   * Start the periodic checking for matches
   */
  private startMatchChecking(matchType: MatchType): void {
    const pool = matchType === MatchType.QUICK ? this.quickMatchPool : this.rankedMatchPool;
    
    // Clear any existing interval
    if (pool.checkIntervalId) {
      clearInterval(pool.checkIntervalId);
    }
    
    // Set up the new checking interval
    pool.checkIntervalId = setInterval(() => {
      this.checkForMatches(matchType);
      this.checkForTimeouts(matchType);
    }, this.CHECK_INTERVAL);
  }

  /**
   * Check for potential matches in the pool
   */
  private async checkForMatches(matchType: MatchType): Promise<void> {
    const pool = matchType === MatchType.QUICK ? this.quickMatchPool : this.rankedMatchPool;
    const users = Array.from(pool.users.values());
    
    // Need at least 2 users to make a match
    if (users.length < 2) return;

    // For quick matches, just pair the oldest two users
    if (matchType === MatchType.QUICK) {
      const [player1, player2] = users
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, 2);
        
      await this.createMatch(player1, player2, matchType);
    } 
    // For ranked matches, try to match users with similar ratings
    else {
      users.sort((a, b) => a.timestamp - b.timestamp);
      
      for (let i = 0; i < users.length - 1; i++) {
        const player1 = users[i];
        
        // Skip if this player was already matched
        if (!pool.users.has(player1.id)) continue;
        
        // Find the closest match by rating, prioritizing wait time
        const waitTime = Date.now() - player1.timestamp;
        const ratingTolerance = Math.min(200, Math.floor(waitTime / 1000) * 10);
        
        let bestMatch: MatchmakingUser | null = null;
        let lowestRatingDiff = Infinity;
        
        for (let j = i + 1; j < users.length; j++) {
          const player2 = users[j];
          
          // Skip if this player was already matched
          if (!pool.users.has(player2.id)) continue;
          
          const ratingDiff = Math.abs((player1.rating || 1000) - (player2.rating || 1000));
          
          if (ratingDiff <= ratingTolerance && ratingDiff < lowestRatingDiff) {
            bestMatch = player2;
            lowestRatingDiff = ratingDiff;
          }
        }
        
        if (bestMatch) {
          await this.createMatch(player1, bestMatch, matchType);
        }
      }
    }
  }

  /**
   * Check for users who have been waiting too long
   */
  private checkForTimeouts(matchType: MatchType): void {
    const pool = matchType === MatchType.QUICK ? this.quickMatchPool : this.rankedMatchPool;
    const now = Date.now();
    
    pool.users.forEach((user, userId) => {
      const waitTime = now - user.timestamp;
      
      if (waitTime > this.TIMEOUT_THRESHOLD) {
        // Notify the user of timeout
        if (user.onStatusUpdate) {
          user.onStatusUpdate(MatchmakingStatus.ERROR);
        }
        
        // Remove the user from the pool
        pool.users.delete(userId);
      }
    });
  }

  /**
   * Create a match between two users
   */
  private async createMatch(player1: MatchmakingUser, player2: MatchmakingUser, matchType: MatchType): Promise<void> {
    const pool = matchType === MatchType.QUICK ? this.quickMatchPool : this.rankedMatchPool;
    
    // Ensure players are still in the pool before proceeding
    if (!pool.users.has(player1.id) || !pool.users.has(player2.id)) {
      console.log("One or both players left the pool before match could be created.");
      // Ensure they are fully removed if somehow only one left
      pool.users.delete(player1.id);
      pool.users.delete(player2.id);
      return;
    }
    
    // --- Uncomment Guest Handling ---
    // Handle guest limitation - Now handled by createGame setting playerX_id to NULL
    // if (player1.isGuest || player2.isGuest) { ... } // Keep commented if createGame handles it fully
    // --- End Uncomment ---

    // If we reach here, both players are authenticated or guests
    try {
      // Update status visually (optimistic)
      [player1, player2].forEach(player => {
        if (player.onStatusUpdate) {
          player.onStatusUpdate(MatchmakingStatus.FOUND);
        }
      });
      
      // Remove players from pool immediately to prevent re-matching
      pool.users.delete(player1.id);
      pool.users.delete(player2.id);
      
      console.log(`Attempting to create ${matchType} match between ${player1.name} (${player1.id}) and ${player2.name} (${player2.id})`);

      // Determine game mode for createGame
      const gameMode = matchType === MatchType.RANKED ? 'ranked' : 'casual';

      // Call the updated createGame with both player IDs and display names
      const { game } = await createGame(
        player1.id, 
        player1.name, // Pass player 1 display name
        gameMode,
        false, // generateCodeOnly = false
        player2.id, // Pass player 2 ID
        player2.name // Pass player 2 display name
      );

      if (game && game.id) {
        console.log(`Match created successfully! Game ID: ${game.id}`);
        // Notify both players of the successful match with the game ID
        [player1, player2].forEach(player => {
          if (player.onMatchFound) {
            player.onMatchFound(game.id); // Pass the game ID
          }
        });
      } else {
        // Game creation failed
        throw new Error('Failed to create game in database after matching.');
      }
    } catch (error) {
      console.error('Error during match creation process:', error);
      // Notify players of the error if they weren't already removed or notified
      // They were removed optimistically, so just log the error server-side
      [player1, player2].forEach(player => {
          // Attempt to notify via status update if the callback exists
          if (player.onStatusUpdate) { 
              // Check if they are still technically associated with the service instance,
              // although they are removed from the pool map.
              // A more robust system might track notification attempts.
              try {
                 player.onStatusUpdate(MatchmakingStatus.ERROR); 
              } catch (callbackError) {
                 console.error(`Error calling onStatusUpdate for player ${player.id}:`, callbackError);
              }
          }
      });
      // Since players were removed optimistically, no need to remove again.
    }
  }
}

// Export functions to interact with the matchmaking service

/**
 * Join a matchmaking queue (quick or ranked)
 */
export function joinMatchmaking(
  matchType: MatchType,
  user: SupabaseUser | null,
  options: {
    guestName?: string;
    rating?: number;
    onMatchFound?: (gameId: string) => void;
    onStatusUpdate?: (status: MatchmakingStatus) => void;
  } = {}
): string {
  return MatchmakingService.getInstance().joinMatchmaking(matchType, user, options);
}

/**
 * Leave a matchmaking queue
 */
export function leaveMatchmaking(matchType: MatchType, userId: string): boolean {
  return MatchmakingService.getInstance().leaveMatchmaking(matchType, userId);
}

/**
 * Get the current status of a user in matchmaking
 */
export function getMatchmakingStatus(matchType: MatchType, userId: string): MatchmakingStatus {
  return MatchmakingService.getInstance().getMatchmakingStatus(matchType, userId);
}

/**
 * Get the number of users currently in a matchmaking queue
 */
export function getPoolSize(matchType: MatchType): number {
  return MatchmakingService.getInstance().getPoolSize(matchType);
}

