/**
 * GPS Tracking Service for Go Local
 * 
 * Manages live location tracking for gig work:
 * - Contractor en-route tracking
 * - ETA calculation
 * - Route history
 * - Arrival/completion verification
 */

import { GPSTrackingSession, GPSPoint } from '@/types';

const EARTH_RADIUS_MILES = 3958.8;
const ARRIVAL_THRESHOLD_METERS = 100; // "arrived" when within 100m

interface LocationUpdate {
    lat: number;
    lng: number;
    accuracy?: number;
}

/**
 * Calculate distance between two GPS points in miles
 */
export function haversineDistance(p1: GPSPoint, p2: GPSPoint): number {
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Calculate ETA based on distance and average speed
 */
export function calculateETA(
    currentLat: number,
    currentLng: number,
    destLat: number,
    destLng: number,
    avgSpeedMph: number = 30
): { milesAway: number; minutesETA: number; arrivalTime: string } {
    const current: GPSPoint = { lat: currentLat, lng: currentLng, timestamp: new Date().toISOString() };
    const dest: GPSPoint = { lat: destLat, lng: destLng, timestamp: new Date().toISOString() };
    const milesAway = haversineDistance(current, dest);

    // Adjust speed based on distance (city driving vs highway)
    let effectiveSpeed = avgSpeedMph;
    if (milesAway < 2) effectiveSpeed = 15; // city/suburban
    else if (milesAway < 10) effectiveSpeed = 25;
    else effectiveSpeed = 35; // highway

    const minutesETA = Math.round((milesAway / effectiveSpeed) * 60);
    const arrivalTime = new Date(Date.now() + minutesETA * 60 * 1000).toISOString();

    return {
        milesAway: Math.round(milesAway * 10) / 10,
        minutesETA,
        arrivalTime,
    };
}

/**
 * Update tracking session with new location
 */
export function updateTrackingLocation(
    session: GPSTrackingSession,
    update: LocationUpdate
): GPSTrackingSession {
    const point: GPSPoint = {
        lat: update.lat,
        lng: update.lng,
        timestamp: new Date().toISOString(),
        accuracy: update.accuracy,
    };

    return {
        ...session,
        currentLat: update.lat,
        currentLng: update.lng,
        routeHistory: [...session.routeHistory, point],
    };
}

/**
 * Check if contractor has arrived at destination
 */
export function checkArrival(
    contractorLat: number,
    contractorLng: number,
    destLat: number,
    destLng: number
): boolean {
    const contractor: GPSPoint = { lat: contractorLat, lng: contractorLng, timestamp: '' };
    const dest: GPSPoint = { lat: destLat, lng: destLng, timestamp: '' };
    const distanceMiles = haversineDistance(contractor, dest);
    const distanceMeters = distanceMiles * 1609.34;
    return distanceMeters <= ARRIVAL_THRESHOLD_METERS;
}

/**
 * Calculate total route distance traveled
 */
export function calculateRouteDistance(routeHistory: GPSPoint[]): number {
    if (routeHistory.length < 2) return 0;

    let totalMiles = 0;
    for (let i = 1; i < routeHistory.length; i++) {
        totalMiles += haversineDistance(routeHistory[i - 1], routeHistory[i]);
    }
    return Math.round(totalMiles * 10) / 10;
}

/**
 * Create a new tracking session
 */
export function createTrackingSession(
    jobId: string,
    vendorId: string,
    startLat: number,
    startLng: number,
    destLat: number,
    destLng: number
): GPSTrackingSession {
    const start: GPSPoint = {
        lat: startLat,
        lng: startLng,
        timestamp: new Date().toISOString(),
    };

    const eta = calculateETA(startLat, startLng, destLat, destLng);

    return {
        id: `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        jobId,
        vendorId,
        status: 'en_route',
        startedAt: new Date().toISOString(),
        estimatedArrival: eta.arrivalTime,
        currentLat: startLat,
        currentLng: startLng,
        routeHistory: [start],
        completionPhotos: [],
    };
}

/**
 * Transition tracking session status
 */
export function transitionStatus(
    session: GPSTrackingSession,
    newStatus: GPSTrackingSession['status']
): GPSTrackingSession {
    const now = new Date().toISOString();
    const updates: Partial<GPSTrackingSession> = { status: newStatus };

    switch (newStatus) {
        case 'arrived':
            updates.arrivedAt = now;
            break;
        case 'completed':
            updates.completedAt = now;
            break;
    }

    return { ...session, ...updates };
}

/**
 * Format ETA for display
 */
export function formatETA(minutes: number): string {
    if (minutes <= 1) return 'Arriving now';
    if (minutes < 60) return `${minutes} min away`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m away`;
}

/**
 * Generate shareable tracking link
 */
export function generateTrackingLink(sessionId: string): string {
    return `/track/${sessionId}`;
}
