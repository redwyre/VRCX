import {
    compareByLastActive,
    compareByLastSeen,
    compareByLocation,
    compareByName,
    compareByPrivate,
    compareByStatus,
    compareByTimeInInstance
} from './compare';

/**
 * @param {string[]} sortMethods
 * @returns
 */
function getFriendsSortFunction(sortMethods: string[]) {
    const sorts: any = [];
    for (const sortMethod of sortMethods) {
        switch (sortMethod) {
            case 'Sort Alphabetically':
                sorts.push(compareByName);
                break;
            case 'Sort Private to Bottom':
                sorts.push(compareByPrivate);
                break;
            case 'Sort by Status':
                sorts.push(compareByStatus);
                break;
            case 'Sort by Last Active':
                sorts.push(compareByLastActive);
                break;
            case 'Sort by Last Seen':
                sorts.push(compareByLastSeen);
                break;
            case 'Sort by Time in Instance':
                sorts.push(compareByTimeInInstance);
                break;
            case 'Sort by Location':
                sorts.push(compareByLocation);
                break;
            case 'None':
                sorts.push(() => 0);
                break;
        }
    }
    sorts.push(compareByName);

    /**
     * @param {object} a
     * @param {object} b
     * @returns {number}
     */
    return (a: object, b: object) => {
        let res;
        for (const sort of sorts) {
            res = sort(a, b);
            if (res !== 0) {
                return res;
            }
        }
        return res;
    };
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function sortStatus(a: string, b: string) {
    switch (b) {
        case 'join me':
            switch (a) {
                case 'active':
                    return 1;
                case 'ask me':
                    return 1;
                case 'busy':
                    return 1;
                case 'offline':
                    return 1;
            }
            break;
        case 'active':
            switch (a) {
                case 'join me':
                    return -1;
                case 'ask me':
                    return 1;
                case 'busy':
                    return 1;
                case 'offline':
                    return 1;
            }
            break;
        case 'ask me':
            switch (a) {
                case 'join me':
                    return -1;
                case 'active':
                    return -1;
                case 'busy':
                    return 1;
                case 'offline':
                    return 1;
            }
            break;
        case 'busy':
            switch (a) {
                case 'join me':
                    return -1;
                case 'active':
                    return -1;
                case 'ask me':
                    return -1;
                case 'offline':
                    return 1;
            }
            break;
        case 'offline':
            switch (a) {
                case 'join me':
                    return -1;
                case 'active':
                    return -1;
                case 'ask me':
                    return -1;
                case 'busy':
                    return -1;
            }
            break;
    }
    return 0;
}

/**
 * @param {object} friend
 * @returns {boolean}
 */
function isFriendOnline(friend: object) {
    if (typeof friend === 'undefined' || typeof (friend as any)?.ref === 'undefined') {
        return false;
    }
    if ((friend as any).state === 'online') {
        return true;
    }
    if ((friend as any).state !== 'online' && (friend as any).ref.location !== 'private') {
        // wat
        return true;
    }
    return false;
}

export { getFriendsSortFunction, sortStatus, isFriendOnline };
