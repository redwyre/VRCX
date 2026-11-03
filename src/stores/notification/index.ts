import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';

import dayjs from 'dayjs';

import {
    applyBoopLegacyHandling,
    checkCanInvite,
    createDefaultNotificationRef,
    createDefaultNotificationV2Ref,
    executeWithBackoff,
    findUserByDisplayName,
    parseLocation,
    parseNotificationDetails,
    removeFromArray,
    replaceBioSymbols,
    sanitizeNotificationJson
} from '../../shared/utils';
import { getUserMemo } from '../../coordinators/memoCoordinator';
import {
    friendRequest,
    instanceRequest,
    inventoryRequest,
    marketplaceRequest,
    notificationRequest,
    queryRequest
} from '../../api';
import { VRCHAT_STORE_IDS } from '../../shared/constants';
import {
    getNotificationMessage,
    getUserIdFromNoty as getUserIdFromNotyBase,
    toNotificationText
} from '../../shared/utils/notificationMessage';
import { database, dbVars } from '../../services/database';
import { getNotificationCategory, getNotificationTs } from '../../shared/utils/notificationCategory';
import { AppDebug } from '../../services/appConfig';
import { createOverlayDispatch } from './overlayDispatch';
import { useAdvancedSettingsStore } from '../settings/advanced';
import { useFavoriteStore } from '../favorite';
import { useFriendStore } from '../friend';
import { handleFriendAdd } from '../../coordinators/friendRelationshipCoordinator';
import { useGameStore } from '../game';
import { useGeneralSettingsStore } from '../settings/general';

import { showGroupDialog } from '../../coordinators/groupCoordinator';
import { showUserDialog } from '../../coordinators/userCoordinator';
import { useInstanceStore } from '../instance';
import { useLocationStore } from '../location';
import { useModalStore } from '../modal';
import { useNotificationsSettingsStore } from '../settings/notifications';
import { useSharedFeedStore } from '../sharedFeed';
import { useUiStore } from '../ui';
import { useUserStore } from '../user';
import { useWristOverlaySettingsStore } from '../settings/wristOverlay';
import { watchState } from '../../services/watchState';

import configRepository from '../../services/config';
import type { TableFilter } from '@/types/vrcx';

