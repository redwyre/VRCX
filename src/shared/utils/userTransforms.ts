import { removeEmojis, replaceBioSymbols } from './base/string';

/**
 * Sanitize user JSON fields before applying to cache.
 * Applies replaceBioSymbols to statusDescription, bio, note;
 * removeEmojis to statusDescription;
 * strips robot avatar URL.
 *
 * @param {object} json - Raw user API response
 * @param {string} robotUrl - The robot/default avatar URL to strip
 * @returns {object} The mutated json (same reference)
 */
export function sanitizeUserJson(json: object, robotUrl: string) {
    if ((json as any).statusDescription) {
        (json as any).statusDescription = replaceBioSymbols((json as any).statusDescription);
        (json as any).statusDescription = removeEmojis((json as any).statusDescription);
    }
    if ((json as any).note) {
        (json as any).note = replaceBioSymbols((json as any).note);
    }
    if (robotUrl && (json as any).currentAvatarImageUrl === robotUrl) {
        delete (json as any).currentAvatarImageUrl;
        delete (json as any).currentAvatarThumbnailImageUrl;
    }
    return json;
}

/**
 * Compute trust level, moderator status, and troll status from user tags.
 * Pure function — no store dependencies.
 *
 * @param {string[]} tags - User tags array
 * @param {string} developerType - User's developerType field
 * @returns {{
 *     trustLevel: string;
 *     trustClass: string;
 *     trustSortNum: number;
 *     isModerator: boolean;
 *     isTroll: boolean;
 *     isProbableTroll: boolean;
 *     trustColorKey: string;
 * }}
 */
export function computeTrustLevel(tags: string[], developerType: string) {
    let isModerator = Boolean(developerType) && developerType !== 'none';
    let isTroll = false;
    let isProbableTroll = false;
    let trustLevel = 'Visitor';
    let trustClass = 'x-tag-untrusted';
    let trustColorKey = 'untrusted';
    let trustSortNum = 1;

    if (tags.includes('admin_moderator')) {
        isModerator = true;
    }
    if (tags.includes('system_troll')) {
        isTroll = true;
    }
    if (tags.includes('system_probable_troll') && !isTroll) {
        isProbableTroll = true;
    }

    if (tags.includes('system_trust_veteran')) {
        trustLevel = 'Trusted User';
        trustClass = 'x-tag-veteran';
        trustColorKey = 'veteran';
        trustSortNum = 5;
    } else if (tags.includes('system_trust_trusted')) {
        trustLevel = 'Known User';
        trustClass = 'x-tag-trusted';
        trustColorKey = 'trusted';
        trustSortNum = 4;
    } else if (tags.includes('system_trust_known')) {
        trustLevel = 'User';
        trustClass = 'x-tag-known';
        trustColorKey = 'known';
        trustSortNum = 3;
    } else if (tags.includes('system_trust_basic')) {
        trustLevel = 'New User';
        trustClass = 'x-tag-basic';
        trustColorKey = 'basic';
        trustSortNum = 2;
    }

    if (isTroll || isProbableTroll) {
        trustColorKey = 'troll';
        trustSortNum += 0.1;
    }
    if (isModerator) {
        trustColorKey = 'vip';
        trustSortNum += 0.3;
    }

    return {
        trustLevel,
        trustClass,
        trustSortNum,
        isModerator,
        isTroll,
        isProbableTroll,
        trustColorKey
    };
}

/**
 * Determine the effective user platform.
 *
 * @param {string} platform - Current platform
 * @param {string} lastPlatform - Last known platform
 * @returns {string} Resolved platform
 */
export function computeUserPlatform(platform: string, lastPlatform: string) {
    if (platform && platform !== 'offline' && platform !== 'web') {
        return platform;
    }
    return lastPlatform || '';
}

/**
 * Detect which properties changed between an existing ref and incoming JSON.
 * Compares primitives directly; arrays via arraysMatchFn.
 *
 * @param {object} ref - The existing cached object
 * @param {object} json - The incoming update
 * @param {(a: any[], b: any[]) => boolean} arraysMatchFn - Function to compare arrays
 * @returns {{ hasPropChanged: boolean; changedProps: object }}
 */
