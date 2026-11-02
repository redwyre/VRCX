import { defineStore } from 'pinia';
import { ref } from 'vue';

import { database } from '../services/database';
import { mergeSessions } from '../shared/utils/activityEngine';
import { runActivityWorkerTask } from '../workers/activityWorkerRunner';

const snapshotMap = new Map();
const inFlightJobs = new Map();
const workerCall = runActivityWorkerTask;
const MAX_SNAPSHOT_ENTRIES = 12;
let deferredWriteQueue = Promise.resolve();
const FULL_CACHE_BATCH_DAYS = 30;
const FULL_CACHE_MAX_DAYS = 3650; // vrchat max days??

function deferWrite(task: ((value: void) => void | PromiseLike<void>) | null | undefined) {
    const run = () => {
        deferredWriteQueue = deferredWriteQueue
            .catch(() => {})
            .then(task)
            .catch((error) => {
                console.error('[Activity] deferred write failed:', error);
            });
        return deferredWriteQueue;
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run);
        return;
    }
    setTimeout(run, 0);
}

function createSnapshot(userId: any, isSelf: any) {
    return {
        userId,
        isSelf,
        sync: {
            userId,
            updatedAt: '',
            isSelf,
            sourceLastCreatedAt: '',
            pendingSessionStartAt: null,
            cachedRangeDays: 0
        },
        sessions: [],
        activityViews: new Map(),
        overlapViews: new Map()
    };
}

function getSnapshot(userId: any, isSelf: any) {
    let snapshot = snapshotMap.get(userId);
    if (!snapshot) {
        snapshot = createSnapshot(userId, isSelf);
        snapshotMap.set(userId, snapshot);
    } else if (typeof isSelf === 'boolean') {
        snapshot.isSelf = isSelf;
        snapshot.sync.isSelf = isSelf;
    }
    touchSnapshot(userId, snapshot);
    pruneSnapshots();
    return snapshot;
}

function touchSnapshot(userId: any, snapshot: any) {
    snapshotMap.delete(userId);
    snapshotMap.set(userId, snapshot);
}

function pruneSnapshots() {
    if (snapshotMap.size <= MAX_SNAPSHOT_ENTRIES) {
        return;
    }

    for (const [userId] of snapshotMap) {
        if (isUserInFlight(userId)) {
            continue;
        }
        snapshotMap.delete(userId);
        if (snapshotMap.size <= MAX_SNAPSHOT_ENTRIES) {
            break;
        }
    }
}

function isUserInFlight(userId: any) {
    for (const key of inFlightJobs.keys()) {
        if (key.startsWith(`${userId}:`)) {
            return true;
        }
    }
    return false;
}

function clearDerivedViews(snapshot: { activityViews: { clear: () => void; }; overlapViews: { clear: () => void; }; }) {
    snapshot.activityViews.clear();
    snapshot.overlapViews.clear();
}

function overlapExcludeKey(excludeHours: { enabled: any; startHour: any; endHour: any; }) {
    if (!excludeHours?.enabled) {
        return '';
    }
    return `${excludeHours.startHour}-${excludeHours.endHour}`;
}

function pairCursor(leftCursor: any, rightCursor: any) {
    return `${leftCursor || ''}|${rightCursor || ''}`;
}

