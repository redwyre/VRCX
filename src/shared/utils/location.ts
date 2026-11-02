import { isRealInstance } from './instance';

export { parseLocation, displayLocation, resolveRegion, translateAccessType } from './locationParser';

/**
 * @param {Array} friendsArr
 * @param {object} lastLocation - Last location from location store
 * @param {Map<string, any>} lastLocation.friendList
 * @param {string} lastLocation.location
 */
function getFriendsLocations(friendsArr: Array<any>, lastLocation: {
    friendList: Map<string, any>;
    location: string;
}) {
    // prevent the instance title display as "Traveling".
    if (!friendsArr?.length) {
        return '';
    }
    for (const friend of friendsArr) {
        if (isRealInstance(friend.ref?.location)) {
            return friend.ref.location;
        }
    }
    for (const friend of friendsArr) {
        if (isRealInstance(friend.ref?.travelingToLocation)) {
            return friend.ref.travelingToLocation;
        }
    }
    if (lastLocation) {
        for (const friend of friendsArr) {
            if (lastLocation.friendList.has(friend.id)) {
                return lastLocation.location;
            }
        }
    }
    return friendsArr[0].ref?.location;
}

export { getFriendsLocations };

/**
 * Get the display text for a location — synchronous, pure function.
 * Does NOT handle async world name lookups (those stay in the component).
 *
 * @param {object} L - Parsed location object from parseLocation()
 * @param {object} options
 * @param {string} [options.hint] - Hint string (e.g. from props)
 * @param {string | undefined} [options.worldName] - Cached world name, if available
 * @param {string} options.accessTypeLabel - Translated access type label
 * @param {Function} options.t - I18n translate function
 * @returns {string} Display text for the location
 */
function getLocationText(L: object, { hint, worldName, accessTypeLabel, t }: {
    hint?: string;
    worldName?: string | undefined;
    accessTypeLabel: string;
    t: Function;
}) {
    if ((L as any).isOffline) {
        return t('location.offline');
    }
    if ((L as any).isPrivate) {
        return t('location.private');
    }
    if ((L as any).isTraveling) {
        return t('location.traveling');
    }
    if (typeof hint === 'string' && hint !== '') {
        return (L as any).instanceId ? `${hint} · ${accessTypeLabel}` : hint;
    }
    if ((L as any).worldId) {
        const name = worldName || (L as any).worldId;
        return (L as any).instanceId ? `${name} · ${accessTypeLabel}` : name;
    }
    return '';
}

export { getLocationText };
