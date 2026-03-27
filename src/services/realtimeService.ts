import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type SubscriptionCallback<T> = (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: T;
    old: Partial<T>;
}) => void;

interface ChannelEntry {
    channel: RealtimeChannel;
    status: 'connecting' | 'connected' | 'disconnected';
    retryCount: number;
}

const channels = new Map<string, ChannelEntry>();
const MAX_RETRIES = 3;

function handlePayload<T>(
    payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>,
    callback: SubscriptionCallback<T>,
) {
    const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
    callback({
        eventType,
        new: (payload.new ?? {}) as T,
        old: (payload.old ?? {}) as Partial<T>,
    });
}

export const realtimeService = {
    subscribe<T>(
        key: string,
        table: string,
        filter: string,
        callback: SubscriptionCallback<T>,
        onStatusChange?: (connected: boolean) => void,
    ): () => void {
        const existing = channels.get(key);
        if (existing) {
            supabase.removeChannel(existing.channel);
            channels.delete(key);
        }

        const channel = supabase
            .channel(key)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table, filter },
                (payload) => handlePayload(payload, callback),
            )
            .subscribe((status) => {
                const entry = channels.get(key);
                if (!entry) return;

                if (status === 'SUBSCRIBED') {
                    entry.status = 'connected';
                    entry.retryCount = 0;
                    onStatusChange?.(true);
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    entry.status = 'disconnected';
                    onStatusChange?.(false);

                    if (entry.retryCount < MAX_RETRIES) {
                        entry.retryCount++;
                        setTimeout(() => {
                            const current = channels.get(key);
                            if (current && current.status === 'disconnected') {
                                supabase.removeChannel(current.channel);
                                channels.delete(key);
                                this.subscribe(key, table, filter, callback, onStatusChange);
                            }
                        }, 2000 * entry.retryCount);
                    }
                }
            });

        channels.set(key, { channel, status: 'connecting', retryCount: 0 });

        return () => {
            const entry = channels.get(key);
            if (entry) {
                supabase.removeChannel(entry.channel);
                channels.delete(key);
            }
        };
    },

    subscribeToNotifications(
        userId: string,
        callback: SubscriptionCallback<Record<string, unknown>>,
        onStatusChange?: (connected: boolean) => void,
    ): () => void {
        return this.subscribe(
            `notifications:${userId}`,
            'notifications',
            `user_id=eq.${userId}`,
            callback,
            onStatusChange,
        );
    },

    subscribeToQuotes(
        jobId: string,
        callback: SubscriptionCallback<Record<string, unknown>>,
        onStatusChange?: (connected: boolean) => void,
    ): () => void {
        return this.subscribe(
            `quotes:${jobId}`,
            'quotes',
            `job_id=eq.${jobId}`,
            callback,
            onStatusChange,
        );
    },

    subscribeToMessages(
        jobId: string,
        callback: SubscriptionCallback<Record<string, unknown>>,
        onStatusChange?: (connected: boolean) => void,
    ): () => void {
        return this.subscribe(
            `messages:${jobId}`,
            'messages',
            `job_id=eq.${jobId}`,
            callback,
            onStatusChange,
        );
    },

    unsubscribeAll(): void {
        for (const [key, entry] of channels) {
            supabase.removeChannel(entry.channel);
            channels.delete(key);
        }
    },
};
