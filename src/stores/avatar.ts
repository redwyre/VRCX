import { ref, watch } from 'vue';
import { defineStore } from 'pinia';

import { checkVRChatCache, formatFileSize } from '../shared/utils';
import { queryRequest } from '../api';
import type { VrcxAvatar, VrcxFileAnalysis } from '../types/vrcx';
import type { UnityPackage } from 'vrchat';
import { getAvatarHistory, preloadOwnAvatars } from '../coordinators/avatarCoordinator';
import { database } from '../services/database';
import { watchState } from '../services/watchState';

export const useAvatarStore = defineStore('Avatar', () => {
    let cachedAvatarModerations = new Map();
    let cachedAvatars = new Map();
    let cachedAvatarNames = new Map();

    const avatarDialog = ref({
        visible: false,
        loading: false,
        activeTab: 'Info',
        lastActiveTab: 'Info',
        id: '',
        memo: '',
        ref: {} as VrcxAvatar,
        isFavorite: false,
        isBlocked: false,
        isQuestFallback: false,
        hasImposter: false,
        imposterVersion: '',
        isPC: false,
        isQuest: false,
        isIos: false,
        platformInfo: {} as Record<'pc' | 'android' | 'ios', Partial<UnityPackage>>,
        galleryImages: [],
        galleryLoading: false,
        inCache: false,
        cacheSize: '',
        cacheLocked: false,
        cachePath: '',
        fileAnalysis: {} as VrcxFileAnalysis,
        timeSpent: 0
    });
    const avatarHistory = ref([]);
    const loadingToastId = ref(null);

    watch(
        () => watchState.isLoggedIn,
        (isLoggedIn) => {
            avatarDialog.value.visible = false;
            cachedAvatars.clear();
            cachedAvatarNames.clear();
            cachedAvatarModerations.clear();
            avatarHistory.value = [];
            if (isLoggedIn) {
                getAvatarHistory();
                preloadOwnAvatars();
            }
        },
        { flush: 'sync' }
    );

    /**
     * @param {boolean} value
     */
    function setAvatarDialogLoading(value: boolean) {
        avatarDialog.value.loading = value;
    }

    /**
     * @param {boolean} value
     */
    function setAvatarDialogVisible(value: boolean) {
        avatarDialog.value.visible = value;
    }

    /**
     * @param {boolean} value
     */
    function setAvatarDialogIsFavorite(value: boolean) {
        avatarDialog.value.isFavorite = value;
    }

    /**
     * @param {string} avatarId
     * @returns {Promise<{ id: string; url: string }[]>}
     */
    async function getAvatarGallery(avatarId: string) {
        const D = avatarDialog.value;
        const args = await queryRequest.fetch('avatarGallery.force', { avatarId }).finally(() => {
            D.galleryLoading = false;
        });
        if ((args as any).params.galleryId !== D.id) {
            return;
        }
        D.galleryImages = [];
        // wtf is this? why is order sorting only needed if it's your own avatar?
        const sortedGallery = (args as any).json.sort(
            (
                a: {
                    order: number;
                },
                b: {
                    order: number;
                }
            ) => {
                if (!a.order && !b.order) {
                    return 0;
                }
                return a.order - b.order;
            }
        );
        for (const file of sortedGallery) {
            const url = file.versions[file.versions.length - 1].file.url;

            D.galleryImages.push({ id: file.id, url });
        }

        // for JSON tab treeData
        (D.ref as any).gallery = (args as any).json;
        return D.galleryImages;
    }

    /**
     * @param {object} json
     * @returns {object} Ref
     */
    function applyAvatarModeration(json: object) {
        // fix inconsistent Unix time response
        if (typeof (json as any).created === 'number') {
            (json as any).created = new Date((json as any).created).toJSON();
        }

        let ref = cachedAvatarModerations.get((json as any).targetAvatarId);
        if (typeof ref === 'undefined') {
            ref = {
                avatarModerationType: '',
                created: '',
                targetAvatarId: '',
                ...json
            };
            cachedAvatarModerations.set(ref.targetAvatarId, ref);
        } else {
            Object.assign(ref, json);
        }

        // update avatar dialog
        const D = avatarDialog.value;
        if (D.visible && ref.avatarModerationType === 'block' && D.id === ref.targetAvatarId) {
            D.isBlocked = true;
        }

        return ref;
    }

    function resetCachedAvatarModerations() {
        cachedAvatarModerations.clear();
    }

    function updateVRChatAvatarCache() {
        const D = avatarDialog.value;
        if (D.visible) {
            D.inCache = false;
            D.cacheSize = '';
            D.cacheLocked = false;
            D.cachePath = '';
            checkVRChatCache(D.ref).then((cacheInfo) => {
                if (cacheInfo.Item1 > 0) {
                    D.inCache = true;
                    D.cacheSize = formatFileSize(cacheInfo.Item1);
                    D.cachePath = cacheInfo.Item3;
                }
                D.cacheLocked = cacheInfo.Item2;
            });
        }
    }

    function clearAvatarHistory() {
        avatarHistory.value = [];
        database.clearAvatarHistory();
    }

    /**
     * @param {Array} value
     */
    function setAvatarHistory(value: Array<any>) {
        avatarHistory.value = value;
    }

    /**
     * @param {any} value
     */
    function setLoadingToastId(value: any) {
        loadingToastId.value = value;
    }

    return {
        avatarDialog,
        avatarHistory,
        loadingToastId,
        cachedAvatarModerations,
        cachedAvatars,
        cachedAvatarNames,

        applyAvatarModeration,
        resetCachedAvatarModerations,
        getAvatarGallery,
        updateVRChatAvatarCache,
        clearAvatarHistory,
        setAvatarHistory,
        setLoadingToastId,
        setAvatarDialogVisible,
        setAvatarDialogIsFavorite,
        setAvatarDialogLoading
    };
});
