import { sortStatus } from './friend';

/**
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByName(a: object, b: object) {
    if (typeof (a as any).name !== 'string' || typeof (b as any).name !== 'string') {
        return 0;
    }
    return (a as any).name.localeCompare((b as any).name);
}

/**
 * Descending
 *
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByCreatedAt(a: object, b: object) {
    if (typeof (a as any).created_at !== 'string' || typeof (b as any).created_at !== 'string') {
        return 0;
    }
    const A = (a as any).created_at.toUpperCase();
    const B = (b as any).created_at.toUpperCase();
    if (A < B) {
        return 1;
    }
    if (A > B) {
        return -1;
    }
    return 0;
}

/**
 * Ascending
 *
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByCreatedAtAscending(a: object, b: object) {
    const A = (a as any).created_at;
    const B = (b as any).created_at;
    if (A < B) {
        return -1;
    }
    if (A > B) {
        return 1;
    }
    return 0;
}

/**
 * Descending
 *
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByUpdatedAt(a: object, b: object) {
    if (typeof (a as any).updated_at !== 'string' || typeof (b as any).updated_at !== 'string') {
        return 0;
    }
    const A = (a as any).updated_at.toUpperCase();
    const B = (b as any).updated_at.toUpperCase();
    if (A < B) {
        return 1;
    }
    if (A > B) {
        return -1;
    }
    return 0;
}

/**
 * Ascending
 *
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByDisplayName(a: object, b: object) {
    if (typeof (a as any).displayName !== 'string' || typeof (b as any).displayName !== 'string') {
        return 0;
    }
    return (a as any).displayName.localeCompare((b as any).displayName);
}

/**
 * Ascending
 *
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareById(a: object, b: object) {
    if (typeof (a as any).id !== 'string' || typeof (b as any).id !== 'string') {
        return 0;
    }
    return (a as any).id.localeCompare((b as any).id);
}

/**
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByMemberCount(a: object, b: object) {
    if (typeof (a as any).memberCount !== 'number' || typeof (b as any).memberCount !== 'number') {
        return 0;
    }
    return (a as any).memberCount - (b as any).memberCount;
}

/**
 * Private
 *
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByPrivate(a: object, b: object) {
    if (typeof (a as any).ref === 'undefined' || typeof (b as any).ref === 'undefined') {
        return 0;
    }
    if ((a as any).ref.location === 'private' && (b as any).ref.location === 'private') {
        return 0;
    } else if ((a as any).ref.location === 'private') {
        return 1;
    } else if ((b as any).ref.location === 'private') {
        return -1;
    }
    return 0;
}

/**
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByStatus(a: object, b: object) {
    if (typeof (a as any).ref === 'undefined' || typeof (b as any).ref === 'undefined') {
        return 0;
    }
    if ((a as any).ref.status === (b as any).ref.status) {
        return 0;
    }
    if ((a as any).ref.state === 'offline') {
        return 1;
    }
    return sortStatus((a as any).ref.status, (b as any).ref.status);
}

/**
 * Last active
 *
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByLastActive(a: object, b: object) {
    if ((a as any).state === 'online' && (b as any).state === 'online') {
        if ((a as any).ref?.$online_for && (b as any).ref?.$online_for && (a as any).ref.$online_for === (b as any).ref.$online_for) {
            return compareByActivityField(a, b, 'last_login');
        }
        return compareByActivityField(a, b, '$online_for');
    }

    return compareByActivityField(a, b, 'last_activity');
}

function compareByLastActiveRef(a: { state: any; $online_for?: any; last_login?: any; last_activity?: any; }, b: { state: any; $online_for?: any; last_login?: any; last_activity?: any; }) {
    if (a.state === 'online' && b.state === 'online') {
        if (a.$online_for && b.$online_for && a.$online_for === b.$online_for) {
            return a.last_login < b.last_login ? 1 : -1;
        }
        return a.$online_for < b.$online_for ? 1 : -1;
    }
    return a.last_activity < b.last_activity ? 1 : -1;
}

/**
 * Last seen
 *
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByLastSeen(a: object, b: object) {
    return compareByActivityField(a, b, '$lastSeen');
}

/**
 * @param {object} a
 * @param {object} b
 * @param {string} field
 * @returns
 */
function compareByActivityField(a: object, b: object, field: string) {
    if (typeof (a as any).ref === 'undefined' || typeof (b as any).ref === 'undefined') {
        return 0;
    }

    // When the field is just and empty string, it means they've been
    // in whatever active state for the longest
    if ((a as any).ref[field] < (b as any).ref[field] || ((a as any).ref[field] !== '' && (b as any).ref[field] === '')) {
        return 1;
    }
    if ((a as any).ref[field] > (b as any).ref[field] || ((a as any).ref[field] === '' && (b as any).ref[field] !== '')) {
        return -1;
    }
    return 0;
}

function compareByTimeInInstance(a: { ref: { $location_at: number; }; pendingOffline: any; }, b: { ref: { $location_at: number; }; pendingOffline: any; }) {
    if (!a.ref || !b.ref) {
        return 0;
    }
    // pending offline should be sorted to the bottom
    if (a.pendingOffline && !b.pendingOffline) {
        return 1;
    }
    if (!a.pendingOffline && b.pendingOffline) {
        return -1;
    }

    // sort by time in instance (newer first)
    return b.ref.$location_at - a.ref.$location_at;
}

/**
 * Location at
 *
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByLocationAt(a: object, b: object) {
    if ((a as any).location === 'traveling' && (b as any).location === 'traveling') {
        return 0;
    }
    if ((a as any).location === 'traveling') {
        return 1;
    }
    if ((b as any).location === 'traveling') {
        return -1;
    }
    if ((a as any).$location_at < (b as any).$location_at) {
        return -1;
    }
    if ((a as any).$location_at > (b as any).$location_at) {
        return 1;
    }
    return 0;
}

/**
 * Location at but for the sidebar
 *
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByLocation(a: object, b: object) {
    if (typeof (a as any).ref === 'undefined' || typeof (b as any).ref === 'undefined') {
        return 0;
    }
    if ((a as any).state !== 'online' || (b as any).state !== 'online') {
        return 0;
    }

    return (a as any).ref.location.localeCompare((b as any).ref.location);
}

/**
 * $friendNumber friend order
 *
 * @param {object} a
 * @param {object} b
 * @returns
 */
function compareByFriendOrder(a: object, b: object) {
    if (typeof a === 'undefined' || typeof b === 'undefined') {
        return 0;
    }
    return (b as any).$friendNumber - (a as any).$friendNumber;
}

export {
    compareByName,
    compareByCreatedAt,
    compareByCreatedAtAscending,
    compareByUpdatedAt,
    compareByDisplayName,
    compareById,
    compareByMemberCount,
    compareByPrivate,
    compareByStatus,
    compareByLastActive,
    compareByLastActiveRef,
    compareByLastSeen,
    compareByLocationAt,
    compareByLocation,
    compareByFriendOrder,
    compareByTimeInInstance
};