export const useActivityStore = defineStore('Activity', () => {
    const fullCacheReady = ref(false);
    let fullCacheBuildRunning = false;
    let fullCacheBuildAborted = false;

    const userActivity = ref({
        lastLoadedUserId: '',
        activeRequestId: 0,
        activeOverlapRequestId: 0,
        activeTopWorldsRequestId: 0
    });

    async function getCache(userId: any, isSelf = false) {
        const snapshot = await hydrateSnapshot(userId, isSelf);
        return {
            userId: snapshot.userId,
            isSelf: snapshot.isSelf,
            updatedAt: snapshot.sync.updatedAt,
            sourceLastCreatedAt: snapshot.sync.sourceLastCreatedAt,
            pendingSessionStartAt: snapshot.sync.pendingSessionStartAt,
            cachedRangeDays: snapshot.sync.cachedRangeDays,
            sessions: snapshot.sessions
        };
    }

    function getCachedDays(userId: any) {
        return snapshotMap.get(userId)?.sync.cachedRangeDays || 0;
    }

    function isRefreshing(userId: any) {
        for (const key of inFlightJobs.keys()) {
            if (key.startsWith(`${userId}:`)) {
                return true;
            }
        }
        return false;
    }

    async function loadActivity(
        userId: any,
        { isSelf = false, rangeDays = 30, normalizeConfig, dayLabels, forceRefresh = false }: { isSelf: boolean; rangeDays: number; dayLabels: any; forceRefresh: boolean; normalizeConfig: any; }
    ) {
        const snapshot = await ensureSnapshot(userId, {
            isSelf,
            rangeDays,
            forceRefresh
        });
        const cacheKey = String(rangeDays);
        const currentCursor = snapshot.sync.sourceLastCreatedAt || '';

        let view = snapshot.activityViews.get(cacheKey);
        if (!forceRefresh && view?.builtFromCursor === currentCursor) {
            return buildActivityResponse(snapshot, view);
        }

        if (!forceRefresh) {
            const persisted = await database.getActivityBucketCacheV2({
                ownerUserId: userId,
                rangeDays,
                viewKind: database.ACTIVITY_VIEW_KIND.ACTIVITY
            });
            if ((persisted as any)?.builtFromCursor === currentCursor) {
                view = {




                    ...persisted.summary,




                    rawBuckets: persisted.rawBuckets,




                    normalizedBuckets: persisted.normalizedBuckets,




                    builtFromCursor: persisted.builtFromCursor,




                    builtAt: persisted.builtAt
                };
                snapshot.activityViews.set(cacheKey, view);
                return buildActivityResponse(snapshot, view);
            }
        }

        const computed = await workerCall('computeActivityView', {
            sessions: snapshot.sessions,
            dayLabels,
            rangeDays,
            normalizeConfig
        });
        view = {




            ...computed,
            builtFromCursor: currentCursor,
            builtAt: new Date().toISOString()
        };
        snapshot.activityViews.set(cacheKey, view);
        deferWrite(() =>
            database.upsertActivityBucketCacheV2({
                ownerUserId: userId,
                rangeDays,
                viewKind: database.ACTIVITY_VIEW_KIND.ACTIVITY,
                builtFromCursor: currentCursor,
                rawBuckets: view.rawBuckets,
                normalizedBuckets: view.normalizedBuckets,
                summary: {
                    peakDay: view.peakDay,
                    peakTime: view.peakTime,
                    filteredEventCount: view.filteredEventCount
                },
                builtAt: view.builtAt
            })
        );
        return buildActivityResponse(snapshot, view);
    }

    async function loadOverlap(
        currentUserId: any,
        targetUserId: any,
        { rangeDays = 30, dayLabels, normalizeConfig, excludeHours, forceRefresh = false }: { rangeDays: number; dayLabels: any; excludeHours: any; forceRefresh: boolean; normalizeConfig: any; }
    ) {
        const [selfSnapshot, targetSnapshot] = await Promise.all([
            ensureSnapshot(currentUserId, {
                isSelf: true,
                rangeDays,
                forceRefresh
            }),
            ensureSnapshot(targetUserId, {
                isSelf: false,
                rangeDays,
                forceRefresh
            })
        ]);

        const excludeKey = overlapExcludeKey(excludeHours);
        const cacheKey = `${targetUserId}:${rangeDays}:${excludeKey}`;
        const cursor = pairCursor(selfSnapshot.sync.sourceLastCreatedAt, targetSnapshot.sync.sourceLastCreatedAt);

        let view = targetSnapshot.overlapViews.get(cacheKey);
        if (!forceRefresh && view?.builtFromCursor === cursor) {
            return view;
        }

        if (!forceRefresh) {
            const persisted = await database.getActivityBucketCacheV2({
                ownerUserId: currentUserId,
                targetUserId,
                rangeDays,
                viewKind: database.ACTIVITY_VIEW_KIND.OVERLAP,
                excludeKey
            });
            if ((persisted as any)?.builtFromCursor === cursor) {
                view = {
    ...(persisted as any).summary,
    rawBuckets: (persisted as any).rawBuckets,
    normalizedBuckets: (persisted as any).normalizedBuckets,
    builtFromCursor: (persisted as any).builtFromCursor,
    builtAt: (persisted as any).builtAt
};
                targetSnapshot.overlapViews.set(cacheKey, view);
                return view;
            }
        }

        view = await workerCall('computeOverlapView', {
            selfSessions: selfSnapshot.sessions,
            targetSessions: targetSnapshot.sessions,
            dayLabels,
            rangeDays,
            excludeHours: excludeHours?.enabled ? excludeHours : null,
            normalizeConfig
        });
        view = {
            ...view,
            builtFromCursor: cursor,
            builtAt: new Date().toISOString()
        };
        targetSnapshot.overlapViews.set(cacheKey, view);
        deferWrite(() =>
            database.upsertActivityBucketCacheV2({
                ownerUserId: currentUserId,
                targetUserId,
                rangeDays,
                viewKind: database.ACTIVITY_VIEW_KIND.OVERLAP,
                excludeKey,
                builtFromCursor: cursor,
                rawBuckets: view.rawBuckets,
                normalizedBuckets: view.normalizedBuckets,
                summary: {
                    overlapPercent: view.overlapPercent,
                    bestOverlapTime: view.bestOverlapTime
                },
                builtAt: view.builtAt
            })
        );
        return view;
    }

    /**
     * @param {string} userId
     * @param {{ rangeDays?: number; limit?: number; sortBy?: 'time' | 'count'; excludeWorldId?: string }} options
     */
    async function loadTopWorlds(userId: string, { rangeDays = 30, limit = 5, sortBy = 'time', excludeWorldId = '' }: { rangeDays?: number; limit?: number; sortBy?: 'time' | 'count'; excludeWorldId?: string; }) {
        void userId;
        return database.getMyTopWorlds(rangeDays, limit, sortBy, excludeWorldId);
    }

    async function refreshActivity(userId: any, options: any) {
        return loadActivity(userId, { ...options, forceRefresh: true });
    }

    async function loadActivityView({ userId, isSelf = false, rangeDays = 30, dayLabels, forceRefresh = false }: any) {
        const response = await loadActivity(userId, {
            isSelf,
            rangeDays,
            dayLabels,
            forceRefresh,
            normalizeConfig: pickActivityNormalizeConfig(isSelf, rangeDays)
        });
        return {
            hasAnyData: response.sessions.length > 0,
            filteredEventCount: response.view.filteredEventCount,
            peakDay: response.view.peakDay,
            peakTime: response.view.peakTime,
            rawBuckets: response.view.rawBuckets,
            normalizedBuckets: response.view.normalizedBuckets
        };
    }

    async function loadOverlapView({
        currentUserId,
        targetUserId,
        rangeDays = 30,
        dayLabels,
        excludeHours,
        forceRefresh = false
    }: any) {
        const response = await loadOverlap(currentUserId, targetUserId, {
            rangeDays,
            dayLabels,
            excludeHours,
            forceRefresh,
            normalizeConfig: pickOverlapNormalizeConfig(rangeDays)
        });
        return {
            hasOverlapData: response.rawBuckets.some((value: number) => value > 0),
            overlapPercent: response.overlapPercent,
            bestOverlapTime: response.bestOverlapTime,
            rawBuckets: response.rawBuckets,
            normalizedBuckets: response.normalizedBuckets
        };
    }

    /**
     * @param {{
     *     userId: string;
     *     rangeDays?: number;
     *     limit?: number;
     *     sortBy?: 'time' | 'count';
     *     excludeWorldId?: string;
     * }} options
     */
    async function loadTopWorldsView({ userId, rangeDays = 30, limit = 5, sortBy = 'time', excludeWorldId = '' }: { userId: string; rangeDays?: number; limit?: number; sortBy?: 'time' | 'count'; excludeWorldId?: string; }) {
        return loadTopWorlds(userId, {
            rangeDays,
            limit,
            sortBy,
            excludeWorldId
        });
    }

    function invalidateUser(userId: any) {
        if (!userId) {
            return;
        }
        snapshotMap.delete(userId);
    }

    async function startFullCacheBuild(userId: any) {
        if (fullCacheBuildRunning) {
            return;
        }
        fullCacheBuildRunning = true;
        fullCacheBuildAborted = false;
        fullCacheReady.value = false;

        try {
            const snapshot = await hydrateSnapshot(userId, true);

            if (!snapshot.sync.updatedAt) {
                await fullRefresh(snapshot, 90);
            }

            const currentDays = snapshot.sync.cachedRangeDays || 90;

            const probeItems = await database.getActivitySourceSliceV2({
                userId,
                isSelf: true,
                fromDays: FULL_CACHE_MAX_DAYS,
                toDays: currentDays
            });

            if (probeItems.length === 0) {
                fullCacheReady.value = true;
                fullCacheBuildRunning = false;
                return;
            }

            const earliestDate = new Date(probeItems[0].created_at);
            const totalDays = Math.ceil((Date.now() - earliestDate.getTime()) / 86400000);

            let targetDays = currentDays;
            while (targetDays < totalDays && !fullCacheBuildAborted) {
                targetDays = Math.min(targetDays + FULL_CACHE_BATCH_DAYS, totalDays);
                const nextTarget = targetDays;

                await new Promise((resolve) => {
                    const callback = async () => {
                        try {
                            await expandRange(snapshot, nextTarget);
                        } catch (error) {
                            console.error('[Activity] full cache batch failed:', error);
                        }




                        resolve();
                    };
                    if (typeof requestIdleCallback === 'function') {
                        requestIdleCallback(callback);
                    } else {
                        setTimeout(callback, 0);
                    }
                });
            }

            if (!fullCacheBuildAborted) {
                fullCacheReady.value = true;
            }
        } catch (error) {
            console.error('[Activity] full cache build error:', error);
        } finally {
            fullCacheBuildRunning = false;
        }
    }

    function stopFullCacheBuild() {
        fullCacheBuildAborted = true;
    }

    /**
     * @returns {Promise<{ date: string; totalMs: number }[]>}
     */
    async function getDailySummary(userId: any) {
        const snapshot = await hydrateSnapshot(userId, true);
        if (snapshot.sessions.length === 0) {
            return [];
        }

        const rangeStartMs = snapshot.sessions[0].start;
        const rangeEndMs = Date.now();

        const result = await workerCall('computeDailySummary', {
            sessions: snapshot.sessions,
            rangeStartMs,
            rangeEndMs
        });
        return (result as any).dailySummary;
    }

    return {
        fullCacheReady,
        getCache,
        getCachedDays,
        isRefreshing,
        userActivity,
        loadActivity,
        loadActivityView,
        loadOverlap,
        loadOverlapView,
        loadTopWorlds,
        loadTopWorldsView,
        refreshActivity,
        invalidateUser,
        startFullCacheBuild,
        stopFullCacheBuild,
        getDailySummary,
        workerCall: runActivityWorkerTask
    };
});

