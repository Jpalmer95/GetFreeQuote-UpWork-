'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Notification } from '@/types';
import { db } from '@/services/db';
import { realtimeService } from '@/services/realtimeService';
import styles from './NotificationPanel.module.css';

const PRIORITY_CLASS: Record<string, string> = {
    low: styles.priorityLow,
    medium: styles.priorityMedium,
    high: styles.priorityHigh,
    urgent: styles.priorityUrgent,
};

const FALLBACK_POLL_INTERVAL = 15000;

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function mapRealtimeNotification(row: Record<string, unknown>): Notification {
    return {
        id: row.id as string,
        userId: row.user_id as string,
        jobId: (row.job_id as string) || undefined,
        type: row.type as Notification['type'],
        priority: row.priority as Notification['priority'],
        title: row.title as string,
        message: row.message as string,
        read: row.read as boolean,
        actionRequired: row.action_required as boolean,
        actionUrl: (row.action_url as string) || undefined,
        createdAt: row.created_at as string,
    };
}

export default function NotificationPanel() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadNotifications = useCallback(async () => {
        if (!user) return;
        const notifs = await db.getNotifications(user.id);
        setNotifications(notifs);
    }, [user]);

    useEffect(() => {
        if (!user) return;

        loadNotifications();

        const unsubscribe = realtimeService.subscribeToNotifications(
            user.id,
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    const notif = mapRealtimeNotification(payload.new);
                    setNotifications(prev => [notif, ...prev].slice(0, 50));
                } else if (payload.eventType === 'UPDATE') {
                    const updated = mapRealtimeNotification(payload.new);
                    setNotifications(prev =>
                        prev.map(n => n.id === updated.id ? updated : n)
                    );
                }
            },
            (connected) => {
                setRealtimeConnected(connected);
            },
        );

        return () => {
            unsubscribe();
        };
    }, [user, loadNotifications]);

    useEffect(() => {
        if (realtimeConnected) {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            return;
        }

        if (!user) return;

        pollRef.current = setInterval(loadNotifications, FALLBACK_POLL_INTERVAL);
        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [realtimeConnected, user, loadNotifications]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleMarkRead = async (notif: Notification) => {
        if (!notif.read) {
            await db.markNotificationRead(notif.id);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        }
        if (notif.actionUrl) {
            window.location.href = notif.actionUrl;
        }
    };

    const handleMarkAllRead = async () => {
        if (!user) return;
        await db.markAllNotificationsRead(user.id);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    if (!user) return null;

    return (
        <div className={styles.wrapper} ref={panelRef}>
            <button className={styles.bellBtn} onClick={() => setOpen(!open)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </button>

            {open && (
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <span className={styles.panelTitle}>Notifications</span>
                        {unreadCount > 0 && (
                            <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
                                Mark all read
                            </button>
                        )}
                    </div>

                    {notifications.length === 0 ? (
                        <div className={styles.emptyState}>No notifications yet</div>
                    ) : (
                        notifications.slice(0, 20).map(notif => (
                            <div
                                key={notif.id}
                                className={`${styles.notifItem} ${!notif.read ? styles.unread : ''}`}
                                onClick={() => handleMarkRead(notif)}
                            >
                                <div className={`${styles.priorityDot} ${PRIORITY_CLASS[notif.priority] || styles.priorityMedium}`} />
                                <div className={styles.notifContent}>
                                    <div className={styles.notifTitle}>
                                        {notif.title}
                                        {notif.actionRequired && (
                                            <span className={styles.actionBadge}>Action Required</span>
                                        )}
                                    </div>
                                    <div className={styles.notifMsg}>{notif.message}</div>
                                    <div className={styles.notifTime}>{timeAgo(notif.createdAt)}</div>
                                </div>
                            </div>
                        ))
                    )}

                    <div className={styles.panelFooter}>
                        <a href="/agent-settings" className={styles.settingsLink}>
                            Agent Settings
                        </a>
                        <a href="/settings/notifications" className={styles.settingsLink}>
                            Email Preferences
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
