type SubscriptionCallback<T> = (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: T;
    old: Partial<T>;
}) => void;

/**
 * Self-hosted PostgreSQL 16 mode: signals `onStatusChange(false)` on subscribe
 * so Dashboard and NotificationPanel immediately use their built-in HTTP polling
 * against `/api/supabase/rest/v1/*` without opening dead WebSockets.
 */
export const realtimeService = {
    subscribe<T>(
        _key: string,
        _table: string,
        _filter: string,
        _callback: SubscriptionCallback<T>,
        onStatusChange?: (connected: boolean) => void,
    ): () => void {
        if (onStatusChange) {
            setTimeout(() => onStatusChange(false), 0);
        }
        return () => {};
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

    unsubscribeAll(): void {},
};