function buildActivityResponse(snapshot: { userId: any; isSelf: any; sync: { cachedRangeDays: any; }; sessions: any; }, view: any) {
    return {
        userId: snapshot.userId,
        isSelf: snapshot.isSelf,
        cachedRangeDays: snapshot.sync.cachedRangeDays,
        sessions: snapshot.sessions,
        view
    };
}

async function hydrateSnapshot(userId: any, isSelf: boolean) {
    const snapshot = getSnapshot(userId, isSelf);
    if (snapshot.sync.updatedAt || snapshot.sessions.length > 0) {
        return snapshot;
    }

    const [syncState, sessions] = await Promise.all([
        database.getActivitySyncStateV2(userId),
        database.getActivitySessionsV2(userId)
    ]);

    if (syncState) {
        snapshot.sync = {
    ...snapshot.sync,




    ...syncState,
    isSelf: typeof (syncState as any).isSelf === 'boolean' ? (syncState as any).isSelf : snapshot.isSelf
};
    }
    if (sessions.length > 0) {
        snapshot.sessions = sessions;
    }
    return snapshot;
}

async function ensureSnapshot(userId: any, { isSelf, rangeDays, forceRefresh = false }: { isSelf: boolean; rangeDays: number; forceRefresh: boolean; }) {
    const jobKey = `${userId}:${isSelf}:${rangeDays}:${forceRefresh ? 'force' : 'normal'}`;
    const existingJob = inFlightJobs.get(jobKey);
    if (existingJob) {
        return existingJob;
    }

    const job = (async () => {
        const snapshot = await hydrateSnapshot(userId, isSelf);
        if (forceRefresh || !snapshot.sync.updatedAt) {
            await fullRefresh(snapshot, rangeDays);
        } else {
            await incrementalRefresh(snapshot);
            if (rangeDays > snapshot.sync.cachedRangeDays) {
                await expandRange(snapshot, rangeDays);
            }
        }
        return snapshot;
    })().finally(() => {
        inFlightJobs.delete(jobKey);
    });

    inFlightJobs.set(jobKey, job);
    return job;
}

