import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel, SupabaseClient, User } from '@supabase/supabase-js';

// Types for matchmaking system
export enum MatchmakingStatus {
  IDLE = 'idle',
  SEARCHING = 'searching',
  FOUND = 'found',
  ERROR = 'error',
  TIMEOUT = 'timeout'
}

export enum MatchType {
  QUICK = 'quick',
  RANKED = 'ranked'
}

export interface MatchmakingUser {
  id: string;
  username: string;
  rating?: number;
  isGuest?: boolean;
}

interface MatchmakingCallbacks {
  onMatchFound?: (gameId: string) => void;
  onStatusUpdate?: (status: MatchmakingStatus, data?: unknown) => void;
}

interface MatchmakingOptions extends MatchmakingCallbacks {
  guestName?: string;
  rating?: number;
}

/**
 * Type guard to check if the user object has a username property
 */
function isMatchmakingUser(user: MatchmakingUser | User | null): user is MatchmakingUser {
  return Boolean(user && typeof user === 'object' && 'username' in user);
}

// Class to manage matchmaking using Supabase
export class SupabaseMatchmaking {
  private supabase: SupabaseClient;
  private userId: string | null = null;
  private matchType: MatchType | null = null;
  private subscriptionChannel: RealtimeChannel | null = null;
  private callbacks: MatchmakingCallbacks = {};
  private pollingInterval: NodeJS.Timeout | null = null;
  private isGuest: boolean = false;
  
  constructor() {
    this.supabase = createClient();
  }
  
  /**
   * Join the matchmaking queue
   */
  public async joinMatchmaking(
    matchType: MatchType, 
    user: MatchmakingUser | User | null,
    options: MatchmakingOptions = {}
  ): Promise<string> {
    // Store callbacks
    this.callbacks = {
      onMatchFound: options.onMatchFound,
      onStatusUpdate: options.onStatusUpdate
    };
    
    // Get user details
    const isGuest = !user;
    
    // Use type guard to check for username property
    const username = isMatchmakingUser(user) 
      ? user.username
      : options.guestName || 'Guest';
    
    this.isGuest = isGuest;
    
    try {
      // Notify that we're starting to search
      if (this.callbacks.onStatusUpdate) {
        this.callbacks.onStatusUpdate(MatchmakingStatus.SEARCHING);
      }
      
      // Use Supabase function to join the queue
      const { data, error } = await this.supabase.rpc(
        'join_matchmaking',
        {
          p_match_type: matchType,
          p_is_guest: isGuest,
          p_username: username,
          p_rating: options.rating
        }
      );
      
      if (error) {
        console.error('Error joining matchmaking:', error);
        if (this.callbacks.onStatusUpdate) {
          this.callbacks.onStatusUpdate(MatchmakingStatus.ERROR, error);
        }
        throw error;
      }
      
      if (!data) {
        throw new Error('No user ID returned from join_matchmaking');
      }
      
      // Store user ID and match type
      this.userId = data as string;
      this.matchType = matchType;
      
      // Set up realtime subscription
      this.setupRealtimeSubscription();
      
      // Start polling for status updates
      this.startStatusPolling();
      
      return this.userId;
    } catch (error) {
      console.error('Error in joinMatchmaking:', error);
      if (this.callbacks.onStatusUpdate) {
        this.callbacks.onStatusUpdate(MatchmakingStatus.ERROR, error);
      }
      throw error;
    }
  }
  
  /**
   * Leave the matchmaking queue
   */
  public async leaveMatchmaking(): Promise<boolean> {
    try {
      // Clear polling and subscription
      this.clearPollingAndSubscription();
      
      if (!this.userId) {
        return false;
      }
      
      // Use Supabase function to leave the queue
      const { data, error } = await this.supabase.rpc(
        'leave_matchmaking',
        {
          p_user_id: this.userId
        }
      );
      
      if (error) {
        console.error('Error leaving matchmaking:', error);
        return false;
      }
      
      // Reset state
      this.userId = null;
      this.matchType = null;
      this.callbacks = {};
      
      return Boolean(data);
    } catch (error) {
      console.error('Error in leaveMatchmaking:', error);
      return false;
    }
  }
  
  /**
   * Get current matchmaking status
   */
  public async getMatchmakingStatus(): Promise<Record<string, unknown>> {
    if (!this.userId) {
      return { status: MatchmakingStatus.IDLE, in_queue: false };
    }
    
    try {
      const { data, error } = await this.supabase.rpc(
        'get_matchmaking_status',
        {
          p_user_id: this.userId
        }
      );
      
      if (error) {
        console.error('Error getting matchmaking status:', error);
        return { status: MatchmakingStatus.ERROR, in_queue: false };
      }
      
      return data as Record<string, unknown>;
    } catch (error) {
      console.error('Error in getMatchmakingStatus:', error);
      return { status: MatchmakingStatus.ERROR, in_queue: false };
    }
  }
  
  /**
   * Get number of users in a matchmaking pool
   */
  public async getPoolSize(matchType: MatchType): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc(
        'get_pool_size',
        {
          p_match_type: matchType
        }
      );
      
