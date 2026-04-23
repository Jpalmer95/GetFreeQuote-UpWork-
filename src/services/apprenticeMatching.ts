/**
 * Apprentice & Mentorship Matching Service
 * 
 * Matches aspiring tradespeople with experienced contractors
 * for on-the-job training and mentorship.
 */

import { ApprenticeProfile, MentorProfile, ApprenticeLog, ApprenticeStatus, GPSPoint } from '@/types';
import { haversineDistance } from './gpsTracking';

interface MatchScore {
    mentor: MentorProfile;
    score: number;
    reasons: string[];
}

/**
 * Score mentor-apprentice compatibility
 */
export function matchApprenticeToMentors(
    apprentice: ApprenticeProfile,
    mentors: MentorProfile[],
    mentorLocations: Map<string, { lat: number; lng: number }>
): MatchScore[] {
    const matches: MatchScore[] = [];

    for (const mentor of mentors) {
        // Skip full mentors
        if (mentor.currentApprentices >= mentor.maxApprentices) continue;

        let score = 0;
        const reasons: string[] = [];

        // Trade match (most important)
        if (mentor.tradesOffered.some(t =>
            t.toLowerCase() === apprentice.desiredTrade.toLowerCase() ||
            apprentice.desiredTrade.toLowerCase().includes(t.toLowerCase())
        )) {
            score += 40;
            reasons.push('trade_match');
        } else {
            continue; // no trade match = skip entirely
        }

        // Proximity
        const mentorLoc = mentorLocations.get(mentor.vendorId);
        if (mentorLoc) {
            const apprenticePoint: GPSPoint = { lat: apprentice.locationLat, lng: apprentice.locationLng, timestamp: '' };
            const mentorPoint: GPSPoint = { lat: mentorLoc.lat, lng: mentorLoc.lng, timestamp: '' };
            const distance = haversineDistance(apprenticePoint, mentorPoint);

            if (distance <= apprentice.maxCommuteMiles) {
                if (distance <= apprentice.maxCommuteMiles * 0.25) {
                    score += 25;
                    reasons.push('very_close');
                } else if (distance <= apprentice.maxCommuteMiles * 0.5) {
                    score += 20;
                    reasons.push('close');
                } else {
                    score += 10;
                    reasons.push('within_commute');
                }
            } else {
                continue; // too far
            }
        }

        // Experience level match
        if (apprentice.experienceLevel === 'none' && mentor.yearsExperience >= 5) {
            score += 15;
            reasons.push('experienced_mentor_for_beginner');
        } else if (apprentice.experienceLevel === 'some' && mentor.yearsExperience >= 3) {
            score += 10;
            reasons.push('good_experience_level');
        } else if (apprentice.experienceLevel === 'formal_training' && mentor.certifiedToTeach) {
            score += 15;
            reasons.push('certified_to_teach');
        }

        // Capacity
        const capacityRemaining = mentor.maxApprentices - mentor.currentApprentices;
        if (capacityRemaining >= 2) {
            score += 10;
            reasons.push('good_capacity');
        } else {
            score += 5;
            reasons.push('limited_capacity');
        }

        // Affordability (lower rate = more accessible)
        if (mentor.hourlyRateForApprentice <= 15) {
            score += 10;
            reasons.push('affordable_rate');
        } else if (mentor.hourlyRateForApprentice <= 25) {
            score += 5;
            reasons.push('reasonable_rate');
        }

        matches.push({ mentor, score, reasons });
    }

    return matches.sort((a, b) => b.score - a.score);
}

/**
 * Log apprentice work hours
 */
