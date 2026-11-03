import { HueToHex } from './base/ui';
import { convertFileUrlToImageUrl } from './common';
import { languageMappings } from '../constants';
import { removeEmojis } from './base/string';

const THEME_COLOR_LIMITS = Object.freeze({
    darkMinLuminance: 0.06,
    lightMaxLuminance: 0.74
});

/**
 * @param {object} ctx
 * @returns {string | null}
 */
function userOnlineForTimestamp(ctx: object) {
    if ((ctx as any).ref.state === 'online' && (ctx as any).ref.$online_for) {
        return new Date((ctx as any).ref.$online_for).toJSON();
    } else if ((ctx as any).ref.state === 'active' && (ctx as any).ref.$active_for) {
        return new Date((ctx as any).ref.$active_for).toJSON();
    } else if ((ctx as any).ref.$offline_for) {
        return new Date((ctx as any).ref.$offline_for).toJSON();
    }
    return null;
}

/**
 * @param {string} language
 * @returns
 */
function languageClass(language: string) {
    const style: { unknown?: boolean } = {};
    const mapping = languageMappings[language as keyof typeof languageMappings];
    if (typeof mapping !== 'undefined') {
        (style as any)[mapping] = true;
    } else {
        style.unknown = true;
    }
    return style;
}

/**
 * @param {string} userId
 * @param {boolean} isDarkMode
 * @returns
 */
async function getNameColour(userId: string, isDarkMode: boolean) {
    const hue = await (AppApi as any).GetColourFromUserID(userId);
    return HueToHex(hue, isDarkMode);
}

/**
 * @param {string} value
 * @returns {string | null}
 */
function normalizeProfileHex(value: string) {
    const hex = String(value || '')
        .trim()
        .replace(/^#/, '')
        .toLowerCase();
    if (!/^[0-9a-f]{6}$/.test(hex)) {
        return null;
    }
    return `#${hex}`;
}

/**
 * @param {string} hex
 * @returns {{ r: number; g: number; b: number } | null}
 */
function hexToRgb(hex: string) {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!match) {
        return null;
    }
    const value = match[1];
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16)
    };
}

/**
 * @param {{ r: number; g: number; b: number }} rgb
 * @returns {string}
 */