      if (error) {
        console.error('Error getting pool size:', error);
        return 0;
      }
      
      return data as number;
    } catch (error) {
      console.error('Error in getPoolSize:', error);
      return 0;
    }
  }
  
  /**
   * Setup realtime subscription to matchmaking queue changes
   */
  private setupRealtimeSubscription(): void {
    // Clear existing subscription
    if (this.subscriptionChannel) {
      this.supabase.removeChannel(this.subscriptionChannel);
      this.subscriptionChannel = null;
    }
    
    if (!this.userId) {
      return;
    }
    
    // Channel name must be unique, so include user ID
    const channelName = `matchmaking:${this.userId}`;
    
    this.subscriptionChannel = this.supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matchmaking_queue',
        filter: `user_id=eq.${this.userId}`
      }, this.handleRealtimeUpdate.bind(this))
      .subscribe((status) => {
        console.log(`Realtime subscription status: ${status}`);
      });
  }
  
  /**
   * Handle realtime updates from Supabase
   */
  private handleRealtimeUpdate(payload: {
    new: Record<string, unknown> | null;
    old: Record<string, unknown> | null;
  }): void {
    console.log('Realtime update:', payload);
    
    const { new: newRecord, old: oldRecord } = payload;
    
    // If the record was deleted or not found
    if (!newRecord && oldRecord) {
      if (this.callbacks.onStatusUpdate) {
        this.callbacks.onStatusUpdate(MatchmakingStatus.IDLE);
      }
      return;
    }
    
    if (!newRecord) return;
    
    // Get the current status
    const status = newRecord.status as string;
    
    if (status === 'found' && newRecord.game_id) {
      // We found a match!
      console.log('Match found!', newRecord.game_id);
      
      // Call the onMatchFound callback
      if (this.callbacks.onMatchFound) {
        this.callbacks.onMatchFound(newRecord.game_id as string);
      }
      
      // Update status
      if (this.callbacks.onStatusUpdate) {
        this.callbacks.onStatusUpdate(MatchmakingStatus.FOUND, newRecord);
      }
      
      // Clear polling and subscription
      this.clearPollingAndSubscription();
    } else if (status === 'error' || status === 'timeout') {
      // Handle error or timeout
      if (this.callbacks.onStatusUpdate) {
        this.callbacks.onStatusUpdate(
          status === 'error' ? MatchmakingStatus.ERROR : MatchmakingStatus.TIMEOUT,
          newRecord
        );
      }
      
      // Clear polling and subscription
      this.clearPollingAndSubscription();
    } else if (status === 'searching') {
      // Still searching
      if (this.callbacks.onStatusUpdate) {
        this.callbacks.onStatusUpdate(MatchmakingStatus.SEARCHING, newRecord);
      }
    }
  }
  
  /**
   * Start polling for status updates
   * This is a backup in case realtime subscription misses an update
   */
  private startStatusPolling(): void {
    // Clear existing polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    // Poll every 5 seconds
    this.pollingInterval = setInterval(async () => {
      try {
        const status = await this.getMatchmakingStatus();
        
        if (status.status === 'found' && status.game_id) {
          // We found a match!
          console.log('Match found via polling!', status.game_id);
          
          // Call the onMatchFound callback
          if (this.callbacks.onMatchFound) {
            this.callbacks.onMatchFound(status.game_id as string);
          }
          
          // Update status
          if (this.callbacks.onStatusUpdate) {
            this.callbacks.onStatusUpdate(MatchmakingStatus.FOUND, status);
          }
          
          // Clear polling and subscription
          this.clearPollingAndSubscription();
        } else if (status.status === 'error' || status.status === 'timeout') {
          // Handle error or timeout
          if (this.callbacks.onStatusUpdate) {
            this.callbacks.onStatusUpdate(
              status.status === 'error' ? MatchmakingStatus.ERROR : MatchmakingStatus.TIMEOUT,
              status
            );
          }
          
          // Clear polling and subscription
          this.clearPollingAndSubscription();
        }
      } catch (error) {
        console.error('Error polling matchmaking status:', error);
      }
    }, 5000);
  }
  
  /**
   * Clear polling and subscription
   */
  private clearPollingAndSubscription(): void {
    // Clear polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    // Clear subscription
    if (this.subscriptionChannel) {
      this.supabase.removeChannel(this.subscriptionChannel);
      this.subscriptionChannel = null;
    }
  }
}

// Create singleton instance
const matchmakingService = new SupabaseMatchmaking();

// Export wrapper functions for easier use
export const joinMatchmaking = (
  matchType: MatchType,
  user: MatchmakingUser | User | null,
  options: MatchmakingOptions = {}
): Promise<string> => {
  return matchmakingService.joinMatchmaking(matchType, user, options);
};

export const leaveMatchmaking = (): Promise<boolean> => {
  return matchmakingService.leaveMatchmaking();
};

export const getMatchmakingStatus = (): Promise<Record<string, unknown>> => {
  return matchmakingService.getMatchmakingStatus();
};

export const getPoolSize = (matchType: MatchType): Promise<number> => {
  return matchmakingService.getPoolSize(matchType);
}; 