export const useNotificationStore = defineStore('Notification', () => {
    const { t } = useI18n();
    const generalSettingsStore = useGeneralSettingsStore();
    const locationStore = useLocationStore();
    const favoriteStore = useFavoriteStore();
    const friendStore = useFriendStore();
    const notificationsSettingsStore = useNotificationsSettingsStore();
    const advancedSettingsStore = useAdvancedSettingsStore();
    const userStore = useUserStore();
    const wristOverlaySettingsStore = useWristOverlaySettingsStore();
    const uiStore = useUiStore();
    const gameStore = useGameStore();
    const sharedFeedStore = useSharedFeedStore();
    const instanceStore = useInstanceStore();
    const modalStore = useModalStore();

    const notificationInitStatus = ref(false);
    const notificationTable = ref({
        data: [],
        filters: [
            {
                prop: 'type',
                value: []
            },
            {
                prop: ['senderUsername', 'message'],
                value: ''
            }
        ] as TableFilter[],
        pageSize: 20,
        pageSizeLinked: true,
        paginationProps: {
            layout: 'sizes,prev,pager,next,total'
        }
    });
    const unseenNotifications = ref([]);
    const isNotificationsLoading = ref(false);
    const isNotificationCenterOpen = ref(false);
    const inventoryBundleDialog = ref({
        visible: false,
        bundles: []
    });
    const shownBundleIds = new Set();
    // Thanks for this buggy unredeemable bundle...
    const ignoredBundleTemplateIds = new Set([
        'invt_08e50f24-8807-4ec2-a0f9-9e008371280b' // October Open Beta Content Drop
    ]);
    const freeStoreItemDialog = ref({
        visible: false,
        listings: []
    });
    const shownFreeListingIds = new Set();

    const friendNotifications = computed(() =>
        notificationTable.value.data.filter((n) => getNotificationCategory((n as any).type) === 'friend')
    );
    const groupNotifications = computed(() =>
        notificationTable.value.data.filter((n) => getNotificationCategory((n as any).type) === 'group')
    );
    const otherNotifications = computed(() =>
        notificationTable.value.data.filter((n) => getNotificationCategory((n as any).type) === 'other')
    );
    const unseenSet = computed(() => new Set(unseenNotifications.value));

    const unseenFriendNotifications = computed(() =>
        friendNotifications.value.filter((n) => unseenSet.value.has((n as any).id))
    );

    const unseenGroupNotifications = computed(() =>
        groupNotifications.value.filter((n) => unseenSet.value.has((n as any).id))
    );

    const unseenOtherNotifications = computed(() =>
        otherNotifications.value.filter((n) => unseenSet.value.has((n as any).id))
    );
    const recentCutoff = computed(() => dayjs().subtract(24, 'hour').valueOf());

    const recentFriendNotifications = computed(() =>
        friendNotifications.value.filter(
            (n) =>
                !unseenSet.value.has((n as any).id) &&
                (n as any).seen !== false &&
                getNotificationTs(n) > recentCutoff.value
        )
    );

    const recentGroupNotifications = computed(() =>
        groupNotifications.value.filter(
            (n) =>
                !unseenSet.value.has((n as any).id) &&
                (n as any).seen !== false &&
                getNotificationTs(n) > recentCutoff.value
        )
    );

    const recentOtherNotifications = computed(() =>
        otherNotifications.value.filter(
            (n) =>
                !unseenSet.value.has((n as any).id) &&
                (n as any).seen !== false &&
                getNotificationTs(n) > recentCutoff.value
        )
    );
    const hasUnseenNotifications = computed(() => unseenNotifications.value.length > 0);

    const notyMap = {};

    watch(
        () => watchState.isLoggedIn,
        (isLoggedIn) => {
            isNotificationsLoading.value = false;
            notificationTable.value.data = [];
            inventoryBundleDialog.value.visible = false;
            freeStoreItemDialog.value.visible = false;
            if (isLoggedIn) {
                initNotifications();
            }
        },
        { flush: 'sync' }
    );

    watch(
        () => notificationsSettingsStore.inventoryBundleNotifications,
        (enabled) => {
            if (!enabled) {
                inventoryBundleDialog.value.visible = false;
            } else if (watchState.isLoggedIn) {
                checkInventoryBundles();
            }
        }
    );

    watch(
        () => notificationsSettingsStore.freeStoreItemNotifications,
        (enabled) => {
            if (!enabled) {
                freeStoreItemDialog.value.visible = false;
            } else if (watchState.isLoggedIn) {
                checkFreeStoreItems();
            }
        }
    );

    async function init() {
        notificationTable.value.filters[0].value = JSON.parse(
            await configRepository.getString('VRCX_notificationTableFilters', '[]')
        );
    }

    init();

    /**
     * @param args
     */
    function handleNotification(args: any) {
        args.ref = applyNotification(args.json);
        const { ref } = args;
        const array = notificationTable.value.data;
        const { length } = array;
        if (ref.seen) {
            removeFromArray(unseenNotifications.value, ref.id);
        } else if (!unseenNotifications.value.includes(ref.id)) {
            unseenNotifications.value.push(ref.id);
        }
        for (let i = 0; i < length; ++i) {
            if ((array[i] as any).id === ref.id) {
                array[i] = ref;
                return;
            }
        }
        if (ref.senderUserId !== userStore.currentUser.id) {
            const isExcludedType =
                ref.type === 'friendRequest' || ref.type === 'ignoredFriendRequest' || ref.type.includes('.');
            const isNotificationInitReady = !notificationInitStatus.value || !isNotificationsLoading.value;
            const matchesNotificationTypeFilter =
                notificationTable.value.filters[0].value.length === 0 ||
                notificationTable.value.filters[0].value.includes(ref.type);

            if (!isExcludedType) {
                database.addNotificationToDatabase(ref);
            }
            if (isNotificationInitReady) {
                if (ref.details?.worldId && !instanceStore.cachedInstances.has(ref.details.worldId)) {
                    // get instance name for invite
                    const L = parseLocation(ref.details.worldId);
                    if (L.isRealInstance) {
                        instanceRequest.getInstance({
                            worldId: L.worldId,
                            instanceId: L.instanceId
                        });
                    }
                }
                queueNotificationNoty(ref);
                sharedFeedStore.addEntry(ref);
            }
            if (matchesNotificationTypeFilter && !isExcludedType) {
                uiStore.notifyMenu('notification');
            }
        }

        notificationTable.value.data.push(ref);
        const D = userStore.userDialog;
        if (D.visible === false || ref.type !== 'friendRequest' || ref.senderUserId !== D.id) {
            return;
        }
        D.incomingRequest = true;
    }

    /**
     * @param notificationId
     */
    function handleNotificationHide(notificationId: any) {
        const ref = notificationTable.value.data.find((n) => (n as any).id === notificationId);
        if (typeof ref === 'undefined') {
            return;
        }
        if (
            (ref as any).type === 'friendRequest' ||
            (ref as any).type === 'ignoredFriendRequest' ||
            (ref as any).type.includes('.')
        ) {
            removeFromArray(notificationTable.value.data, ref);
        } else {
            (ref as any).$isExpired = true;
            database.updateNotificationExpired(ref);
        }
        handleNotificationExpire({
            ref,
            params: {
                notificationId: (ref as any).id
            }
        });
    }

    /**
     * @param args
     */
    function handlePipelineNotification(args: any) {
        const ref = args.json;
        if (ref.type === 'friendRequest' && generalSettingsStore.autoDeclineFriendRequests) {
            handleAutoDeclineFriendRequest(ref);
        }
        if (ref.type !== 'requestInvite' || generalSettingsStore.autoAcceptInviteRequests === 'Off') {
            return;
        }
        const allowedStatuses = generalSettingsStore.autoAcceptInviteStatuses;

        if (allowedStatuses.length && !allowedStatuses.includes(userStore.currentUser.status)) {
            return;
        }

        let currentLocation = locationStore.lastLocation.location;
        if (locationStore.lastLocation.location === 'traveling') {
            currentLocation = locationStore.lastLocationDestination;
        }
        if (!currentLocation) {
            // game log disabled, use API location
            currentLocation = userStore.currentUser.$locationTag;
            if (userStore.currentUser.$travelingToLocation) {
                currentLocation = userStore.currentUser.$travelingToLocation;
            }
        }
        if (!currentLocation) {
            return;
        }
        if (
            generalSettingsStore.autoAcceptInviteRequests === 'All Favorites' &&
            !favoriteStore.state.favoriteFriends_.some((x) => (x as any).id === ref.senderUserId) &&
            !favoriteStore.isInAnyLocalFriendGroup(ref.senderUserId)
        ) {
            return;
        }
        if (generalSettingsStore.autoAcceptInviteRequests === 'Selected Favorites') {
            const groups = generalSettingsStore.autoAcceptInviteGroups;
            if (groups.length === 0) {
                return;
            } else {
                let found = false;
                for (const groupKey of groups) {
                    if ((groupKey as any).startsWith('local:')) {
                        const localGroup = (groupKey as any).slice(6);
                        const localFavs = (favoriteStore.localFriendFavorites as any)[localGroup];
                        if (localFavs && localFavs.includes(ref.senderUserId)) {
                            found = true;
                            break;
                        }
                    } else {
                        if (favoriteStore.cachedFavoritesByObjectId.get(ref.senderUserId)?.$groupKey === groupKey) {
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) {
                    return;
                }
            }
        }
        if (
            !checkCanInvite(currentLocation, {
                currentUserId: userStore.currentUser.id,
                lastLocationStr: locationStore.lastLocation.location,
                cachedInstances: instanceStore.cachedInstances
            })
        ) {
            return;
        }

        const L = parseLocation(currentLocation);
        queryRequest
            .fetch('world', {
                worldId: L.worldId
            })
            .then((args1) => {
                notificationRequest
                    .sendInvite(
                        {
                            instanceId: L.tag,
                            worldId: L.tag,
                            worldName: (args1 as any).ref.name,
                            rsvp: true
                        },
                        ref.senderUserId
                    )
                    .then((_args) => {
                        const text = `Auto invite sent to ${ref.senderUsername}`;
                        if (AppDebug.errorNoty) {
                            toast.dismiss(AppDebug.errorNoty);
                        }

                        AppDebug.errorNoty = toast.info(text);
                        console.log(text);
                        notificationRequest
                            .hideNotification({
                                notificationId: ref.id
                            })
                            .then(() => {
                                handleNotificationHide(ref.id);
                            });
                        return _args;
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            });
    }

    async function handleAutoDeclineFriendRequest(ref: any) {
        const joinInfo = await database.getJoinCount({
            id: ref.senderUserId,
            displayName: ref.senderUsername
        });
        if (Number(joinInfo.joinCount) !== 0) {
            return;
        }

        const text = `Auto declined friend request from ${ref.senderUsername}`;
        if (AppDebug.errorNoty) {
            toast.dismiss(AppDebug.errorNoty);
        }

        AppDebug.errorNoty = toast.info(text);
        console.log(text);
        await notificationRequest.hideNotification({
            notificationId: ref.id
        });
        handleNotificationHide(ref.id);
    }

    /**
     * @param {object} entry
     */
    function appendNotificationTableEntry(entry: object) {
        notificationTable.value.data.push(entry);
    }

    /**
     * @param {boolean} value
     */
    function setNotificationInitStatus(value: boolean) {
        notificationInitStatus.value = value;
    }

    function clearUnseenNotifications() {
        unseenNotifications.value = [];
    }

    /**
     * @param notificationId
     */
    function handleNotificationSee(notificationId: any) {
        removeFromArray(unseenNotifications.value, notificationId);
        if (unseenNotifications.value.length === 0) {
            uiStore.removeNotify('notification');
        }
        const ref = notificationTable.value.data.find((n) => (n as any).id === notificationId);
        if (ref) {
            (ref as any).seen = true;
        }
        database.seenNotificationV2(notificationId);
    }

    const seeQueue: any = [];
    const seenIds = new Set();
    let seeProcessing = false;

    async function processSeeQueue() {
        if (seeProcessing) return;
        seeProcessing = true;
        let item;
        while ((item = seeQueue.shift())) {
            const { id, version } = item;
            try {
                await executeWithBackoff(
                    async () => {
                        if (version >= 2) {
                            const args = await notificationRequest.seeNotificationV2({
                                notificationId: id
                            });
                            handleNotificationV2Update({
                                params: { notificationId: id },
                                json: { ...args.json, seen: true }
                            });
                        } else {
                            await notificationRequest.seeNotification({
                                notificationId: id
                            });
                            handleNotificationSee(id);
                        }
                    },
                    {
                        maxRetries: 3,
                        baseDelay: 1000,
                        shouldRetry: (err: any) => err?.status === 429 || (err?.message || '').includes('429')
                    }
                );
            } catch {
                console.warn('Failed to mark notification as seen:', id);
                if (version >= 2) {
                    handleNotificationV2Hide(id);
                }
            }
        }
        seeProcessing = false;
    }

    /**
     * Queue a notification to be marked as seen.
     *
     * @param {string} notificationId
     * @param {number} [version]
     */
    function queueMarkAsSeen(notificationId: string, version: number = 1) {
        if (seenIds.has(notificationId)) return;
        seenIds.add(notificationId);
        seeQueue.push({ id: notificationId, version });
        processSeeQueue();
    }

    function markAllAsSeen() {
        const unseenIds = [...unseenNotifications.value];
        for (const id of unseenIds) {
            const ref = notificationTable.value.data.find((n) => (n as any).id === id);
            const version = (ref as any)?.version || 1;
            queueMarkAsSeen(id, version);
        }
        unseenNotifications.value = [];
        uiStore.removeNotify('notification');
    }

    /**
     * @param args
     */
    function handleNotificationAccept(args: any) {
        let ref;
        const array = notificationTable.value.data;
        for (let i = array.length - 1; i >= 0; i--) {
            if ((array[i] as any).id === args.params.notificationId) {
                ref = array[i];
                break;
            }
        }
        if (typeof ref === 'undefined') {
            return;
        }
        (ref as any).$isExpired = true;
        args.ref = ref;
        handleNotificationExpire({
            ref,
            params: {
                notificationId: (ref as any).id
            }
        });
        handleFriendAdd({
            params: {
                userId: (ref as any).senderUserId
            }
        });

        const D = userStore.userDialog;
        if (typeof args.ref === 'undefined' || args.ref.type !== 'friendRequest' || args.ref.senderUserId !== D.id) {
            return;
        }
        D.isFriend = true;
        D.incomingRequest = false;
    }

    /**
     * @param args
     */
    function handleNotificationExpire(args: any) {
        const { ref } = args;
        const D = userStore.userDialog;
        if (ref.type !== 'friendRequest' || ref.senderUserId !== D.id) {
            return;
        }
        D.incomingRequest = false;
    }

    /**
     * @param {object} data
     * @returns {object}
     */
    function applyNotification(data: object) {
        const json = sanitizeNotificationJson({ ...data });
        let ref;
        const array = notificationTable.value.data;
        for (let i = array.length - 1; i >= 0; i--) {
            if ((array[i] as any).id === (json as any).id) {
                ref = array[i];
                break;
            }
        }
        if (typeof ref === 'undefined') {
            ref = createDefaultNotificationRef(json);
        } else {
            Object.assign(ref, json);
            (ref as any).$isExpired = false;
        }
        ref.details = parseNotificationDetails(ref.details);
        return ref;
    }

    /**
     * @param data
     */
    function applyNotificationV2(data: any) {
        const json = sanitizeNotificationJson({ ...data });
        let ref = notificationTable.value.data.find((n) => (n as any).id === (json as any).id);
        if (typeof ref === 'undefined') {
            ref = createDefaultNotificationV2Ref(json);
        } else {
            Object.assign(ref, json);
        }

        ref.created_at = ref.createdAt; // for table

        applyBoopLegacyHandling(ref, AppDebug.endpointDomain);
        return ref;
    }

    /**
     * @param args
     */
    function handleNotificationV2(args: any) {
        const ref = applyNotificationV2(args.json);

        if (ref.seen) {
            removeFromArray(unseenNotifications.value, ref.id);
        } else if (!unseenNotifications.value.includes(ref.id)) {
            unseenNotifications.value.push(ref.id);
        }

        const existingNotification = notificationTable.value.data.find((n) => (n as any).id === ref.id);
        if (existingNotification) {
            Object.assign(existingNotification, ref);
            database.addNotificationV2ToDatabase(existingNotification); // update
            return;
        }

        const isNotificationInitReady = !notificationInitStatus.value || !isNotificationsLoading.value;
        const matchesNotificationTypeFilter =
            notificationTable.value.filters[0].value.length === 0 ||
            notificationTable.value.filters[0].value.includes(ref.type);
        if (isNotificationInitReady && matchesNotificationTypeFilter) {
            uiStore.notifyMenu('notification');
        }
        database.addNotificationV2ToDatabase(ref);

        notificationTable.value.data.push(ref);

        queueNotificationNoty(ref);
        sharedFeedStore.addEntry(ref);
    }

    /**
     * @param args
     */
    function handleNotificationV2Update(args: any) {
        const notificationId = args.params.notificationId;
        const json = { ...args.json };
        if (!json) {
            return;
        }
        json.id = notificationId;
        handleNotificationV2({
            json,
            params: {
                notificationId
            }
        });
        if (json.seen) {
            handleNotificationSee(notificationId);
        }
    }

    /**
     * @param notificationId
     */
    function handleNotificationV2Hide(notificationId: any) {
        database.expireNotificationV2(notificationId);
        const ref = notificationTable.value.data.find((n) => (n as any).id === notificationId);
        if (ref) {
            (ref as any).expiresAt = new Date().toJSON();
            (ref as any).seen = true;
        }
    }

    function expireFriendRequestNotifications() {
        const array = notificationTable.value.data;
        for (let i = array.length - 1; i >= 0; i--) {
            if ((array[i] as any).type === 'friendRequest' || (array[i] as any).type === 'ignoredFriendRequest') {
                array.splice(i, 1);
            }
        }
    }

    /**
     * @param {string} notificationId
     */
    function expireNotification(notificationId: string) {
        let ref;
        const array = notificationTable.value.data;
        for (let i = array.length - 1; i >= 0; i--) {
            if ((array[i] as any).id === notificationId) {
                ref = array[i];
                break;
            }
        }
        if (typeof ref === 'undefined') {
            return;
        }
        (ref as any).$isExpired = true;
        database.updateNotificationExpired(ref);
        handleNotificationExpire({
            ref,
            params: {
                notificationId: (ref as any).id
            }
        });
    }

    /**
     * @returns {Promise<void>}
     */
    async function refreshNotifications() {
        isNotificationsLoading.value = true;
        let count;
        let params;
        try {
            expireFriendRequestNotifications();
            params = {
                n: 100,
                offset: 0
            };
            count = 50; // 5000 max
            for (let i = 0; i < count; i++) {
                const args = await notificationRequest.getNotifications(params);
                for (const json of args.json) {
                    handleNotification({
                        json,
                        params: {
                            notificationId: json.id
                        }
                    });
                }
                params.offset += 100;
                if (args.json.length < 100) {
                    break;
                }
            }
            params = {
                n: 100,
                offset: 0
            };
            count = 50; // 5000 max
            for (let i = 0; i < count; i++) {
                const args = await notificationRequest.getNotificationsV2(params);
                for (const json of args.json) {
                    handleNotificationV2({
                        json,
                        params: {
                            notificationId: json.id
                        }
                    });
                }
                params.offset += 100;
                if (args.json.length < 100) {
                    break;
                }
            }
            params = {
                n: 100,
                offset: 0
            };
            count = 50; // 5000 max
            for (let i = 0; i < count; i++) {
                const args = await notificationRequest.getHiddenFriendRequests(params);
                for (const json of args.json) {
                    handleNotification({
                        json: { ...json, type: 'ignoredFriendRequest' },
                        params: {
                            notificationId: json.id
                        }
                    });
                }
                params.offset += 100;
                if (args.json.length < 100) {
                    break;
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            isNotificationsLoading.value = false;
            notificationInitStatus.value = true;
        }
    }

    /**
     * @param {object} noty
     */
    function queueNotificationNoty(noty: object) {
        (noty as any).isFriend = friendStore.friends.has((noty as any).senderUserId);
        (noty as any).isFavorite = friendStore.localFavoriteFriends.has((noty as any).senderUserId);
        const notyFilter = notificationsSettingsStore.sharedFeedFilters.noty;
        if (
            (notyFilter as any)[(noty as any).type] &&
            ((notyFilter as any)[(noty as any).type] === 'On' ||
                (notyFilter as any)[(noty as any).type] === 'Friends' ||
                ((notyFilter as any)[(noty as any).type] === 'VIP' && (noty as any).isFavorite))
        ) {
            playNoty(noty);
        }
    }

    /**
     * @param noty
     */
    function playNoty(noty: any) {
        if (userStore.currentUser.status === 'busy' || !watchState.isFriendsLoaded) {
            return;
        }
        let displayName = '';
        if (noty.type === 'DisplayName' && noty.previousDisplayName) {
            displayName = noty.previousDisplayName;
        } else if (noty.displayName) {
            displayName = noty.displayName;
        } else if (noty.senderUsername) {
            displayName = noty.senderUsername;
        } else if (noty.sourceDisplayName) {
            displayName = noty.sourceDisplayName;
        }
        if (displayName) {
            // don't play noty twice
            const notyId = `${noty.type},${displayName}`;
            if ((notyMap as any)[notyId] && (notyMap as any)[notyId] >= noty.created_at) {
                return;
            }
            (notyMap as any)[notyId] = noty.created_at;
        }
        const bias = new Date(Date.now() - 60000).toJSON();
        for (const [notyId, createdAt] of Object.entries(notyMap)) {
            if ((createdAt as any) < bias) {
                delete (notyMap as any)[notyId];
            }
        }
        if (noty.created_at < bias) {
            // don't play noty if it's over 1min old
            return;
        }

        const notiConditions = {
            Always: () => true,
            'Inside VR': () => gameStore.isSteamVRRunning,
            'Outside VR': () => !gameStore.isSteamVRRunning,
            'Game Closed': () => !gameStore.isGameRunning, // Also known as "Outside VRChat"
            'Game Running': () => gameStore.isGameRunning, // Also known as "Inside VRChat"
            'Desktop Mode': () => gameStore.isGameNoVR && gameStore.isGameRunning,
            AFK: () =>
                notificationsSettingsStore.afkDesktopToast &&
                gameStore.isHmdAfk &&
                gameStore.isGameRunning &&
                !gameStore.isGameNoVR
        };

        const playNotificationTTS = (notiConditions as any)[notificationsSettingsStore.notificationTTS]?.();
        const playDesktopToast =
            (notiConditions as any)[notificationsSettingsStore.desktopToast]?.() || notiConditions['AFK']();

        const playOverlayToast = (notiConditions as any)[notificationsSettingsStore.overlayToast]?.();
        const playOverlayNotification = notificationsSettingsStore.overlayNotifications && playOverlayToast;
        const playXSNotification = notificationsSettingsStore.xsNotifications && playOverlayToast;
        const playOvrtHudNotifications = notificationsSettingsStore.ovrtHudNotifications && playOverlayToast;
        const playOvrtWristNotifications = notificationsSettingsStore.ovrtWristNotifications && playOverlayToast;

        let message = '';
        if (noty.title) {
            message = `${noty.title}, ${noty.message}`;
        } else if (noty.message) {
            message = noty.message;
        }
        const messageList = ['inviteMessage', 'requestMessage', 'responseMessage'];
        for (let k = 0; k < messageList.length; k++) {
            if (typeof noty.details !== 'undefined' && typeof noty.details[messageList[k]] !== 'undefined') {
                message = `, ${noty.details[messageList[k]]}`;
            }
        }
        if (playNotificationTTS) {
            playNotyTTS(noty, displayName, message);
        }
        if (
            playDesktopToast ||
            playXSNotification ||
            playOvrtHudNotifications ||
            playOvrtWristNotifications ||
            playOverlayNotification
        ) {
            if (notificationsSettingsStore.imageNotifications) {
                notySaveImage(noty).then((image) => {
                    if (playXSNotification) {
                        displayXSNotification(noty, message, image);
                    }
                    if (playOvrtHudNotifications || playOvrtWristNotifications) {
                        displayOvrtNotification(
                            playOvrtHudNotifications,
                            playOvrtWristNotifications,
                            noty,
                            message,
                            image
                        );
                    }
                    if (playDesktopToast) {
                        displayDesktopToast(noty, message, image);
                    }
                    if (playOverlayNotification) {
                        displayOverlayNotification(noty, message, image);
                    }
                });
            } else {
                if (playXSNotification) {
                    displayXSNotification(noty, message, '');
                }
                if (playOvrtHudNotifications || playOvrtWristNotifications) {
                    displayOvrtNotification(playOvrtHudNotifications, playOvrtWristNotifications, noty, message, '');
                }
                if (playDesktopToast) {
                    displayDesktopToast(noty, message, '');
                }
                if (playOverlayNotification) {
                    displayOverlayNotification(noty, message, '');
                }
            }
        }
    }

    /**
     * @param {object} noty
     * @param {string} displayName
     * @param {string} message
     */
    async function playNotyTTS(noty: object, displayName: string, message: string) {
        if (notificationsSettingsStore.notificationTTSNickName) {
            const userId = getUserIdFromNoty(noty);
            const memo = await getUserMemo(userId);
            if ((memo as any).memo) {
                const array = (memo as any).memo.split('\n');
                const nickName = array[0];
                displayName = nickName;
            }
        }
        const msg = getNotificationMessage(noty, message, displayName);
        if (msg) {
            notificationsSettingsStore.speak(toNotificationText(msg.title, msg.body, (noty as any).type));
        }
    }

    const {
        notySaveImage,
        displayDesktopToast,
        displayOverlayNotification,
        displayXSNotification,
        displayOvrtNotification
    } = createOverlayDispatch({
        getUserIdFromNoty,
        queryRequest,
        notificationsSettingsStore,
        advancedSettingsStore
    });

    // Overlay dispatch functions (notySaveImage, displayDesktopToast, etc.)
    // are in ./overlayDispatch.js — destructured above via createOverlayDispatch().

    /**
     * @param {object} noty
     * @returns
     */
    function getUserIdFromNoty(noty: object) {
        const id = getUserIdFromNotyBase(noty);
        if (id) return id;
        if ((noty as any).displayName) {
            return (
                findUserByDisplayName(
                    userStore.cachedUsers,
                    (noty as any).displayName,
                    userStore.cachedUserIdsByDisplayName
                )?.id ?? ''
            );
        }
        return '';
    }

    /**
     * @param gamelog
     */
    function queueGameLogNoty(gamelog: any) {
        const noty = structuredClone(gamelog);
        let bias;
        // remove join/leave notifications when switching worlds
        if (
            noty.type === 'OnPlayerJoined'
            // noty.type === 'BlockedOnPlayerJoined' ||
            // noty.type === 'MutedOnPlayerJoined'
        ) {
            bias = locationStore.lastLocation.date + 30 * 1000; // 30 secs
            if (Date.parse(noty.created_at) <= bias) {
                return;
            }
        }
        if (noty.type === 'OnPlayerLeft' || noty.type === 'BlockedOnPlayerLeft' || noty.type === 'MutedOnPlayerLeft') {
            bias = locationStore.lastLocationDestinationTime + 5 * 1000; // 5 secs
            if (Date.parse(noty.created_at) <= bias) {
                return;
            }
        }
        if (
            noty.type === 'Notification' ||
            noty.type === 'LocationDestination'
            // skip unused entries
        ) {
            return;
        }
        if (noty.type === 'VideoPlay') {
            if (!noty.videoName) {
                // skip video without name
                return;
            }
            noty.notyName = noty.videoName;
            if (noty.displayName) {
                // add requester's name to noty
                noty.notyName = `${noty.videoName} (${noty.displayName})`;
            }
        }
        if (noty.type !== 'VideoPlay' && noty.displayName === userStore.currentUser.displayName) {
            // remove current user
            return;
        }
        noty.isFriend = false;
        noty.isFavorite = false;
        if (noty.userId) {
            noty.isFriend = friendStore.friends.has(noty.userId);
            noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId);
        } else if (noty.displayName) {
            const ref = findUserByDisplayName(
                userStore.cachedUsers,
                noty.displayName,
                userStore.cachedUserIdsByDisplayName
            );
            if (ref) {
                noty.isFriend = friendStore.friends.has(ref.id);
                noty.isFavorite = friendStore.localFavoriteFriends.has(ref.id);
            }
        }
        const notyFilter = notificationsSettingsStore.sharedFeedFilters.noty;
        if (
            (notyFilter as any)[noty.type] &&
            ((notyFilter as any)[noty.type] === 'On' ||
                (notyFilter as any)[noty.type] === 'Everyone' ||
                ((notyFilter as any)[noty.type] === 'Friends' && noty.isFriend) ||
                ((notyFilter as any)[noty.type] === 'VIP' && noty.isFavorite))
        ) {
            playNoty(noty);
        }
    }

    /**
     * @param feed
     */
    function queueFeedNoty(feed: any) {
        const noty = { ...feed };
        if (noty.type === 'Avatar') {
            return;
        }
        // hide private worlds from feed
        if (wristOverlaySettingsStore.hidePrivateFromFeed && noty.type === 'GPS' && noty.location === 'private') {
            return;
        }
        noty.isFriend = friendStore.friends.has(noty.userId);
        noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId);
        const notyFilter = notificationsSettingsStore.sharedFeedFilters.noty;
        if (
            (notyFilter as any)[noty.type] &&
            ((notyFilter as any)[noty.type] === 'Everyone' ||
                ((notyFilter as any)[noty.type] === 'Friends' && noty.isFriend) ||
                ((notyFilter as any)[noty.type] === 'VIP' && noty.isFavorite))
        ) {
            playNoty(noty);
        }
    }

    /**
     * @param noty
     */
    function queueFriendLogNoty(noty: any) {
        if (noty.type === 'FriendRequest') {
            return;
        }
        noty.isFriend = friendStore.friends.has(noty.userId);
        noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId);
        const notyFilter = notificationsSettingsStore.sharedFeedFilters.noty;
        if (
            (notyFilter as any)[noty.type] &&
            ((notyFilter as any)[noty.type] === 'On' ||
                (notyFilter as any)[noty.type] === 'Friends' ||
                ((notyFilter as any)[noty.type] === 'VIP' && noty.isFavorite))
        ) {
            playNoty(noty);
        }
    }

    /**
     * @param noty
     */
    function queueModerationNoty(noty: any) {
        noty.isFriend = false;
        noty.isFavorite = false;
        if (noty.userId) {
            noty.isFriend = friendStore.friends.has(noty.userId);
            noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId);
        }
        const notyFilter = notificationsSettingsStore.sharedFeedFilters.noty;
        if ((notyFilter as any)[noty.type] && (notyFilter as any)[noty.type] === 'On') {
            playNoty(noty);
        }
    }

    async function initNotifications() {
        notificationInitStatus.value = false;
        let tableData: any[] = await database.getNotificationsV2();
        const notifications: any[] = await database.getNotifications();

        tableData = tableData.concat(notifications.filter((n) => !tableData.some((t) => t.id === n.id)));

        tableData.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        tableData.splice(dbVars.maxTableSize);

        notificationTable.value.data = tableData;
        refreshNotifications();
    }

    async function checkInventoryBundles() {
        if (!notificationsSettingsStore.inventoryBundleNotifications) {
            return;
        }
        let bundles;
        try {
            const args = await inventoryRequest.getInventoryItems({
                n: 100,
                offset: 0,
                types: 'bundle',
                order: 'newest'
            });
            bundles = args.json.data;
        } catch (err) {
            console.error('Failed to check inventory bundles:', err);
            return;
        }
        const newBundles = bundles.filter(
            (item) => !shownBundleIds.has(item.id) && !ignoredBundleTemplateIds.has(item.templateId)
        );
        if (newBundles.length === 0) {
            return;
        }
        for (const item of newBundles) {
            shownBundleIds.add(item.id);
        }
        const dialog = inventoryBundleDialog.value;
        if (dialog.visible) {
            dialog.bundles.push(...newBundles);
        } else {
            dialog.bundles = newBundles;
        }
        dialog.visible = true;
    }

    function getEffectiveListingPrice(listing: any) {
        if (userStore.isLocalUserVrcPlusSupporter && listing.vrcPlusDiscountPrice != null) {
            return listing.vrcPlusDiscountPrice;
        }
        return listing.priceTokens;
    }

    function isListingOwned(listing: any) {
        if (userStore.ownedListingIds.has(listing.id)) {
            return true;
        }
        const productIds = listing.productIds ?? [];
        return productIds.length > 0 && productIds.every((id: any) => userStore.ownedProductIds.has(id));
    }

    function isListingInBundle(listing: any, listings: any) {
        const productIds = listing.productIds ?? [];
        if (productIds.length === 0) {
            return false;
        }
        for (const other of listings.values()) {
            const bundleProductIds = other.productIds ?? [];
            if (
                other.id !== listing.id &&
                bundleProductIds.length > productIds.length &&
                productIds.every((id: any) => bundleProductIds.includes(id))
            ) {
                return true;
            }
        }
        return false;
    }

    async function checkFreeStoreItems() {
        if (!notificationsSettingsStore.freeStoreItemNotifications) {
            return;
        }
        let shelves;
        try {
            const [results] = await Promise.all([
                Promise.all(
                    VRCHAT_STORE_IDS.map((storeId) =>
                        marketplaceRequest.getStoreShelves({
                            storeId,
                            fetch: 'public',
                            hydrateListings: true
                        })
                    )
                ),
                userStore.getAllProductPurchases()
            ]);
            shelves = results.flatMap((args) => args.json ?? []);
        } catch (err) {
            console.error('Failed to check free store items:', err);
            return;
        }
        const freeListings = new Map();
        for (const shelf of shelves) {
            for (const listing of shelf.listings ?? []) {
                if (
                    listing.active &&
                    !getEffectiveListingPrice(listing) &&
                    !isListingOwned(listing) &&
                    !shownFreeListingIds.has(listing.id)
                ) {
                    freeListings.set(listing.id, {
                        ...listing,
                        displayName: replaceBioSymbols(listing.displayName)
                    });
                }
            }
        }
        for (const listing of freeListings.values()) {
            shownFreeListingIds.add(listing.id);
        }
        const newListings = Array.from(freeListings.values()).filter(
            (listing) => !isListingInBundle(listing, freeListings)
        );
        if (newListings.length === 0) {
            return;
        }
        const dialog = freeStoreItemDialog.value;
        if (dialog.visible) {
            dialog.listings.push(...newListings);
        } else {
            dialog.listings = newListings;
        }
        dialog.visible = true;
    }

    function testNotification() {
        playNoty({
            type: 'Event',
            created_at: new Date().toJSON(),
            data: t('view.settings.notifications.notifications.test_message')
        });
    }

    /**
     * @param row
     */
    function acceptFriendRequestNotification(row: any) {
        modalStore
            .confirm({
                description: t('confirm.accept_friend_request'),
                title: t('confirm.title')
            })
            .then(({ ok }) => {
                if (!ok) return;
                notificationRequest
                    .acceptFriendRequestNotification({
                        notificationId: row.id
                    })
                    .then((args) => {
                        handleNotificationAccept(args);
                    })
                    .catch((err) => {
                        if (err && err.message && err.message.includes('404')) {
                            handleNotificationHide(row.id);
                        }
                    });
            })
            .catch(() => {});
    }

    /**
     * @param row
     */
    async function hideNotification(row: any) {
        if (row.type === 'ignoredFriendRequest') {
            await friendRequest.deleteHiddenFriendRequest({ notificationId: row.id }, row.senderUserId);
            handleNotificationHide(row.id);
        } else {
            notificationRequest
                .hideNotification({
                    notificationId: row.id
                })
                .then(() => {
                    handleNotificationHide(row.id);
                });
        }
    }

    /**
     * @param row
     */
    function hideNotificationPrompt(row: any) {
        modalStore
            .confirm({
                description: t('confirm.decline_type', { type: row.type }),
                title: t('confirm.title')
            })
            .then(({ ok }) => {
                if (ok) hideNotification(row);
            })
            .catch(() => {});
    }

    /**
     * @param row
     */
    function acceptRequestInvite(row: any) {
        modalStore
            .confirm({
                description: t('confirm.send_invite'),
                title: t('confirm.title')
            })
            .then(({ ok }) => {
                if (!ok) return;
                let currentLocation = locationStore.lastLocation.location;
                if (locationStore.lastLocation.location === 'traveling') {
                    currentLocation = locationStore.lastLocationDestination;
                }
                if (!currentLocation) {
                    currentLocation = userStore.currentUser?.$locationTag;
                }
                const L = parseLocation(currentLocation);
                queryRequest.fetch('world', { worldId: L.worldId }).then((args) => {
                    notificationRequest
                        .sendInvite(
                            {
                                instanceId: L.tag,
                                worldId: L.tag,
                                worldName: (args as any).ref.name,
                                rsvp: true
                            },
                            row.senderUserId
                        )
                        .then((_args) => {
                            toast(t('message.invite.sent'));
                            notificationRequest
                                .hideNotification({
                                    notificationId: row.id
                                })
                                .then(() => {
                                    handleNotificationHide(row.id);
                                });
                            return _args;
                        });
                });
            })
            .catch(() => {});
    }

    /**
     * @param notificationId
     * @param responses
     * @param responseType
     */
    function sendNotificationResponse(notificationId: any, responses: any, responseType: any) {
        if (!Array.isArray(responses) || responses.length === 0) return;
        let responseData = '';
        for (let i = 0; i < responses.length; i++) {
            if (responses[i].type === responseType) {
                responseData = responses[i].data;
                break;
            }
        }
        const params = { notificationId, responseType, responseData };
        notificationRequest
            .sendNotificationResponse(params)
            .then((args) => {
                console.log('Notification response', args);
                if (!args.json) return;
                handleNotificationV2Hide(notificationId);
                toast.success(args.json);
            })
            .catch(() => {
                handleNotificationV2Hide(notificationId);
                notificationRequest.hideNotificationV2(notificationId);
            });
    }

    /**
     * @param row
     */
    function deleteNotificationLog(row: any) {
        const idx = notificationTable.value.data.findIndex((e) => (e as any).id === row.id);
        if (idx !== -1) {
            notificationTable.value.data.splice(idx, 1);
        }
        if (row.type !== 'friendRequest' && row.type !== 'ignoredFriendRequest') {
            if (!row.version || row.version < 2) {
                database.deleteNotification(row.id);
            } else {
                database.deleteNotificationV2(row.id);
            }
        }
    }

    /**
     * @param row
     */
    function deleteNotificationLogPrompt(row: any) {
        modalStore
            .confirm({
                // TODO: type translation
                description: t('confirm.delete_type', { type: row.type }),
                title: t('confirm.title')
            })
            .then(({ ok }) => {
                if (ok) deleteNotificationLog(row);
            })
            .catch(() => {});
    }

    /**
     * @param notification
     */
    function isNotificationExpired(notification: any) {
        if (notification.$isExpired !== undefined) {
            return notification.$isExpired;
        }
        if (!notification.expiresAt) {
            return false;
        }
        const expiresAt = dayjs(notification.expiresAt);
        return expiresAt.isValid() && dayjs().isSameOrAfter(expiresAt);
    }

    /**
     * @param link
     */
    function openNotificationLink(link: any) {
        if (!link) {
            return;
        }
        const data = link.split(':');
        if (!data.length) {
            return;
        }
        switch (data[0]) {
            case 'group':
                showGroupDialog(data[1]);
                break;
            case 'user':
                showUserDialog(data[1]);
                break;
            case 'event':
                const ids = data[1].split(',');
                if (ids.length < 2) {
                    console.error('Invalid event notification link:', data[1]);
                    return;
                }

                showGroupDialog(ids[0]);
                // ids[1] cal_ is the event id
                break;
            case 'openNotificationLink':
            case 'OpenSafetyCenter':
            default:
                toast.error(`Unsupported notification link type: "${link}"`);
                break;
        }
    }

    return {
        notificationInitStatus,
        notificationTable,
        unseenNotifications,
        isNotificationsLoading,
        inventoryBundleDialog,
        freeStoreItemDialog,

        initNotifications,
        expireNotification,
        refreshNotifications,
        checkInventoryBundles,
        checkFreeStoreItems,
        queueNotificationNoty,
        playNoty,
        queueGameLogNoty,
        queueFeedNoty,
        queueFriendLogNoty,
        queueModerationNoty,
        handleNotificationAccept,
        handleNotificationSee,
        handlePipelineNotification,
        handleNotificationV2Update,
        handleNotificationHide,
        handleNotificationV2Hide,
        handleNotification,
        handleNotificationV2,
        testNotification,

        // Notification actions
        acceptFriendRequestNotification,
        hideNotification,
        hideNotificationPrompt,
        acceptRequestInvite,
        sendNotificationResponse,
        deleteNotificationLog,
        deleteNotificationLogPrompt,

        isNotificationCenterOpen,
        friendNotifications,
        groupNotifications,
        otherNotifications,
        unseenFriendNotifications,
        unseenGroupNotifications,
        unseenOtherNotifications,
        recentFriendNotifications,
        recentGroupNotifications,
        recentOtherNotifications,
        hasUnseenNotifications,
        getNotificationCategory,
        isNotificationExpired,
        openNotificationLink,
        queueMarkAsSeen,
        markAllAsSeen,
        appendNotificationTableEntry,
        setNotificationInitStatus,
        clearUnseenNotifications
    };
});
