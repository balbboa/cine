'use client'

// Remove supabase import as it's no longer used for guest users
// import { supabase } from './db' 
// Keep randomUUID import if generateUUID needs it as a fallback
import { randomUUID } from 'crypto' 

export interface GuestUser {
  id: string;
  username: string;
  createdAt: string;
  isGuest: true;
  xp: number;
  wins: number;
  losses: number;
}

// Key for local storage
const GUEST_USER_KEY = 'cine-tac-toe-guest-user';
const GUEST_USER_DATA_KEY = 'cine-tac-toe-guest-user-data';

// Generate a random username
export function generateRandomUsername(): string {
  const adjectives = ['Happy', 'Sleepy', 'Grumpy', 'Sneezy', 'Bashful', 'Dopey', 'Doc', 'Clever', 'Swift', 'Brave'];
  const nouns = ['Panda', 'Tiger', 'Eagle', 'Dolphin', 'Lion', 'Wolf', 'Bear', 'Fox', 'Shark', 'Hawk'];
  
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNumber = Math.floor(Math.random() * 1000);
  
  return `${randomAdjective}${randomNoun}${randomNumber}`;
}

// Generate a UUID in browser environment
function generateUUID(): string {
  // Use crypto.randomUUID if available (preferred)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback using Node's crypto (might not work reliably in all browser contexts)
  // Consider a more robust browser UUID library if needed
  try {
    return randomUUID(); 
  } catch {
     // Final fallback (less ideal for uniqueness)
    console.warn("Using Math.random based UUID fallback");
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Local storage function to create a guest user
// Renamed from createLocalGuestUser as it's the only creation method now
function createLocalGuestUser(username?: string): GuestUser {
  const guestUsername = username?.trim() || generateRandomUsername();
  const id = generateUUID();
  const now = new Date().toISOString();
  
  const guestUser: GuestUser = {
    id,
    username: guestUsername,
    createdAt: now,
    isGuest: true,
    xp: 0,
    wins: 0,
    losses: 0
  };
  
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(GUEST_USER_KEY, id);
      localStorage.setItem(GUEST_USER_DATA_KEY, JSON.stringify(guestUser));
      console.log('Created local guest user:', guestUsername, id);
    } catch (error) {
      console.error("Error saving guest user to localStorage:", error);
      // Potentially return a default/error state or re-throw
    }
  } else {
     console.warn("Cannot create local guest user outside browser environment.");
     // Return a temporary user object or handle differently if needed server-side
  }
  
  return guestUser; 
}

// --- Public API for Guest Users (Now purely localStorage based) ---

// Create a new guest user using localStorage
export function createGuestUser(username?: string): GuestUser | null {
  // Directly call the local creation function
  // No need for async as localStorage is synchronous
  if (typeof window === 'undefined') {
      console.warn("Cannot create guest user outside browser environment.");
      return null; // Or handle server-side case appropriately
  }
  try {
    return createLocalGuestUser(username);
  } catch (error) {
    console.error("Failed to create guest user:", error);
    return null;
  }
}

// Get local guest user from localStorage
// Renamed from getLocalGuestUser as it's the only get method now
function getLocalGuestUser(): GuestUser | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const guestId = localStorage.getItem(GUEST_USER_KEY);
    // Also check if guest user data exists, as ID alone isn't enough
    const guestUserData = localStorage.getItem(GUEST_USER_DATA_KEY); 
    if (!guestId || !guestUserData) return null; 

    // Validate the stored ID matches the stored data ID
    const guestUser = JSON.parse(guestUserData) as GuestUser;
    if (guestUser.id !== guestId) {
        console.warn("Guest ID mismatch in localStorage. Clearing invalid data.");
        clearGuestUser(); // Clear inconsistent data
        return null;
    }
    return guestUser;
  } catch (error) {
    console.error('Error parsing local guest user data:', error);
    // Clear potentially corrupted data
    clearGuestUser();
    return null;
  }
}

// Get guest user from localStorage
export function getGuestUser(): GuestUser | null {
  // Directly call the local get function
  // No need for async
   if (typeof window === 'undefined') {
      console.warn("Cannot get guest user outside browser environment.");
      return null; 
  }
  return getLocalGuestUser();
}

// Update local guest user in localStorage
// Renamed from updateLocalGuestUser
function updateLocalGuestUser(updates: Partial<GuestUser>): GuestUser | null {
  const currentUser = getLocalGuestUser();
  // Prevent updating if no current user exists
  if (!currentUser) {
      console.warn("Cannot update non-existent guest user.");
      return null;
  }
  
  // Ensure ID and isGuest are not overwritten
  const safeUpdates = { ...updates };
  delete safeUpdates.id;
  delete safeUpdates.isGuest; // isGuest should always be true

  const updatedUser: GuestUser = {
    ...currentUser,
    ...safeUpdates // Apply only allowed updates
  };
  
  if (typeof window !== 'undefined') {
      try {
        // Ensure the correct key (ID) is used if it was potentially changed in updates
        localStorage.setItem(GUEST_USER_KEY, updatedUser.id); 
        localStorage.setItem(GUEST_USER_DATA_KEY, JSON.stringify(updatedUser));
      } catch (error) {
        console.error("Error saving updated guest user to localStorage:", error);
        return null; // Return null or the previous state?
      }
  } else {
      console.warn("Cannot update local guest user outside browser environment.");
      return null; // Cannot update outside browser
  }

  return updatedUser;
}

// Update guest user in localStorage
export function updateGuestUser(updates: Partial<GuestUser>): GuestUser | null {
  // Directly call the local update function
  // No need for async
  if (typeof window === 'undefined') {
      console.warn("Cannot update guest user outside browser environment.");
      return null;
  }
  return updateLocalGuestUser(updates);
}

// Clear guest user data from localStorage
export function clearGuestUser(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(GUEST_USER_KEY);
      localStorage.removeItem(GUEST_USER_DATA_KEY);
      console.log("Guest user data cleared from localStorage.");
    } catch (error) {
      console.error("Error clearing guest user data from localStorage:", error);
    }
  } else {
     console.warn("Cannot clear guest user data outside browser environment.");
  }
}

// Helper to add XP locally
export function addGuestXp(xpAmount: number): GuestUser | null {
  const currentUser = getLocalGuestUser();
  if (!currentUser) return null;
  
  const newXp = (currentUser.xp || 0) + xpAmount;
  return updateLocalGuestUser({ xp: newXp });
}

// Helper to record game result locally
export function recordGuestGameResult(won: boolean): GuestUser | null {
  const currentUser = getLocalGuestUser();
  if (!currentUser) return null;
  
  const updates: Partial<GuestUser> = {};
  if (won) {
    updates.wins = (currentUser.wins || 0) + 1;
  } else {
    updates.losses = (currentUser.losses || 0) + 1;
  }
  
  return updateLocalGuestUser(updates);
} 