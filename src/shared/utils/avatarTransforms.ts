import type { Avatar } from 'vrchat';
import type { Json } from '@/types/vrcx';

/**
 * Create a default avatar ref object.
 *
 * @param {Partial<Json<Avatar>>} json - API response to merge
 * @returns {Json<Avatar>}
 */

export function createDefaultAvatarRef(json: Partial<Json<Avatar>>) {
    return {
        acknowledgements: '',
        activeAssetReviewId: '',
        assetUrl: '',
        assetUrlObject: {},
        attribution: null,
        authorId: '',
        authorName: '',
        created_at: '',
        description: '',
        featured: false,
        highestPrice: null,
        id: '',
        imageUrl: '',
        listingDate: null,
        lock: false,
        lowestPrice: null,
        name: '',
        pendingUpload: false,
        performance: {},
        productId: null,
        publishedListings: [],
        releaseStatus: '',
        searchable: false,
        styles: [],
        tags: [],
        thumbnailImageUrl: '',
        unityPackageUrl: '',
        unityPackageUrlObject: {},
        unityPackages: [],
        updated_at: '',
        version: 0,
        ...json
    } as Json<Avatar>;
}