async function fullRefresh(snapshot: any, rangeDays: any) {
    const sourceItems = await database.getActivitySourceSliceV2({
        userId: snapshot.userId,
        isSelf: snapshot.isSelf,
        fromDays: rangeDays
    });
    const sourceLastCreatedAt = sourceItems.length > 0 ? sourceItems[sourceItems.length - 1].created_at : '';
    const result = await workerCall('computeSessionsSnapshot', {
        sourceType: snapshot.isSelf ? 'self_gamelog' : 'friend_presence',
        rows: snapshot.isSelf ? sourceItems : undefined,
        events: snapshot.isSelf ? undefined : sourceItems,
        initialStart: null,
        nowMs: Date.now(),
        mayHaveOpenTail: snapshot.isSelf,
        sourceRevision: sourceLastCreatedAt
    });

    snapshot.sessions = (result as any).sessions;
    snapshot.sync = {
    ...snapshot.sync,
    updatedAt: new Date().toISOString(),
    isSelf: snapshot.isSelf,
    sourceLastCreatedAt,
    pendingSessionStartAt: (result as any).pendingSessionStartAt,
    cachedRangeDays: rangeDays
};
    clearDerivedViews(snapshot);

    deferWrite(() => database.replaceActivitySessionsV2(snapshot.userId, snapshot.sessions));
    deferWrite(() => database.upsertActivitySyncStateV2(snapshot.sync));
}

