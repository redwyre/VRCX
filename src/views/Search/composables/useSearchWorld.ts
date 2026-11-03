import { ref } from 'vue';
import { storeToRefs } from 'pinia';

import { replaceBioSymbols } from '../../../shared/utils';
import { useAuthStore, useSearchStore, useWorldStore } from '../../../stores';
import { worldRequest } from '../../../api';
import type { SearchWorlds } from 'vrchat';

/** @returns {SearchWorlds['query']} */
function createDefaultSearchWorldParams() {
    return {
        n: 60,
        offset: 0
    };
}

/**
 * World search composable for Search view.
 * Manages world search state, category selection, and pagination.
 */
export function useSearchWorld() {
    const { cachedWorlds } = useWorldStore();
    const { searchText } = storeToRefs(useSearchStore());
    const { cachedConfig } = storeToRefs(useAuthStore());

    const searchWorldOption = ref('');
    const searchWorldLabs = ref(false);
    const searchWorldParams = ref(createDefaultSearchWorldParams());
    const searchWorldCategoryIndex = ref(null);
    const searchWorldResults = ref([]);
    const isSearchWorldLoading = ref(false);

    /**
     * @param ref
     */
    function searchWorld(
        ref: {
            index?: string | null;
            sortHeading?: string;
            sortOrder?: string;
            sortOwnership?: string;
            tag?: string;
        } = {}
    ) {
        searchWorldOption.value = '';
        searchWorldCategoryIndex.value = ref?.index ?? null;
        const params = createDefaultSearchWorldParams();
        switch (ref.sortHeading) {
            case 'featured':
                (params as any).sort = 'order';
                (params as any).featured = true;
                break;
            case 'trending':
                (params as any).sort = 'popularity';
                (params as any).featured = false;
                break;
            case 'updated':
                (params as any).sort = 'updated';
                break;
            case 'created':
                (params as any).sort = 'created';
                break;
            case 'publication':
                (params as any).sort = 'publicationDate';
                break;
            case 'shuffle':
                (params as any).sort = 'shuffle';
                break;
            case 'active':
                searchWorldOption.value = 'active';
                break;
            case 'recent':
                searchWorldOption.value = 'recent';
                break;
            case 'favorite':
                searchWorldOption.value = 'favorites';
                break;
            case 'labs':
                (params as any).sort = 'labsPublicationDate';
                break;
            case 'heat':
                (params as any).sort = 'heat';
                (params as any).featured = false;
                break;
            default:
                (params as any).sort = 'relevance';
                (params as any).search = replaceBioSymbols(searchText.value);
                break;
        }
        (params as any).order = ref.sortOrder || 'descending';
        if (ref.sortOwnership === 'mine') {
            (params as any).user = 'me';
            (params as any).releaseStatus = 'all';
        }
        if (ref.tag) {
            (params as any).tag = ref.tag;
        }
        if (!searchWorldLabs.value) {
            if ((params as any).tag) {
                (params as any).tag += ',system_approved';
            } else {
                (params as any).tag = 'system_approved';
            }
        }
        // TODO: option.platform
        searchWorldParams.value = params;
        moreSearchWorld();
    }

    /**
     * @param index
     */
    function handleSearchWorldCategorySelect(index: string | null) {
        searchWorldCategoryIndex.value = index;
        const row = cachedConfig.value?.dynamicWorldRows?.find((r: { index: any }) => r.index === index);
        searchWorld(row || {});
    }

    /**
     * @param go
     */
    function moreSearchWorld(go?: number | undefined) {
        const params = searchWorldParams.value;
        if (go) {
            params.offset += params.n * go;
            if (params.offset < 0) {
                params.offset = 0;
            }
        }
        isSearchWorldLoading.value = true;
        worldRequest
            .getWorlds(params, searchWorldOption.value)
            .finally(() => {
                isSearchWorldLoading.value = false;
            })
            .then((args) => {
                const map = new Map();
                for (const json of args.json) {
                    const ref = cachedWorlds.get(json.id);
                    if (typeof ref !== 'undefined') {
                        map.set(ref.id, ref);
                    }
                }

                searchWorldResults.value = Array.from(map.values());
                return args;
            });
    }

    function clearWorldSearch() {
        searchWorldParams.value = createDefaultSearchWorldParams();
        searchWorldResults.value = [];
    }

    return {
        searchWorldOption,
        searchWorldLabs,
        searchWorldParams,
        searchWorldCategoryIndex,
        searchWorldResults,
        isSearchWorldLoading,
        searchWorld,
        moreSearchWorld,
        handleSearchWorldCategorySelect,
        clearWorldSearch
    };
}