export function diffObjectProps(ref: object, json: object, arraysMatchFn: (a: any[], b: any[]) => boolean) {
    const changedProps = {};
    let hasPropChanged = false;

    // Only compare primitive values
    for (const prop in ref) {
        if (typeof (json as any)[prop] === 'undefined') {
            continue;
        }
        if ((ref as any)[prop] === null || typeof (ref as any)[prop] !== 'object') {
            (changedProps as any)[prop] = true;
        }
    }

    // Check json props against ref (including array comparison)
    for (const prop in json) {
        if (typeof (ref as any)[prop] === 'undefined') {
            continue;
        }
        if (Array.isArray((json as any)[prop]) && Array.isArray((ref as any)[prop])) {
            if (!arraysMatchFn((json as any)[prop], (ref as any)[prop])) {
                (changedProps as any)[prop] = true;
            }
        } else if ((json as any)[prop] === null || typeof (json as any)[prop] !== 'object') {
            (changedProps as any)[prop] = true;
        }
    }

    // Resolve actual changes
    for (const prop in changedProps) {
        const asIs = (ref as any)[prop];
        const toBe = (json as any)[prop];
        if (asIs === toBe) {
            delete (changedProps as any)[prop];
        } else {
            hasPropChanged = true;
            (changedProps as any)[prop] = [toBe, asIs];
        }
    }

    return { hasPropChanged, changedProps };
}

/**
 * Create a default user ref object with all expected fields.
 * Returns a plain object (caller wraps in reactive() if needed).
 *
 * @param {Partial<import('@/types/vrcx').VrcxUser>} json - API response to merge
 * @returns {import('@/types/vrcx').VrcxUser} Default user object with json spread on top
 */




export function createDefaultUserRef(json: Partial<import('@/types/vrcx').VrcxUser>) {
    return ({
        acceptedPrivacyVersion: 0,
        acceptedTOSVersion: 0,
        accountDeletionDate: null,
        accountDeletionLog: null,
        ageVerificationStatus: '',
        ageVerified: false,
        allowAvatarCopying: false,
        appleDetails: {},
        badges: [],
        bannerColor: '',
        bannerType: '',
        bannerUrl: '',
        bio: '',
        bioLinks: [],
        currentAvatarImageUrl: '',
        currentAvatarTags: [],
        currentAvatarThumbnailImageUrl: '',
        date_joined: '',
        developerType: '',
        discordId: '',
        displayName: '',
        friendKey: '',
        friendRequestStatus: '',
        iconFrame: '',
        iconUrl: '',
        id: '',
        instanceId: '',
        isEconomyCreator: false,
        isFriend: false,
        last_activity: '',
        last_login: '',
        last_mobile: null,
        last_platform: '',
        location: '',
        nameplateEffect: '',
        platform: '',
        note: null,
        profileEffect: '',
        profilePicOverride: '',
        profilePicOverrideThumbnail: '',
        pronouns: '',
        state: '',
        status: '',
        statusDescription: '',
        tags: [],
        travelingToInstance: '',
        travelingToLocation: '',
        travelingToWorld: '',
        userIcon: '',
        worldId: '',
        // only in bulk request
        fallbackAvatar: '',
        // VRCX
        $location: {},
        $location_at: Date.now(),
        $online_for: Date.now(),
        $travelingToTime: Date.now(),
        $offline_for: null,
        $active_for: Date.now(),
        $isVRCPlus: false,
        $isModerator: false,
        $isTroll: false,
        $isProbableTroll: false,
        $trustLevel: 'Visitor',
        $trustClass: 'x-tag-untrusted',
        $userColour: '',
        $trustSortNum: 1,
        $languages: [],
        $joinCount: 0,
        $timeSpent: 0,
        $lastSeen: '',
        $mutualCount: 0,
        $mutualOptedOut: false,
        $nickName: '',
        $memo: '',
        $previousLocation: '',
        $customTag: '',
        $customTagColour: '',
        $friendNumber: 0,
        $platform: '',
        $moderations: {},
        //
        ...json
    } as import('@/types/vrcx').VrcxUser);
}
