import {
    ONLINE_SESSION_MERGE_GAP_MS,
    buildSessionsFromEvents as engineBuildSessionsFromEvents,
    buildSessionsFromGamelog as engineBuildSessionsFromGamelog,
    buildHeatmapBuckets,
    buildOverlapBuckets,
    clipSessionsToRange,
    computeActivityView,
    computeOverlapView,
    findBestOverlapTimeFromBuckets
} from './activityEngine';

export { ONLINE_SESSION_MERGE_GAP_MS };

export function buildSessionsFromEvents(events: { created_at: string; type: string; }[]) {
    return engineBuildSessionsFromEvents(events).sessions;
}

export function buildSessionsFromGamelog(rows: string | any[], mergeGapMs = ONLINE_SESSION_MERGE_GAP_MS) {
    return engineBuildSessionsFromGamelog(rows, mergeGapMs);
}

export function filterSessionsByPeriod(sessions: { start: number; end: number; }[], cutoffMs: number) {
    return clipSessionsToRange(sessions, cutoffMs, Date.now());
}

export function calculateOverlapGrid(sessionsA: string | any[], sessionsB: string | any[]) {
    const nowMs = Date.now();
    const rawBuckets = buildOverlapBuckets(sessionsA, sessionsB, 0, nowMs);
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let maxVal = 0;
    for (let slot = 0; slot < 168; slot++) {
        const value = rawBuckets[slot];
        if (value > maxVal) {
            maxVal = value;
        }
        grid[Math.floor(slot / 24)][slot % 24] = value;
    }
    const totalOverlapMs = rawBuckets.reduce((sum, value) => sum + value, 0) * 60000;
    const totalUserAMs = sumDurations(sessionsA);
    const totalUserBMs = sumDurations(sessionsB);
    const minOnlineMs = Math.min(totalUserAMs, totalUserBMs);
    const overlapPercent = minOnlineMs > 0 ? Math.round((totalOverlapMs / minOnlineMs) * 100) : 0;
    return {
        grid,
        maxVal,
        totalOverlapMs,
        totalUserAMs,
        totalUserBMs,
        overlapPercent
    };
}

export function aggregateSessionsToGrid(sessions: { start: number; end: number; }[]) {
    const rawBuckets = buildHeatmapBuckets(sessions, 0, Date.now());
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let maxVal = 0;
    for (let slot = 0; slot < 168; slot++) {
        const value = rawBuckets[slot];
        if (value > maxVal) {
            maxVal = value;
        }
        grid[Math.floor(slot / 24)][slot % 24] = value;
    }
    return { grid, maxVal };
}

export function findBestOverlapTime(grid: any[][], dayLabels: string[]) {
    const buckets = [];
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            buckets.push(grid[day][hour]);
        }
    }
    return findBestOverlapTimeFromBuckets(buckets, dayLabels);
}

export { computeActivityView, computeOverlapView };

function sumDurations(sessions: any) {
    return sessions.reduce((sum: number, session: { end: number; start: number; }) => sum + (session.end - session.start), 0);
}