async function incrementalRefresh(snapshot: any) {
    if (!snapshot.sync.sourceLastCreatedAt) {
        return;
    }

    const sourceItems = await database.getActivitySourceAfterV2({
        userId: snapshot.userId,
        isSelf: snapshot.isSelf,
        afterCreatedAt: snapshot.sync.sourceLastCreatedAt,
        inclusive: snapshot.isSelf
    });
    if (sourceItems.length === 0) {
        snapshot.sync.updatedAt = new Date().toISOString();
        deferWrite(() => database.upsertActivitySyncStateV2(snapshot.sync));
        return;
    }

    const sourceLastCreatedAt = sourceItems[sourceItems.length - 1].created_at;
    const result = await workerCall('computeSessionsSnapshot', {
        sourceType: snapshot.isSelf ? 'self_gamelog' : 'friend_presence',
        rows: snapshot.isSelf ? sourceItems : undefined,
        events: snapshot.isSelf ? undefined : sourceItems,
        initialStart: snapshot.isSelf ? null : snapshot.sync.pendingSessionStartAt,
        nowMs: Date.now(),
        mayHaveOpenTail: snapshot.isSelf,
        sourceRevision: sourceLastCreatedAt
    });

    const replaceFromStartAt =
        snapshot.sessions.length > 0 ? snapshot.sessions[Math.max(snapshot.sessions.length - 1, 0)].start : null;
    const merged = mergeSessions(snapshot.sessions, (result as any).sessions);
    snapshot.sessions = merged;
    snapshot.sync = {
    ...snapshot.sync,
    updatedAt: new Date().toISOString(),
    sourceLastCreatedAt,
    pendingSessionStartAt: (result as any).pendingSessionStartAt
};
    clearDerivedViews(snapshot);

    const tailSessions =
        replaceFromStartAt === null ? merged : merged.filter((session) => session.start >= replaceFromStartAt);
    deferWrite(() =>
        database.appendActivitySessionsV2({
            userId: snapshot.userId,
            sessions: tailSessions,
            replaceFromStartAt
        })
    );
    deferWrite(() => database.upsertActivitySyncStateV2(snapshot.sync));
}

