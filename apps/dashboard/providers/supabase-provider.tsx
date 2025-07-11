'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';

interface SupabaseContextType {
  isConnected: boolean;
  subscribeToSwarms: (callback: (payload: any) => void) => RealtimeChannel;
  subscribeToWorkers: (swarmId: string, callback: (payload: any) => void) => RealtimeChannel;
  subscribeToLogs: (swarmId: string, callback: (payload: any) => void) => RealtimeChannel;
}

const SupabaseContext = createContext<SupabaseContextType | null>(null);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check connection
    supabase.auth.getSession().then(() => {
      setIsConnected(true);
    });

    // Monitor connection status
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setIsConnected(!!session || event === 'SIGNED_OUT');
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const subscribeToSwarms = (callback: (payload: any) => void) => {
    return supabase
      .channel('swarms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swarms' }, callback)
      .subscribe();
  };

  const subscribeToWorkers = (swarmId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`workers-${swarmId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workers', filter: `swarm_id=eq.${swarmId}` },
        callback
      )
      .subscribe();
  };

  const subscribeToLogs = (swarmId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`logs-${swarmId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'logs', filter: `swarm_id=eq.${swarmId}` },
        callback
      )
      .subscribe();
  };

  return (
    <SupabaseContext.Provider
      value={{
        isConnected,
        subscribeToSwarms,
        subscribeToWorkers,
        subscribeToLogs,
      }}
    >
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}