function rgbToHex(rgb: { r: number; g: number; b: number }) {
    const toHex = (value: number) => {
        const n = Math.max(0, Math.min(255, Math.round(value)));
        return n.toString(16).padStart(2, '0');
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * @param {{ r: number; g: number; b: number }} rgb
 * @returns {number}
 */
function getRelativeLuminance(rgb: { r: number; g: number; b: number }) {
    const channel = (value: number) => {
        const normalized = value / 255;
        if (normalized <= 0.03928) {
            return normalized / 12.92;
        }
        return ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const r = channel(rgb.r);
    const g = channel(rgb.g);
    const b = channel(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @param {{ r: number; g: number; b: number }} from
 * @param {{ r: number; g: number; b: number }} to
 * @param {number} weight
 * @returns {{ r: number; g: number; b: number }}
 */
function mixRgb(from: { r: number; g: number; b: number }, to: { r: number; g: number; b: number }, weight: number) {
    return {
        r: from.r + (to.r - from.r) * weight,
        g: from.g + (to.g - from.g) * weight,
        b: from.b + (to.b - from.b) * weight
    };
}

/**
 * @param {string} colorValue
 * @param {string} fallback
 * @param {boolean} isDarkMode
 * @returns {string}
 */
function getReadableProfileThemeColor(colorValue: string, fallback: string, isDarkMode: boolean) {
    const normalized = normalizeProfileHex(colorValue);
    if (!normalized) {
        return fallback;
    }
    let rgb = hexToRgb(normalized);
    if (!rgb) {
        return fallback;
    }

    const luminanceThreshold = isDarkMode ? THEME_COLOR_LIMITS.darkMinLuminance : THEME_COLOR_LIMITS.lightMaxLuminance;
    let luminance = getRelativeLuminance(rgb);
    const requiresAdjustment = isDarkMode ? luminance < luminanceThreshold : luminance > luminanceThreshold;
    if (!requiresAdjustment) {
        return normalized;
    }

    // Nudge only extreme values so profile colors remain recognizable.
    const targetRgb = isDarkMode ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
    for (let i = 0; i < 14; i++) {
        rgb = mixRgb(rgb, targetRgb, 0.18);
        luminance = getRelativeLuminance(rgb);
        if ((isDarkMode && luminance >= luminanceThreshold) || (!isDarkMode && luminance <= luminanceThreshold)) {
            break;
        }
    }
    return rgbToHex(rgb);
}

/**
 * @param {string} colorValue
 * @returns {string}
 */
function invertHexColor(colorValue: string) {
    const normalized = normalizeProfileHex(colorValue);
    if (!normalized) {
        return colorValue;
    }
    const rgb = hexToRgb(normalized);
    if (!rgb) {
        return colorValue;
    }
    const invertedRgb = {
        r: 255 - rgb.r,
        g: 255 - rgb.g,
        b: 255 - rgb.b
    };
    return rgbToHex(invertedRgb);
}

/**
 * @param {object} user
 * @param {boolean} pendingOffline
 * @param {object} currentUser - Current user object from useUserStore
 * @returns
 */
function userStatusClass(
    user: object,
    pendingOffline: boolean = false,
    currentUser: object
): Record<string, boolean> | null {
    const style = {
        'status-icon': true
    };
    if (typeof user === 'undefined') {
        return null;
    }
    let id = '';
    if ((user as any).id) {
        id = (user as any).id;
    } else if ((user as any).userId) {
        id = (user as any).userId;
    }
    if (id === (currentUser as any)?.id) {
        const platform = (currentUser as any).presence?.platform;
        return {
            ...style,
            ...statusClass((user as any).status),
            mobile: platform && platform !== 'standalonewindows' && platform !== 'web'
        };
    }
    if (!(user as any).isFriend) {
        return null;
    }
    if (pendingOffline) {
        // Pending offline
        (style as any).offline = true;
    } else if (
        (user as any).status !== 'active' &&
        (user as any).location === 'private' &&
        (user as any).state === '' &&
        id &&
        !((currentUser as any)?.onlineFriends || []).includes(id)
    ) {
        // temp fix
        if (((currentUser as any)?.activeFriends || []).includes(id)) {
            // Active
            if ((user as any).status === 'join me') {
                style['active-joinme' as keyof typeof style] = true;
            } else if ((user as any).status === 'ask me') {
                style['active-askme' as keyof typeof style] = true;
            } else if ((user as any).status === 'busy') {
                style['active-busy' as keyof typeof style] = true;
            } else {
                (style as any).active = true;
            }
        } else {
            // Offline
            (style as any).offline = true;
        }
    } else if ((user as any).state === 'active') {
        // Active
        if ((user as any).status === 'join me') {
            style['active-joinme' as keyof typeof style] = true;
        } else if ((user as any).status === 'ask me') {
            style['active-askme' as keyof typeof style] = true;
        } else if ((user as any).status === 'busy') {
            style['active-busy' as keyof typeof style] = true;
        } else {
            (style as any).active = true;
        }
    } else if ((user as any).location === 'offline') {
        // Offline
        (style as any).offline = true;
    } else if ((user as any).status === 'active') {
        // Online
        (style as any).online = true;
    } else if ((user as any).status === 'join me') {
        // Join Me
        (style as any).joinme = true;
    } else if ((user as any).status === 'ask me') {
        // Ask Me
        (style as any).askme = true;
    } else if ((user as any).status === 'busy') {
        // Do Not Disturb
        (style as any).busy = true;
    } else {
        // Unknown status
        return null;
    }
    if (
        (user as any).$platform &&
        (user as any).$platform !== 'standalonewindows' &&
        (user as any).$platform !== 'web' &&
        (user as any).state === 'online'
    ) {
        (style as any).mobile = true;
    }
    return style;
}

/**
 * @param {string} status
 * @returns {object}
 */
function statusClass(status: string) {
    if (typeof status === 'undefined') {
        return null;
    }
    const style = {
        'status-icon': true
    };
    if (status === 'active') {
        // Online
        (style as any).online = true;
    } else if (status === 'join me') {
        // Join Me
        (style as any).joinme = true;
    } else if (status === 'ask me') {
        // Ask Me
        (style as any).askme = true;
    } else if (status === 'busy') {
        // Do Not Disturb
        (style as any).busy = true;
    } else {
        return null;
    }
    return style;
}

/**
 * @param {object} user - User Ref Object
 * @param {boolean} isIcon - Is use for icon (about 40x40)
 * @param {string} resolution - Requested icon resolution (default 128),
 * @returns {string} - Img url
 */
function userImage(user: object, isIcon: boolean = false, resolution: string = '128') {
    if (!user) {
        return '';
    }
    if ((user as any).iconUrl) {
        if (isIcon) {
            return convertFileUrlToImageUrl((user as any).iconUrl);
        }
        return (user as any).iconUrl;
    }
    if ((user as any).thumbnailUrl) {
        return (user as any).thumbnailUrl;
    }
    if ((user as any).currentAvatarThumbnailImageUrl) {
        if (isIcon) {
            return (user as any).currentAvatarThumbnailImageUrl.replace('/256', `/${resolution}`);
        }
        return (user as any).currentAvatarThumbnailImageUrl;
    }
    if ((user as any).currentAvatarImageUrl) {
        if (isIcon) {
            return convertFileUrlToImageUrl((user as any).currentAvatarImageUrl);
        }
        return (user as any).currentAvatarImageUrl;
    }
    return '';
}

/**
 * @param {object} user
 * @returns {string | any}
 */
function userImageFull(user: object) {
    if (!user) {
        return '';
    }
    if ((user as any).iconUrl) {
        return (user as any).iconUrl;
    }
    if ((user as any).profilePicOverride) {
        return (user as any).profilePicOverride;
    }
    return (user as any).currentAvatarImageUrl;
}

/**
 * @param {string} user
 * @returns {any | string}
 */
function parseUserUrl(user: string) {
    const url = new URL(user);
    const urlPath = url.pathname;
    if (urlPath.substring(5, 11) === '/user/') {
        const userId = urlPath.substring(11);
        return userId;
    }
}

/**
 * Find a user object from cachedUsers by displayName.
 *
 * @param {Map} cachedUsers
 * @param {string} displayName
 * @param {Map<string, Set<string>>} [cachedUserIdsByDisplayName]
 * @returns {object | undefined}
 */

function findUserByDisplayName(
    cachedUsers: Map<string, any>,
    displayName: string,
    cachedUserIdsByDisplayName?: Map<string, Set<string>>
) {
    const indexedUserIds = cachedUserIdsByDisplayName?.get(displayName);
    if (indexedUserIds) {
        for (const userId of indexedUserIds) {
            const ref = cachedUsers.get(userId);
            if (ref?.displayName === displayName) {
                return ref;
            }
        }
    }
    for (const ref of cachedUsers.values()) {
        if (ref.displayName === displayName) {
            return ref;
        }
    }
    return undefined;
}

export {
    userOnlineForTimestamp,
    languageClass,
    getNameColour,
    getReadableProfileThemeColor,
    invertHexColor,
    removeEmojis,
    userStatusClass,
    statusClass,
    userImage,
    userImageFull,
    parseUserUrl,
    findUserByDisplayName
};
