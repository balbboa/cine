import { useState, useEffect, useRef } from 'react';
import { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js';
import { supabase } from '../lib/db';

type EventCallback = (payload: any) => void;

interface EventSubscription {
  event: string;
  originalCallback: EventCallback;
  wrappedCallback: EventCallback;
  active: boolean;
}

interface ChannelInterface {
  on: (event: string, callback: EventCallback) => ChannelInterface;
  off: (event: string) => ChannelInterface;
  push: (event: string, payload: any) => Promise<RealtimeChannelSendResponse>;
}

interface UseChannelReturn {
  channel: ChannelInterface | null;
  error: Error | null;
}

export function useChannel(channelName: string): UseChannelReturn {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [channelInterface, setChannelInterface] = useState<ChannelInterface | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionsRef = useRef<EventSubscription[]>([]);

  useEffect(() => {
    try {
      // Create a Supabase Realtime channel
      const supabaseChannel = supabase.channel(channelName);

      // Create a wrapper interface around the Supabase channel that has the expected methods
      const wrapper: ChannelInterface = {
        on: (event: string, callback: EventCallback) => {
          // Create a wrapped callback that checks if the subscription is active
          const wrappedCallback: EventCallback = (payload: any) => {
            // Find the subscription in our registry
            const subscription = subscriptionsRef.current.find(
              sub => sub.event === event && sub.originalCallback === callback
            );
            
            // Only execute callback if the subscription is active
            if (subscription && subscription.active) {
              callback(payload);
            }
          };
          
          // Register the subscription in our local registry
          subscriptionsRef.current.push({
            event,
            originalCallback: callback,
            wrappedCallback,
            active: true
          });
          
          // Register with Supabase using our wrapped callback
          supabaseChannel.on(event, wrappedCallback);
          return wrapper;
        },
        off: (event: string) => {
          // Mark all subscriptions for this event as inactive
          subscriptionsRef.current.forEach(subscription => {
            if (subscription.event === event) {
              subscription.active = false;
            }
          });
          return wrapper;
        },
        push: async (event: string, payload: any) => {
          return supabaseChannel.send({
            type: 'broadcast',
            event: event,
            payload: payload,
          });
        },
      };

      // Subscribe to the channel
      supabaseChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannel(supabaseChannel);
          setChannelInterface(wrapper);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setError(new Error(`Channel subscription failed with status: ${status}`));
        }
      });

      // Cleanup: Unsubscribe from the channel when component unmounts
      return () => {
        // Clear all subscriptions
        subscriptionsRef.current = [];
        supabaseChannel.unsubscribe();
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
    }
  }, [channelName]);

  return { channel: channelInterface, error };
}

