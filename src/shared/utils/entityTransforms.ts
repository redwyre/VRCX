import { replaceBioSymbols } from './base/string';

/**
 * Sanitize arbitrary entity JSON fields via replaceBioSymbols.
 *
 * @param {object} json - Raw API response
 * @param {string[]} fields - Field names to sanitize
 * @returns {object} The mutated json
 */
export function sanitizeEntityJson(json: object, fields: string[]) {
    for (const field of fields) {
        if ((json as any)[field]) {
            (json as any)[field] = replaceBioSymbols((json as any)[field]);
        }
    }
    return json;
}

/**
 * Build a default favorite group ref from JSON data.
 *
 * @param {Partial<import('@/types/vrcx').Json<import('vrchat').FavoriteGroup>>} json
 * @returns {import('@/types/vrcx').Json<import('vrchat').FavoriteGroup>}
 */




export function createDefaultFavoriteGroupRef(json: Partial<import('@/types/vrcx').Json<import('vrchat').FavoriteGroup>>) {
    return ({
        id: '',
        ownerId: '',
        ownerDisplayName: '',
        name: '',
        displayName: '',
        type: '',
        visibility: '',
        tags: [],
        ...json
    } as import('@/types/vrcx').Json<import('vrchat').FavoriteGroup>);
}

/**
 * Build a default cached favorite ref from JSON data.
 * Computes $groupKey from type and first tag.
 *
 * @param {Partial<import('@/types/vrcx').VrcxFavorite>} json
 * @returns {import('@/types/vrcx').VrcxFavorite}
 */




export function createDefaultFavoriteCachedRef(json: Partial<import('@/types/vrcx').VrcxFavorite>) {
    const ref = ({
        id: '',
        type: '',
        favoriteId: '',
        tags: [],
        // VRCX
        $groupKey: '',
        //
        ...json
    } as import('@/types/vrcx').VrcxFavorite);
    ref.$groupKey = `${ref.type}:${String(ref.tags[0])}`;
    return ref;
}