async function expandRange(snapshot: any, rangeDays: any) {
    const currentDays = snapshot.sync.cachedRangeDays || 0;
    if (rangeDays <= currentDays) {
        return;
    }

    const sourceItems = await database.getActivitySourceSliceV2({
        userId: snapshot.userId,
        isSelf: snapshot.isSelf,
        fromDays: rangeDays,
        toDays: currentDays
    });
    const result = await workerCall('computeSessionsSnapshot', {
        sourceType: snapshot.isSelf ? 'self_gamelog' : 'friend_presence',
        rows: snapshot.isSelf ? sourceItems : undefined,
        events: snapshot.isSelf ? undefined : sourceItems,
        initialStart: null,
        nowMs: Date.now(),
        mayHaveOpenTail: false,
        sourceRevision: snapshot.sync.sourceLastCreatedAt
    });

    if ((result as any).sessions.length > 0) {
        snapshot.sessions = mergeSessions((result as any).sessions, snapshot.sessions);
        deferWrite(() => database.replaceActivitySessionsV2(snapshot.userId, snapshot.sessions));
    }
    snapshot.sync.cachedRangeDays = rangeDays;
    snapshot.sync.updatedAt = new Date().toISOString();
    clearDerivedViews(snapshot);

    deferWrite(() => database.upsertActivitySyncStateV2(snapshot.sync));
}

function pickActivityNormalizeConfig(isSelf: boolean, rangeDays: number) {
    const role = isSelf ? 'self' : 'friend';
    return (({
    self: {
        7: {
            floorPercentile: 10,
            capPercentile: 80,
            rankWeight: 0.15,
            targetCoverage: 0.12,
            targetVolume: 40
        },
        30: {
            floorPercentile: 15,
            capPercentile: 85,
            rankWeight: 0.2,
            targetCoverage: 0.25,
            targetVolume: 60
        },
        90: {
            floorPercentile: 15,
            capPercentile: 85,
            rankWeight: 0.2,
            targetCoverage: 0.3,
            targetVolume: 50
        }
    },
    friend: {
        7: {
            floorPercentile: 10,
            capPercentile: 80,
            rankWeight: 0.15,
            targetCoverage: 0.12,
            targetVolume: 40
        },
        30: {
            floorPercentile: 15,
            capPercentile: 85,
            rankWeight: 0.2,
            targetCoverage: 0.25,
            targetVolume: 60
        },
        90: {
            floorPercentile: 15,
            capPercentile: 85,
            rankWeight: 0.2,
            targetCoverage: 0.3,
            targetVolume: 50
        }
    }
}[role] as any)[rangeDays] || {
    floorPercentile: 15,
    capPercentile: 85,
    rankWeight: 0.2,
    targetCoverage: 0.25,
    targetVolume: 60
});
}

function pickOverlapNormalizeConfig(rangeDays: number) {
    return (
        {
            7: {
                floorPercentile: 10,
                capPercentile: 80,
                rankWeight: 0.15,
                targetCoverage: 0.08,
                targetVolume: 15
            },
            30: {
                floorPercentile: 15,
                capPercentile: 85,
                rankWeight: 0.2,
                targetCoverage: 0.15,
                targetVolume: 25
            },
            90: {
                floorPercentile: 15,
                capPercentile: 85,
                rankWeight: 0.2,
                targetCoverage: 0.18,
                targetVolume: 20
            }
        }[rangeDays] || {
            floorPercentile: 15,
            capPercentile: 85,
            rankWeight: 0.2,
            targetCoverage: 0.15,
            targetVolume: 25
        }
    );
}
