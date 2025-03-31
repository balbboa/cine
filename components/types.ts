/**
 * Type definitions for the application
 * Based on database schema from lib/db.ts and lib/database.types.ts
 */

/**
 * User profile interface based on the Users table
 */
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  xp_to_next_level: number;
  wins: number;
  losses: number;
  credits: number;
  created_at: string;
  online_status?: string | null;
}

/**
 * Badge interface based on the Badges table
 */
export interface Badge {
  id: number;
  name: string;
  icon: string;
  description: string;
  created_at: string;
  earned_at?: string; // From UserBadge join
  user_id?: string;   // From UserBadge join
  badge_id?: number;  // From UserBadge join
}

/**
 * StoreItem interface to be used in InventoryItem
 */
export interface StoreItem {
  id: number;
  name: string;
  description: string;
  price: number;
  type: string;
  image_url: string | null;
  created_at: string;
}

/**
 * InventoryItem interface combining UserInventory with StoreItem details
 */
// REMOVE START
export interface InventoryItem {
  id: number;
  user_id: string;
  item_id: number;
  purchased_at: string;
  equipped: boolean;
  store_items: StoreItem; // The joined StoreItem details
}
// REMOVE END