export function logApprenticeHours(
    apprenticeId: string,
    mentorId: string,
    hoursWorked: number,
    skillsPracticed: string[],
    jobId?: string,
    mentorNotes?: string,
    apprenticeNotes?: string
): ApprenticeLog {
    return {
        id: `alog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        apprenticeId,
        mentorId,
        jobId,
        date: new Date().toISOString(),
        hoursWorked,
        skillsPracticed,
        mentorNotes,
        apprenticeNotes,
        photos: [],
    };
}

/**
 * Calculate apprentice progress toward certification
 */
export function calculateProgress(logs: ApprenticeLog[], hoursRequired: number = 2000): {
    totalHours: number;
    percentComplete: number;
    estimatedCompletionDate: string;
    skillsAcquired: string[];
    averageHoursPerWeek: number;
} {
    const totalHours = logs.reduce((sum, l) => sum + l.hoursWorked, 0);
    const percentComplete = Math.min(100, Math.round((totalHours / hoursRequired) * 100));

    // Calculate average hours per week
    if (logs.length < 2) {
        return {
            totalHours,
            percentComplete,
            estimatedCompletionDate: 'Insufficient data',
            skillsAcquired: [...new Set(logs.flatMap(l => l.skillsPracticed))],
            averageHoursPerWeek: totalHours,
        };
    }

    const sortedLogs = [...logs].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstDate = new Date(sortedLogs[0].date).getTime();
    const lastDate = new Date(sortedLogs[sortedLogs.length - 1].date).getTime();
    const weeksElapsed = Math.max(1, (lastDate - firstDate) / (7 * 24 * 60 * 60 * 1000));
    const averageHoursPerWeek = Math.round(totalHours / weeksElapsed);

    // Estimate completion
    const hoursRemaining = hoursRequired - totalHours;
    const weeksRemaining = averageHoursPerWeek > 0 ? Math.ceil(hoursRemaining / averageHoursPerWeek) : 999;
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + weeksRemaining * 7);

    const skillsAcquired = [...new Set(logs.flatMap(l => l.skillsPracticed))];

    return {
        totalHours,
        percentComplete,
        estimatedCompletionDate: estimatedCompletion.toISOString(),
        skillsAcquired,
        averageHoursPerWeek,
    };
}

/**
 * Get mentor capacity status
 */
export function getMentorCapacity(mentor: MentorProfile): {
    spotsAvailable: number;
    percentFull: number;
    isAccepting: boolean;
    capacityLabel: string;
} {
    const spotsAvailable = mentor.maxApprentices - mentor.currentApprentices;
    const percentFull = mentor.maxApprentices > 0
        ? Math.round((mentor.currentApprentices / mentor.maxApprentices) * 100)
        : 100;
    const isAccepting = spotsAvailable > 0;

    let capacityLabel: string;
    if (spotsAvailable === 0) capacityLabel = 'Full';
    else if (spotsAvailable === 1) capacityLabel = '1 spot left';
    else capacityLabel = `${spotsAvailable} spots available`;

    return { spotsAvailable, percentFull, isAccepting, capacityLabel };
}

/**
 * Common trade certifications for tracking
 */
export const TRADE_CERTIFICATIONS: Record<string, string[]> = {
    'Plumbing': ['Journeyman Plumber', 'Master Plumber', 'Backflow Prevention', 'Medical Gas'],
    'Electrical': ['Journeyman Electrician', 'Master Electrician', 'Solar Installation', 'Fire Alarm'],
    'HVAC': ['EPA 608 Certification', 'NATE Certification', 'HVAC Excellence', 'R-410A Certification'],
    'Welding': ['AWS D1.1 Structural', 'AWS D1.2 Aluminum', 'ASME Pipe Welding', '6G Pipe Certification'],
    'Carpentry': ['NCCER Carpentry', 'OSHA 30', 'Lead Renovator'],
    'Concrete': ['ACI Concrete Flatwork', 'ACI Concrete Strength Testing'],
    'Roofing': ['OSHA 10', 'NRCA ProCertification'],
    'Masonry': ['MCAA Certified Mason', 'IMI BAC Certification'],
};

/**
 * Get skills for a trade (for logging)
 */
export function getTradeSkills(trade: string): string[] {
    const skills: Record<string, string[]> = {
        'Plumbing': ['pipe cutting', 'soldering', 'fitting', 'drain cleaning', 'water heater install', 'fixture install', 'leak detection', 'pressure testing'],
        'Electrical': ['wire pulling', 'panel work', 'outlet install', 'circuit tracing', 'conduit bending', 'troubleshooting', 'code compliance'],
        'HVAC': ['refrigerant handling', 'ductwork', 'system sizing', 'thermostat wiring', 'compressor service', 'air balancing'],
        'Welding': ['MIG welding', 'TIG welding', 'stick welding', 'plasma cutting', 'metal prep', 'joint inspection'],
        'Carpentry': ['framing', 'layout', 'cutting', 'assembly', 'finishing', 'tool maintenance', 'blueprint reading'],
        'Concrete': ['mixing', 'pouring', 'finishing', 'curing', 'forming', 'rebar placement', 'stamping'],
        'Roofing': ['shingle install', 'flashing', 'gutter work', 'leak repair', 'safety rigging', 'material handling'],
        'Masonry': ['brick laying', 'block work', 'mortar mixing', 'pointing', 'cleaning', 'scaffold work'],
    };

    return skills[trade] || ['general labor', 'tool use', 'safety procedures', 'material handling'];
}
