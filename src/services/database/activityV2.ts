import { dbVars } from '../database';

import sqliteService from '../sqlite';

const ACTIVITY_VIEW_KIND = {
    ACTIVITY: 'activity',
    OVERLAP: 'overlap'
};

function syncStateTable() {
    return `${dbVars.userPrefix}_activity_sync_state_v2`;
}

function sessionsTable() {
    return `${dbVars.userPrefix}_activity_sessions_v2`;
}

function bucketCacheTable() {
    return `${dbVars.userPrefix}_activity_bucket_cache_v2`;
}

function parseJson(value: string, fallback: any) {
    if (!value) {
        return fallback;
    }
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

/**
 * Activity V2 is the formal, stable schema for the refactored Activity tab.
 * Legacy activity_cache_* tables remain only for upgrade compatibility.
 */
const activityV2 = {
    ACTIVITY_VIEW_KIND,

    async getActivitySourceSliceV2({ userId, isSelf, fromDays, toDays = 0 }: any) {
        const fromDateIso = new Date(Date.now() - fromDays * 86400000).toISOString();
        const toDateIso = toDays > 0 ? new Date(Date.now() - toDays * 86400000).toISOString() : '';
        return isSelf
            ? this.getCurrentUserLocationSliceV2(fromDateIso, toDateIso)
            : this.getFriendPresenceSliceV2(userId, fromDateIso, toDateIso);
    },

    async getActivitySourceAfterV2({ userId, isSelf, afterCreatedAt, inclusive = false }: any) {
        return isSelf
            ? this.getCurrentUserLocationAfterV2(afterCreatedAt, inclusive)
            : this.getFriendPresenceAfterV2(userId, afterCreatedAt);
    },

    async getFriendPresenceSliceV2(userId: any, fromDateIso: string, toDateIso = '') {
        const rows: { created_at: any; type: any; }[] = [];
        await sqliteService.execute(
            (dbRow: any) => {
                rows.push({ created_at: dbRow[0], type: dbRow[1] });
            },
            `
                SELECT created_at, type
                FROM (
                    SELECT created_at, type, 0 AS sort_group
                    FROM (
                        SELECT created_at, type
                        FROM ${dbVars.userPrefix}_feed_online_offline
                        WHERE user_id = @userId
                          AND (type = 'Online' OR type = 'Offline')
                          AND created_at < @fromDateIso
                        ORDER BY created_at DESC
                        LIMIT 1
                    )
                    UNION ALL
                    SELECT created_at, type, 1 AS sort_group
                    FROM ${dbVars.userPrefix}_feed_online_offline
                    WHERE user_id = @userId
                      AND (type = 'Online' OR type = 'Offline')
                      AND created_at >= @fromDateIso
                      ${toDateIso ? 'AND created_at < @toDateIso' : ''}
                )
                ORDER BY created_at ASC, sort_group ASC
            `,




            {
                '@userId': userId,
                '@fromDateIso': fromDateIso,
                '@toDateIso': toDateIso
            }
        );

        if (toDateIso) {
            await sqliteService.execute(
                (dbRow: any) => {
                    rows.push({ created_at: dbRow[0], type: dbRow[1] });
                },
                `SELECT created_at, type
                 FROM ${dbVars.userPrefix}_feed_online_offline
                 WHERE user_id = @userId
                   AND (type = 'Online' OR type = 'Offline')
                   AND created_at >= @toDateIso
                 ORDER BY created_at ASC
                 LIMIT 1`,




                {
                    '@userId': userId,
                    '@toDateIso': toDateIso
                }
            );
        }

        return rows.sort((left, right) => left.created_at.localeCompare(right.created_at));
    },

    async getFriendPresenceAfterV2(userId: any, afterCreatedAt: any) {
        const rows: { created_at: any; type: any; }[] = [];
        await sqliteService.execute(
            (dbRow: any) => {
                rows.push({ created_at: dbRow[0], type: dbRow[1] });
            },
            `SELECT created_at, type
             FROM ${dbVars.userPrefix}_feed_online_offline
             WHERE user_id = @userId
               AND (type = 'Online' OR type = 'Offline')
               AND created_at > @afterCreatedAt
             ORDER BY created_at`,




            {
                '@userId': userId,
                '@afterCreatedAt': afterCreatedAt
            }
        );
        return rows;
    },

    async getCurrentUserLocationSliceV2(fromDateIso: string, toDateIso = '') {
        const rows: { created_at: any; time: any; }[] = [];
        await sqliteService.execute(
            (dbRow: any) => {
                rows.push({ created_at: dbRow[0], time: dbRow[1] || 0 });
            },
            `
                SELECT created_at, time
                FROM (
                    SELECT created_at, time, 0 AS sort_group
                    FROM (
                        SELECT created_at, time
                        FROM gamelog_location
                        WHERE created_at < @fromDateIso
                        ORDER BY created_at DESC
                        LIMIT 1
                    )
                    UNION ALL
                    SELECT created_at, time, 1 AS sort_group
                    FROM gamelog_location
                    WHERE created_at >= @fromDateIso
                      ${toDateIso ? 'AND created_at < @toDateIso' : ''}
                    ${
                        toDateIso
                            ? `UNION ALL
                    SELECT created_at, time, 2 AS sort_group
                    FROM (
                        SELECT created_at, time
                        FROM gamelog_location
                        WHERE created_at >= @toDateIso
                        ORDER BY created_at
                        LIMIT 1
                    )`
                            : ''
                    }
                )
                ORDER BY created_at ASC, sort_group ASC
            `,




            {
                '@fromDateIso': fromDateIso,
                '@toDateIso': toDateIso
            }
        );
        return rows;
    },

    async getCurrentUserLocationAfterV2(afterCreatedAt: any, inclusive = false) {
        const rows: { created_at: any; time: any; }[] = [];
        const operator = inclusive ? '>=' : '>';
        await sqliteService.execute(
            (dbRow: any) => {
                rows.push({ created_at: dbRow[0], time: dbRow[1] || 0 });
            },
            `SELECT created_at, time
             FROM gamelog_location
             WHERE created_at ${operator} @afterCreatedAt
             ORDER BY created_at`,




            { '@afterCreatedAt': afterCreatedAt }
        );
        return rows;
    },

    async getActivitySyncStateV2(userId: any) {
        let row = null;
        await sqliteService.execute(
            (dbRow: any) => {
                row = {
                    userId: dbRow[0],
                    updatedAt: dbRow[1] || '',
                    isSelf: Boolean(dbRow[2]),
                    sourceLastCreatedAt: dbRow[3] || '',
                    pendingSessionStartAt: typeof dbRow[4] === 'number' ? dbRow[4] : null,
                    cachedRangeDays: dbRow[5] || 0
                };
            },
            `SELECT user_id, updated_at, is_self, source_last_created_at, pending_session_start_at, cached_range_days
             FROM ${syncStateTable()}
             WHERE user_id = @userId`,




            { '@userId': userId }
        );
        return row;
    },

    async upsertActivitySyncStateV2(entry: { userId: any; updatedAt: any; isSelf: any; sourceLastCreatedAt: any; pendingSessionStartAt: any; cachedRangeDays: any; }) {
        await sqliteService.executeNonQuery(
            `INSERT OR REPLACE INTO ${syncStateTable()}
             (user_id, updated_at, is_self, source_last_created_at, pending_session_start_at, cached_range_days)
             VALUES (@userId, @updatedAt, @isSelf, @sourceLastCreatedAt, @pendingSessionStartAt, @cachedRangeDays)`,




            {
                '@userId': entry.userId,
                '@updatedAt': entry.updatedAt || '',
                '@isSelf': entry.isSelf ? 1 : 0,
                '@sourceLastCreatedAt': entry.sourceLastCreatedAt || '',
                '@pendingSessionStartAt': entry.pendingSessionStartAt,
                '@cachedRangeDays': entry.cachedRangeDays || 0
            }
        );
    },

    async getActivitySessionsV2(userId: any) {
        const sessions: { start: any; end: any; isOpenTail: boolean; sourceRevision: any; }[] = [];
        await sqliteService.execute(
            (dbRow: any) => {
                sessions.push({
                    start: dbRow[0],
                    end: dbRow[1],
                    isOpenTail: Boolean(dbRow[2]),
                    sourceRevision: dbRow[3] || ''
                });
            },
            `SELECT start_at, end_at, is_open_tail, source_revision
             FROM ${sessionsTable()}
             WHERE user_id = @userId
             ORDER BY start_at`,




            { '@userId': userId }
        );
        return sessions;
    },

    async replaceActivitySessionsV2(userId: any, sessions = []) {
        await sqliteService.executeNonQuery('BEGIN');
        try {




            await sqliteService.executeNonQuery(`DELETE FROM ${sessionsTable()} WHERE user_id = @userId`, {
                '@userId': userId
            });
            await insertSessions(userId, sessions);
            await sqliteService.executeNonQuery('COMMIT');
        } catch (error) {
            await sqliteService.executeNonQuery('ROLLBACK');
            throw error;
        }
    },

    async appendActivitySessionsV2({ userId, sessions = [], replaceFromStartAt = null }: any) {
        await sqliteService.executeNonQuery('BEGIN');
        try {
            if (replaceFromStartAt !== null) {
                await sqliteService.executeNonQuery(
                    `DELETE FROM ${sessionsTable()}
                     WHERE user_id = @userId AND start_at >= @replaceFromStartAt`,




                    {
                        '@userId': userId,
                        '@replaceFromStartAt': replaceFromStartAt
                    }
                );
            }
            await insertSessions(userId, sessions);
            await sqliteService.executeNonQuery('COMMIT');
        } catch (error) {
            await sqliteService.executeNonQuery('ROLLBACK');
            throw error;
        }
    },

    async getActivityBucketCacheV2({ ownerUserId, targetUserId = '', rangeDays, viewKind, excludeKey = '' }: any) {
        let row = null;
        await sqliteService.execute(
            (dbRow: any) => {
                row = {
                    ownerUserId: dbRow[0],
                    targetUserId: dbRow[1],
                    rangeDays: dbRow[2],
                    viewKind: dbRow[3],
                    excludeKey: dbRow[4] || '',
                    bucketVersion: dbRow[5] || 1,
                    builtFromCursor: dbRow[6] || '',
                    rawBuckets: parseJson(dbRow[7], []),
                    normalizedBuckets: parseJson(dbRow[8], []),
                    summary: parseJson(dbRow[9], {}),
                    builtAt: dbRow[10] || ''
                };
            },
            `SELECT user_id, target_user_id, range_days, view_kind, exclude_key, bucket_version, built_from_cursor, raw_buckets_json, normalized_buckets_json, summary_json, built_at
             FROM ${bucketCacheTable()}
             WHERE user_id = @ownerUserId AND target_user_id = @targetUserId AND range_days = @rangeDays AND view_kind = @viewKind AND exclude_key = @excludeKey`,




            {
                '@ownerUserId': ownerUserId,
                '@targetUserId': targetUserId,
                '@rangeDays': rangeDays,
                '@viewKind': viewKind,
                '@excludeKey': excludeKey
            }
        );
        return row;
    },

    async upsertActivityBucketCacheV2(entry: { ownerUserId: any; rangeDays: any; viewKind: any; builtFromCursor: any; rawBuckets: any; normalizedBuckets: any; summary: any; builtAt: any; targetUserId?: any; excludeKey?: any; bucketVersion?: any; }) {
        await sqliteService.executeNonQuery(
            `INSERT OR REPLACE INTO ${bucketCacheTable()}
             (user_id, target_user_id, range_days, view_kind, exclude_key, bucket_version, built_from_cursor, raw_buckets_json, normalized_buckets_json, summary_json, built_at)
             VALUES (@ownerUserId, @targetUserId, @rangeDays, @viewKind, @excludeKey, @bucketVersion, @builtFromCursor, @rawBucketsJson, @normalizedBucketsJson, @summaryJson, @builtAt)`,




            {
                '@ownerUserId': entry.ownerUserId,
                '@targetUserId': entry.targetUserId || '',
                '@rangeDays': entry.rangeDays,
                '@viewKind': entry.viewKind,
                '@excludeKey': entry.excludeKey || '',
                '@bucketVersion': entry.bucketVersion || 1,
                '@builtFromCursor': entry.builtFromCursor || '',
                '@rawBucketsJson': JSON.stringify(entry.rawBuckets || []),
                '@normalizedBucketsJson': JSON.stringify(entry.normalizedBuckets || []),
                '@summaryJson': JSON.stringify(entry.summary || {}),
                '@builtAt': entry.builtAt || ''
            }
        );
    }
};

async function insertSessions(userId: any, sessions = []) {
    if (sessions.length === 0) {
        return;
    }

    const chunkSize = 250;
    for (let chunkStart = 0; chunkStart < sessions.length; chunkStart += chunkSize) {
        const chunk = sessions.slice(chunkStart, chunkStart + chunkSize);
        const args = {};
        const values = chunk.map((session, index) => {
            const suffix = `${chunkStart + index}`;
            (args as any)[`@userId_${suffix}`] = userId;
            (args as any)[`@startAt_${suffix}`] = (session as any).start;
            (args as any)[`@endAt_${suffix}`] = (session as any).end;
            (args as any)[`@isOpenTail_${suffix}`] = (session as any).isOpenTail ? 1 : 0;
            (args as any)[`@sourceRevision_${suffix}`] = (session as any).sourceRevision || '';
            return `(@userId_${suffix}, @startAt_${suffix}, @endAt_${suffix}, @isOpenTail_${suffix}, @sourceRevision_${suffix})`;
        });

        await sqliteService.executeNonQuery(
            `INSERT OR REPLACE INTO ${sessionsTable()}
             (user_id, start_at, end_at, is_open_tail, source_revision)
             VALUES ${values.join(', ')}`,




            args
        );
    }
}

export { activityV2 };
