import { computed, reactive, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';

import { compareByName, createDefaultFavoriteGroupRef, replaceReactiveObject } from '../shared/utils';
import { favoriteRequest } from '../api';
import { database } from '../services/database';
import { processBulk } from '../services/request';
import { useAppearanceSettingsStore } from './settings/appearance';
import { watchState } from '../services/watchState';
import { onLoginStateChanged } from '../coordinators/favoriteCoordinator';
import { FavoriteType, UserId } from 'vrchat';

export const useFavoriteStore = defineStore('Favorite', () => {
    const appearanceSettingsStore = useAppearanceSettingsStore();

    const { t } = useI18n();

    const state = reactive({
        favoriteObjects: new Map(),
        favoriteFriends_: [],
        favoriteWorlds_: [],
        favoriteAvatars_: []
    });

    const cachedFavorites = reactive(new Map());
    const cachedFavoritesByObjectId = reactive(new Map());

    const cachedFavoriteGroups = ref({});

    const isFavoriteGroupLoading = ref(false);

    const favoriteFriendGroups = ref([]);

    const favoriteWorldGroups = ref([]);
    const favoriteAvatarGroups = ref([]);

    const favoriteLimits = ref({
        maxFavoriteGroups: {
            avatar: 6,
            friend: 3,
            vrcPlusWorld: 4,
            world: 4
        },
        maxFavoritesPerGroup: {
            avatar: 50,
            friend: 150,
            vrcPlusWorld: 100,
            world: 100
        }
    });

    const isFavoriteLoading = ref(false);

    const friendImportDialogInput = ref('');

    const worldImportDialogInput = ref('');

    const avatarImportDialogInput = ref('');

    const worldImportDialogVisible = ref(false);

    const avatarImportDialogVisible = ref(false);

    const friendImportDialogVisible = ref(false);

    const localWorldFavorites = reactive({});

    const localAvatarFavorites = reactive({});

    const localFriendFavorites = reactive({});

    const selectedFavoriteFriends = ref([]);
    const selectedFavoriteWorlds = ref([]);
    const selectedFavoriteAvatars = ref([]);

    const favoriteDialog = ref({
        visible: false,
        loading: false,
        type: '',
        objectId: '',
        currentGroup: {} as { key?: string; displayName?: string; count?: number; capacity?: number }
    });

    const favoritesSortOrder = ref([]);

    const favoriteFriends = computed(() => {
        if (appearanceSettingsStore.sortFavorites) {
            return state.favoriteFriends_.toSorted(compareByFavoriteSortOrder);
        }
        return state.favoriteFriends_.toSorted(compareByName);
    });

    const favoriteWorlds = computed(() => {
        if (appearanceSettingsStore.sortFavorites) {
            return state.favoriteWorlds_.toSorted(compareByFavoriteSortOrder);
        }
        return state.favoriteWorlds_.toSorted(compareByName);
    });

    const favoriteAvatars = computed(() => {
        if (appearanceSettingsStore.sortFavorites) {
            return state.favoriteAvatars_.toSorted(compareByFavoriteSortOrder);
        }
        return state.favoriteAvatars_.toSorted(compareByName);
    });

    watch(
        favoriteFriends,
        (list) => {
            syncFavoriteSelection(list, selectedFavoriteFriends);
        },
        { immediate: true }
    );

    watch(
        favoriteWorlds,
        (list) => {
            syncFavoriteSelection(list, selectedFavoriteWorlds);
        },
        { immediate: true }
    );

    watch(
        favoriteAvatars,
        (list) => {
            syncFavoriteSelection(list, selectedFavoriteAvatars);
        },
        { immediate: true }
    );

    const localAvatarFavoriteGroups = computed(() => Object.keys(localAvatarFavorites).sort());

    const localWorldFavoriteGroups = computed(() => Object.keys(localWorldFavorites).sort());

    const localWorldFavoritesList = computed(() =>
        Object.values(localWorldFavorites)
            .flat()
            .map((fav) => (fav as any).id)
    );

    const localAvatarFavoritesList = computed(() =>
        Object.values(localAvatarFavorites)
            .flat()
            .map((fav) => (fav as any).id)
    );

    const localFriendFavoritesList = computed(() =>
        Object.values(localFriendFavorites)
            .flat()
            .map((userId) => userId)
    );

    const groupedByGroupKeyFavoriteFriends = computed(() => {
        const groupedByGroupKeyFavoriteFriends = {};
        favoriteFriends.value.forEach((friend) => {
            if ((friend as any).groupKey) {
                if (!(groupedByGroupKeyFavoriteFriends as any)[(friend as any).groupKey]) {
                    (groupedByGroupKeyFavoriteFriends as any)[(friend as any).groupKey] = [];
                }
                (groupedByGroupKeyFavoriteFriends as any)[(friend as any).groupKey].push(friend);
            }
        });
        return groupedByGroupKeyFavoriteFriends;
    });

    const localWorldFavGroupLength = computed(() => (group: any) => {
        const favoriteGroup = (localWorldFavorites as any)[group];
        if (!favoriteGroup) {
            return 0;
        }
        return favoriteGroup.length;
    });

    const localAvatarFavGroupLength = computed(() => (group: any) => {
        const favoriteGroup = (localAvatarFavorites as any)[group];
        if (!favoriteGroup) {
            return 0;
        }
        return favoriteGroup.length;
    });

    const localFriendFavoriteGroups = computed(() => Object.keys(localFriendFavorites).sort());

    const localFriendFavGroupLength = computed(() => (group: any) => {
        const favoriteGroup = (localFriendFavorites as any)[group];
        if (!favoriteGroup) {
            return 0;
        }
        return favoriteGroup.length;
    });

    /**
     * @param {Array} list
     * @param {object} selectionRef
     * @returns {void}
     */
    function syncFavoriteSelection(list: Array<any>, selectionRef: object) {
        if (!Array.isArray(list)) {
            (selectionRef as any).value = [];
            return;
        }
        const availableIds = new Set(list.map((item) => item.id));
        const filtered = (selectionRef as any).value.filter((id: any) => availableIds.has(id));
        if (filtered.length !== (selectionRef as any).value.length) {
            (selectionRef as any).value = filtered;
        }
    }

    watch(
        () => watchState.isLoggedIn,
        (isLoggedIn) => {
            // Internal state reset
            cachedFavorites.clear();
            cachedFavoritesByObjectId.clear();
            cachedFavoriteGroups.value = {};
            favoriteFriendGroups.value = [];
            favoriteWorldGroups.value = [];
            favoriteAvatarGroups.value = [];
            isFavoriteLoading.value = false;
            isFavoriteGroupLoading.value = false;
            state.favoriteObjects.clear();
            state.favoriteFriends_ = [];
            state.favoriteWorlds_ = [];
            state.favoriteAvatars_ = [];
            replaceReactiveObject(localWorldFavorites, {});
            replaceReactiveObject(localAvatarFavorites, {});
            selectedFavoriteFriends.value = [];
            selectedFavoriteWorlds.value = [];
            selectedFavoriteAvatars.value = [];
            favoriteDialog.value.visible = false;
            worldImportDialogVisible.value = false;
            avatarImportDialogVisible.value = false;
            friendImportDialogVisible.value = false;
            // Cross-store operations delegated to coordinator
            onLoginStateChanged(isLoggedIn);
        },
        { flush: 'sync' }
    );

    /**
     * @returns {Record<string, any>}
     */
    function getCachedFavoriteGroupsByTypeName() {
        const groups = {};
        for (const group of favoriteFriendGroups.value) {
            (groups as any)[(group as any).key] = group;
        }
        for (const group of favoriteWorldGroups.value) {
            (groups as any)[(group as any).key] = group;
        }
        for (const group of favoriteAvatarGroups.value) {
            (groups as any)[(group as any).key] = group;
        }
        return groups;
    }

    /**
     * @param {string} objectId
     * @returns {object | undefined}
     */
    function getCachedFavoritesByObjectId(objectId: string) {
        return cachedFavoritesByObjectId.get(objectId);
    }

    /**
     * @param {object} args
     * @returns {void}
     */
    function handleFavoriteGroup(args: object) {
        (args as any).ref = applyFavoriteGroup((args as any).json);
    }

    /**
     * @returns {void}
     */
    function refreshFavoriteGroups() {
        if (isFavoriteGroupLoading.value) {
            return;
        }
        isFavoriteGroupLoading.value = true;
        processBulk({
            fn: (
                params:
                    | { n?: number; offset?: number; type?: FavoriteType; userId?: UserId; ownerId?: string }
                    | undefined
            ) => favoriteRequest.getFavoriteGroups(params),
            N: -1,
            params: {
                n: 50,
                offset: 0
            },
            handle: (args: { json: any }) => {
                for (const json of args.json) {
                    handleFavoriteGroup({
                        json,
                        params: {
                            favoriteGroupId: json.id
                        }
                    });
                }
            },
            done(ok: any) {
                if (ok) {
                    buildFavoriteGroups();
                }
                isFavoriteGroupLoading.value = false;
            }
        });
    }

    function buildFavoriteGroups() {
        let group;
        let groups;
        let i;
        // 450 = ['group_0', 'group_1', 'group_2'] x 150
        favoriteFriendGroups.value = [];
        for (i = 0; i < favoriteLimits.value.maxFavoriteGroups.friend; ++i) {
            favoriteFriendGroups.value.push({
                assign: false,
                key: `friend:group_${i}`,
                type: 'friend',
                name: `group_${i}`,
                displayName: `Group ${i + 1}`,
                capacity: favoriteLimits.value.maxFavoritesPerGroup.friend,
                count: 0,
                visibility: 'private'
            });
        }
        // 400 = ['worlds1', 'worlds2', 'worlds3', 'worlds4'] x 100
        favoriteWorldGroups.value = [];
        for (i = 0; i < favoriteLimits.value.maxFavoriteGroups.world; ++i) {
            favoriteWorldGroups.value.push({
                assign: false,
                key: `world:worlds${i + 1}`,
                type: 'world',
                name: `worlds${i + 1}`,
                displayName: `Group ${i + 1}`,
                capacity: favoriteLimits.value.maxFavoritesPerGroup.world,
                count: 0,
                visibility: 'private'
            });
        }
        // 400 = ['vrcPlusWorlds1', 'vrcPlusWorlds2', 'vrcPlusWorlds3', 'vrcPlusWorlds4'] x 100
        for (i = 0; i < favoriteLimits.value.maxFavoriteGroups.vrcPlusWorld; ++i) {
            favoriteWorldGroups.value.push({
                assign: false,
                key: `vrcPlusWorld:vrcPlusWorlds${i + 1}`,
                type: 'vrcPlusWorld',
                name: `vrcPlusWorlds${i + 1}`,
                displayName: `VRC+ Group ${i + 1}`,
                capacity: favoriteLimits.value.maxFavoritesPerGroup.vrcPlusWorld,
                count: 0,
                visibility: 'private'
            });
        }
        // 350 = ['avatars1', ...] x 50
        // Favorite Avatars (0/50)
        // VRC+ Group 1..5 (0/50)
        favoriteAvatarGroups.value = [];
        for (i = 0; i < favoriteLimits.value.maxFavoriteGroups.avatar; ++i) {
            favoriteAvatarGroups.value.push({
                assign: false,
                key: `avatar:avatars${i + 1}`,
                type: 'avatar',
                name: `avatars${i + 1}`,
                displayName: `Group ${i + 1}`,
                capacity: favoriteLimits.value.maxFavoritesPerGroup.avatar,
                count: 0,
                visibility: 'private'
            });
        }
        const types = {
            friend: favoriteFriendGroups.value,
            world: favoriteWorldGroups.value,
            vrcPlusWorld: favoriteWorldGroups.value,
            avatar: favoriteAvatarGroups.value
        };
        const assigns = new Set();
        // assign the same name first
        for (const key in cachedFavoriteGroups.value) {
            const ref = (cachedFavoriteGroups.value as any)[key];
            groups = (types as any)[ref.type];
            if (typeof groups === 'undefined') {
                continue;
            }
            for (group of groups) {
                if (group.assign === false && group.name === ref.name) {
                    group.assign = true;
                    if (ref.displayName) {
                        group.displayName = ref.displayName;
                    }
                    group.visibility = ref.visibility;
                    assigns.add(ref.id);
                    break;
                }
            }
        }

        for (const key in cachedFavoriteGroups.value) {
            const ref = (cachedFavoriteGroups.value as any)[key];
            if (assigns.has(ref.id)) {
                continue;
            }
            groups = (types as any)[ref.type];
            if (typeof groups === 'undefined') {
                continue;
            }
            for (group of groups) {
                if (group.assign === false) {
                    group.assign = true;
                    group.key = `${group.type}:${ref.name}`;
                    group.name = ref.name;
                    group.displayName = ref.displayName;
                    assigns.add(ref.id);
                    break;
                }
            }
        }
        countFavoriteGroups();
    }

    function countFavoriteGroups() {
        const cachedFavoriteGroups = getCachedFavoriteGroupsByTypeName();
        for (const key in cachedFavoriteGroups) {
            (cachedFavoriteGroups as any)[key].count = 0;
        }
        for (let ref of cachedFavorites.values()) {
            let group = (cachedFavoriteGroups as any)[ref.$groupKey];
            if (typeof group === 'undefined') {
                continue;
            }
            ++group.count;
        }
    }

    /**
     * @param {object} json
     * @returns {object}
     */
    function applyFavoriteGroup(json: object) {
        let ref = (cachedFavoriteGroups.value as any)[(json as any).id];
        if (typeof ref === 'undefined') {
            ref = createDefaultFavoriteGroupRef(json);
            (cachedFavoriteGroups.value as any)[ref.id] = ref;
        } else {
            Object.assign(ref, json);
        }
        return ref;
    }

    /**
     * @returns {void}
     */
    function showWorldImportDialog() {
        worldImportDialogVisible.value = true;
    }

    /**
     * @returns {void}
     */
    function showAvatarImportDialog() {
        avatarImportDialogVisible.value = true;
    }

    /**
     * @returns {void}
     */
    function showFriendImportDialog() {
        friendImportDialogVisible.value = true;
    }

    /**
     * @param {string} value
     */
    function setAvatarImportDialogInput(value: string) {
        avatarImportDialogInput.value = value;
    }

    /**
     * @param {string} value
     */
    function setWorldImportDialogInput(value: string) {
        worldImportDialogInput.value = value;
    }

    /**
     * @param {string} value
     */
    function setFriendImportDialogInput(value: string) {
        friendImportDialogInput.value = value;
    }

    /**
     * @param avatarRef
     */
    function syncLocalAvatarFavoriteRef(avatarRef: { id: any }) {
        if (!avatarRef?.id) {
            return;
        }
        for (let i = 0; i < localAvatarFavoriteGroups.value.length; ++i) {
            const groupName = localAvatarFavoriteGroups.value[i];
            const group = (localAvatarFavorites as any)[groupName];
            if (!group) {
                continue;
            }
            for (let j = 0; j < group.length; ++j) {
                if (group[j]?.id === avatarRef.id) {
                    group[j] = avatarRef;
                }
            }
        }
    }

    /**
     * @param {string} worldId
     * @param {string} group
     * @returns {boolean}
     */
    function hasLocalWorldFavorite(worldId: string, group: string) {
        const favoriteGroup = (localWorldFavorites as any)[group];
        if (!favoriteGroup) {
            return false;
        }
        for (let i = 0; i < favoriteGroup.length; ++i) {
            if (favoriteGroup[i].id === worldId) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param {string} avatarId
     * @param {string} group
     * @returns {boolean}
     */
    function hasLocalAvatarFavorite(avatarId: string, group: string) {
        const favoriteGroup = (localAvatarFavorites as any)[group];
        if (!favoriteGroup) {
            return false;
        }
        for (let i = 0; i < favoriteGroup.length; ++i) {
            if (favoriteGroup[i].id === avatarId) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param {string} objectId
     */
    function updateFavoriteDialog(objectId: string) {
        const D = favoriteDialog.value;
        if (!D.visible || D.objectId !== objectId) {
            return;
        }
        D.currentGroup = {};
        const favorite = state.favoriteObjects.get(objectId);
        if (favorite) {
            let group;
            for (group of favoriteWorldGroups.value) {
                if (favorite.groupKey === (group as any).key) {
                    D.currentGroup = group;
                    return;
                }
            }
            for (group of favoriteAvatarGroups.value) {
                if (favorite.groupKey === (group as any).key) {
                    D.currentGroup = group;
                    return;
                }
            }
            for (group of favoriteFriendGroups.value) {
                if (favorite.groupKey === (group as any).key) {
                    D.currentGroup = group;
                    return;
                }
            }
        }
    }

    /**
     * @param {string} group
     */
    function deleteLocalWorldFavoriteGroup(group: string) {
        let i;
        // remove from cache if no longer in favorites
        const worldIdRemoveList = new Set();
        const favoriteGroup = (localWorldFavorites as any)[group];
        for (i = 0; i < favoriteGroup.length; ++i) {
            worldIdRemoveList.add(favoriteGroup[i].id);
        }

        delete (localWorldFavorites as any)[group];
        database.deleteWorldFavoriteGroup(group);

        for (i = 0; i < localWorldFavoriteGroups.value.length; ++i) {
            const groupName = localWorldFavoriteGroups.value[i];
            if (!(localWorldFavorites as any)[groupName]) {
                continue;
            }
            for (let j = 0; j < (localWorldFavorites as any)[groupName].length; ++j) {
                const worldId = (localWorldFavorites as any)[groupName][j].id;
                if (worldIdRemoveList.has(worldId)) {
                    worldIdRemoveList.delete(worldId);
                    break;
                }
            }
        }

        worldIdRemoveList.forEach((id) => {
            database.removeWorldFromCache(id);
        });
    }

    /**
     * @param {string} userId
     * @param {string} group
     * @returns {boolean}
     */
    function hasLocalFriendFavorite(userId: string, group: string) {
        const favoriteGroup = (localFriendFavorites as any)[group];
        if (!favoriteGroup) {
            return false;
        }
        return favoriteGroup.includes(userId);
    }

    /**
     * Check if a user is in any local friend favorite group.
     *
     * @param {string} userId
     * @returns {boolean}
     */
    function isInAnyLocalFriendGroup(userId: string) {
        for (const group in localFriendFavorites) {
            if ((localFriendFavorites as any)[group]?.includes(userId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param {string} group
     */
    function newLocalFriendFavoriteGroup(group: string) {
        if (localFriendFavoriteGroups.value.includes(group)) {
            toast.error(
                t('prompt.new_local_favorite_group.message.error', {
                    name: group
                })
            );
            return;
        }
        if (!(localFriendFavorites as any)[group]) {
            (localFriendFavorites as any)[group] = [];
        }
    }

    /**
     * @param objectId
     */
    function deleteFavoriteNoConfirm(objectId: any) {
        if (!objectId) {
            return;
        }
        favoriteDialog.value.visible = true;
        favoriteRequest
            .deleteFavorite({
                objectId
            })
            .then(() => {
                favoriteDialog.value.visible = false;
            })
            .finally(() => {
                favoriteDialog.value.loading = false;
            });
    }

    /**
     * @param type
     * @param objectId
     */
    function showFavoriteDialog(type: string, objectId: string) {
        const D = favoriteDialog.value;
        D.type = type;
        D.objectId = objectId;
        D.visible = true;
        updateFavoriteDialog(objectId);
    }

    /**
     * @param a
     * @param b
     */
    function compareByFavoriteSortOrder(a: { id: any }, b: { id: any }) {
        const indexA = favoritesSortOrder.value.indexOf(a.id);

        const indexB = favoritesSortOrder.value.indexOf(b.id);
        return indexA - indexB;
    }

    /**
     * @param {boolean} value
     */
    function setIsFavoriteLoading(value: boolean) {
        isFavoriteLoading.value = value;
    }

    /**
     * @param {object} value
     */
    function setFavoriteLimits(value: typeof favoriteLimits.value) {
        favoriteLimits.value = value;
    }

    /**
     * @param {Array} value
     */
    function setFavoritesSortOrder(value: Array<any>) {
        favoritesSortOrder.value = value;
    }

    return {
        state,

        favoriteFriends,
        favoriteWorlds,
        favoriteAvatars,
        isFavoriteGroupLoading,
        favoriteFriendGroups,
        cachedFavoriteGroups,
        favoriteLimits,
        cachedFavorites,
        cachedFavoritesByObjectId,
        favoriteWorldGroups,
        favoriteAvatarGroups,
        isFavoriteLoading,
        friendImportDialogInput,
        worldImportDialogInput,
        avatarImportDialogInput,
        worldImportDialogVisible,
        avatarImportDialogVisible,
        friendImportDialogVisible,
        localWorldFavorites,
        localAvatarFavorites,
        localAvatarFavoritesList,
        localAvatarFavoriteGroups,
        favoriteDialog,
        localWorldFavoritesList,
        localFriendFavoritesList,

        localWorldFavoriteGroups,
        localFriendFavorites,
        localFriendFavoriteGroups,

        localFriendFavGroupLength,
        groupedByGroupKeyFavoriteFriends,
        selectedFavoriteFriends,
        selectedFavoriteWorlds,
        selectedFavoriteAvatars,
        localWorldFavGroupLength,
        localAvatarFavGroupLength,
        favoritesSortOrder,

        refreshFavoriteGroups,
        applyFavoriteGroup,
        showWorldImportDialog,
        showAvatarImportDialog,
        showFriendImportDialog,
        setAvatarImportDialogInput,
        setWorldImportDialogInput,
        setFriendImportDialogInput,
        syncLocalAvatarFavoriteRef,
        hasLocalWorldFavorite,
        hasLocalAvatarFavorite,
        updateFavoriteDialog,
        deleteLocalWorldFavoriteGroup,
        deleteFavoriteNoConfirm,
        showFavoriteDialog,
        getCachedFavoritesByObjectId,
        getCachedFavoriteGroupsByTypeName,
        handleFavoriteGroup,
        hasLocalFriendFavorite,
        isInAnyLocalFriendGroup,
        newLocalFriendFavoriteGroup,
        countFavoriteGroups,
        setIsFavoriteLoading,
        setFavoriteLimits,
        setFavoritesSortOrder
    };
});
