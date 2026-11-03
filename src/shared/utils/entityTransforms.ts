import { replaceBioSymbols } from './base/string';
import type { FavoriteGroup } from 'vrchat';
import type { Json, VrcxFavorite } from '@/types/vrcx';

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
 * @param {Partial<Json<FavoriteGroup>>} json
 * @returns {Json<FavoriteGroup>}
 */

export function createDefaultFavoriteGroupRef(json: Partial<Json<FavoriteGroup>>) {
    return {
        id: '',
        ownerId: '',
        ownerDisplayName: '',
        name: '',
        displayName: '',
        type: '',
        visibility: '',
        tags: [],
        ...json
    } as Json<FavoriteGroup>;
}

/**
 * Build a default cached favorite ref from JSON data.
 * Computes $groupKey from type and first tag.
 *
 * @param {Partial<VrcxFavorite>} json
 * @returns {VrcxFavorite}
 */

export function createDefaultFavoriteCachedRef(json: Partial<VrcxFavorite>) {
    const ref = {
        id: '',
        type: '',
        favoriteId: '',
        tags: [],
        // VRCX
        $groupKey: '',
        //
        ...json
    } as VrcxFavorite;
    ref.$groupKey = `${ref.type}:${String(ref.tags[0])}`;
    return ref;
}
