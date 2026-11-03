import type { VrcxWorld } from '@/types/vrcx';

/**
 * Create a default world ref object.
 *
 * @param {Partial<VrcxWorld>} json - API response to merge
 * @returns {VrcxWorld}
 */

export function createDefaultWorldRef(json: Partial<VrcxWorld>) {
    return {
        id: '',
        name: '',
        description: '',
        defaultContentSettings: {},
        disabledPropAbilities: [],
        authorId: '',
        authorName: '',
        capacity: 0,
        recommendedCapacity: 0,
        tags: [],
        releaseStatus: '',
        imageUrl: '',
        thumbnailImageUrl: '',
        assetUrl: '',
        assetUrlObject: {},
        pluginUrl: '',
        pluginUrlObject: {},
        unityPackageUrl: '',
        unityPackageUrlObject: {},
        unityPackages: [],
        version: 0,
        favorites: 0,
        created_at: '',
        updated_at: '',
        publicationDate: '',
        labsPublicationDate: '',
        visits: 0,
        popularity: 0,
        heat: 0,
        publicOccupants: 0,
        privateOccupants: 0,
        occupants: 0,
        instances: [],
        featured: false,
        organization: '',
        previewYoutubeId: '',
        isHypeTrainEligible: false,
        namespace: '',
        slimInstances: [],
        storeId: '',
        udonProducts: [],
        urlList: [],
        // VRCX
        $isLabs: false,
        //
        ...json
    } as VrcxWorld;
}
