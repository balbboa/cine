import { useState, useEffect, useRef } from 'react';
import { RealtimeChannelSendResponse } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase/client';

type EventCallback = (payload: any) => void;

// Interface for our wrapper channel
interface ChannelInterface {
  on: (event: string, callback: EventCallback) => ChannelInterface;
  off: (event: string) => ChannelInterface;
  push: (event: string, payload: any) => Promise<RealtimeChannelSendResponse>;
}

// Return type for the hook
interface UseChannelReturn {
  channel: ChannelInterface | null;
  error: Error | null;
}

// Helper to track subscriptions
interface EventSubscription {
  event: string;
  callback: EventCallback;
  active: boolean;
}

export function useChannel(channelName: string): UseChannelReturn {
  const [wrapper, setWrapper] = useState<ChannelInterface | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionsRef = useRef<EventSubscription[]>([]);

  useEffect(() => {
    // Create a new Supabase client instance
    const supabase = createClient();
    
    try {
      // Create and subscribe to the channel right away
      const channel = supabase.channel(channelName);
      
      // Subscribe - this is a no argument function in Supabase v2
      channel.subscribe();
      
      // Create our wrapper with a simplified interface
      const channelWrapper: ChannelInterface = {
        on: (event: string, callback: EventCallback) => {
          // Register the callback in our registry
          subscriptionsRef.current.push({
            event,
            callback,
            active: true
          });
          
          // Add the listener to the actual channel
          // We ignore typing here since the Supabase types are complex
          (channel as any).on(event, callback);
          
          return channelWrapper;
        },
        
        off: (event: string) => {
          // Mark matching subscriptions as inactive
          subscriptionsRef.current.forEach(sub => {
            if (sub.event === event) {
              sub.active = false;
            }
          });
          
          return channelWrapper;
        },
        
        push: async (event: string, payload: any) => {
          return channel.send({
            type: 'broadcast',
            event: event,
            payload: payload,
          });
        }
      };
      
      // Store the wrapper
      setWrapper(channelWrapper);
      
      // Clean up on unmount
      return () => {
        subscriptionsRef.current = [];
        // Remove the channel from Supabase
        supabase.removeChannel(channel);
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create channel'));
      return () => {}; // Empty cleanup if setup failed
    }
  }, [channelName]);
  
  return { channel: wrapper, error };
}

