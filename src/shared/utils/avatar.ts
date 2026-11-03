import { replaceBioSymbols } from './base/string';
import type { UnityPackage } from 'vrchat';

/**
 * @param {object} args
 * @param {Map} cachedAvatarNames
 * @returns
 */

function storeAvatarImage(args: object, cachedAvatarNames: Map<string, any>) {
    const refCreatedAt = (args as any).json.versions[0];
    const fileCreatedAt = refCreatedAt.created_at;
    const fileId = (args as any).params.fileId;
    let avatarName = '';
    const imageName = (args as any).json.name;
    const avatarNameRegex = /Avatar - (.*) - Image -/gi.exec(imageName);
    if (avatarNameRegex) {
        avatarName = replaceBioSymbols(avatarNameRegex[1]);
    }
    const ownerId = (args as any).json.ownerId;
    const avatarInfo = {
        ownerId,
        avatarName,
        fileCreatedAt
    };
    cachedAvatarNames.set(fileId, avatarInfo);
    return avatarInfo;
}

/**
 * @param {string} avatar
 * @returns {string | null}
 */
function parseAvatarUrl(avatar: string) {
    const url = new URL(avatar);
    const urlPath = url.pathname;
    if (urlPath.substring(5, 13) === '/avatar/') {
        const avatarId = urlPath.substring(13);
        return avatarId;
    }
    return null;
}

/**
 * @param {unknown} unityPackages
 * @returns {Record<'pc' | 'android' | 'ios', Partial<UnityPackage>>}
 */
function getPlatformInfo(unityPackages: unknown): Record<'pc' | 'android' | 'ios', Partial<UnityPackage>> {
    let pc: Partial<UnityPackage> = {};
    let android: Partial<UnityPackage> = {};
    let ios: Partial<UnityPackage> = {};
    if (Array.isArray(unityPackages)) {
        for (const unityPackage of unityPackages as UnityPackage[]) {
            if (unityPackage.variant && unityPackage.variant !== 'standard' && unityPackage.variant !== 'security') {
                continue;
            }
            if (unityPackage.platform === 'standalonewindows') {
                if (unityPackage.performanceRating === 'None' && (pc as any).performanceRating) {
                    continue;
                }
                pc = unityPackage;
            } else if (unityPackage.platform === 'android') {
                if (unityPackage.performanceRating === 'None' && (android as any).performanceRating) {
                    continue;
                }
                android = unityPackage;
            } else if (unityPackage.platform === 'ios') {
                if (unityPackage.performanceRating === 'None' && (ios as any).performanceRating) {
                    continue;
                }
                ios = unityPackage;
            }
        }
    }
    return { pc, android, ios };
}

/**
 * @param {string} unitySortNumber
 * @param {string} [sdkUnityVersion]
 * @returns {boolean}
 */
function compareUnityVersion(unitySortNumber: string | number, sdkUnityVersion?: string) {
    if (!sdkUnityVersion) {
        console.error('No sdkUnityVersion provided');
        return false;
    }

    // 2022.3.6f1  2022 03 06 000
    // 2019.4.31f1 2019 04 31 000
    // 5.3.4p1     5    03 04 010
    // 2019.4.31f1c1 is a thing
    const array = sdkUnityVersion.split('.');
    if (array.length < 3) {
        console.error('Invalid sdkUnityVersion');
        return false;
    }
    let currentUnityVersion = array[0];
    currentUnityVersion += array[1].padStart(2, '0');
    const indexFirstLetter = array[2].search(/[a-zA-Z]/);
    if (indexFirstLetter > -1) {
        currentUnityVersion += array[2].substr(0, indexFirstLetter).padStart(2, '0');
        currentUnityVersion += '0';
        const letter = array[2].substr(indexFirstLetter, 1);
        if (letter === 'p') {
            currentUnityVersion += '1';
        } else {
            // f
            currentUnityVersion += '0';
        }
        currentUnityVersion += '0';
    } else {
        // just in case
        currentUnityVersion += '000';
    }
    // just in case
    currentUnityVersion = currentUnityVersion.replace(/\D/g, '');

    if (parseInt(String(unitySortNumber), 10) <= parseInt(currentUnityVersion, 10)) {
        return true;
    }
    return false;
}

export { storeAvatarImage, parseAvatarUrl, getPlatformInfo, compareUnityVersion };
