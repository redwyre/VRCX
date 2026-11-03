import { getGroupName, getWorldName, parseLocation } from '../shared/utils';
import { AppDebug } from '../services/appConfig';
import { database } from '../services/database';
import { getAvatarName } from './avatarCoordinator';
import { useFeedStore } from '../stores/feed';
import { useFriendStore } from '../stores/friend';
import { useGroupStore } from '../stores/group';
import { useInstanceStore } from '../stores/instance';
import { useNotificationStore } from '../stores/notification';
import { useSharedFeedStore } from '../stores/sharedFeed';
import { useUserStore } from '../stores/user';
import { useWorldStore } from '../stores/world';

/**
 * Handles user diff events and applies cross-store side effects.
 *
 * @param {object} ref Updated user reference.
 * @param {object} props Changed props with [new, old] tuples.
 * @param {object} [options] Test seams.
 * @param {function} [options.now] Timestamp provider.
 * @param {function} [options.nowIso] ISO timestamp provider.
 * @returns {Promise<void>}
 */
export async function runHandleUserUpdateFlow(
    ref: object,
    props: object,
    {
        now = Date.now,
        nowIso = () => new Date().toJSON()
    }: {
        now?: () => number;

        nowIso?: () => string;
    } = {}
) {
    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const worldStore = useWorldStore();
    const groupStore = useGroupStore();
    const instanceStore = useInstanceStore();
    const feedStore = useFeedStore();
    const notificationStore = useNotificationStore();
    const sharedFeedStore = useSharedFeedStore();

    const { state, userDialog, applyUserDialogLocation, checkNote } = userStore;

    let feed;
    let newLocation;
    let previousLocation;
    const friend = friendStore.friends.get((ref as any).id);
    if (typeof friend === 'undefined') {
        return;
    }
    if ((props as any).location) {
        // update instancePlayerCount
        previousLocation = (props as any).location[1];
        newLocation = (props as any).location[0];
        let oldCount = state.instancePlayerCount.get(previousLocation);
        if (typeof oldCount !== 'undefined') {
            oldCount--;
            if (oldCount <= 0) {
                state.instancePlayerCount.delete(previousLocation);
            } else {
                state.instancePlayerCount.set(previousLocation, oldCount);
            }
        }
        let newCount = state.instancePlayerCount.get(newLocation);
        if (typeof newCount === 'undefined') {
            newCount = 0;
        }
        newCount++;
        state.instancePlayerCount.set(newLocation, newCount);

        const previousLocationL = parseLocation(previousLocation);
        const newLocationL = parseLocation(newLocation);
        if (
            previousLocationL.tag === (userDialog.$location as any).tag ||
            newLocationL.tag === (userDialog.$location as any).tag
        ) {
            // update user dialog instance occupants
            applyUserDialogLocation(true);
        }
        if (
            previousLocationL.worldId === worldStore.worldDialog.id ||
            newLocationL.worldId === worldStore.worldDialog.id
        ) {
            instanceStore.applyWorldDialogInstances();
        }
        if (
            previousLocationL.groupId === groupStore.groupDialog.id ||
            newLocationL.groupId === groupStore.groupDialog.id
        ) {
            instanceStore.applyGroupDialogInstances();
        }
    }
    if (
        !(props as any).state &&
        (props as any).location &&
        (props as any).location[0] !== 'offline' &&
        (props as any).location[0] !== '' &&
        (props as any).location[1] !== 'offline' &&
        (props as any).location[1] !== '' &&
        (props as any).location[0] !== 'traveling'
    ) {
        // skip GPS if user is offline or traveling
        previousLocation = (props as any).location[1];
        newLocation = (props as any).location[0];
        let time = (props as any).location[2];
        if (previousLocation === 'traveling' && (ref as any).$previousLocation) {
            previousLocation = (ref as any).$previousLocation;
            const travelTime = now() - (ref as any).$travelingToTime;
            time -= travelTime;
            if (time < 0) {
                time = 0;
            }
        }
        if (AppDebug.debugFriendState && previousLocation) {
            console.log(`${(ref as any).displayName} GPS ${previousLocation} -> ${newLocation}`);
        }
        if (previousLocation === 'offline') {
            previousLocation = '';
        }
        if (!previousLocation) {
            // no previous location
            if (AppDebug.debugFriendState) {
                console.log((ref as any).displayName, 'Ignoring GPS, no previous location', newLocation);
            }
        } else if ((ref as any).$previousLocation === newLocation) {
            // location traveled to is the same
            (ref as any).$location_at = now() - time;
        } else {
            const worldName = await getWorldName(newLocation);
            const groupName = await getGroupName(newLocation);
            feed = {
                created_at: nowIso(),
                type: 'GPS',
                userId: (ref as any).id,
                displayName: (ref as any).displayName,
                location: newLocation,
                worldName,
                groupName,
                previousLocation,
                time
            };
            notificationStore.queueFeedNoty(feed);
            sharedFeedStore.addEntry(feed);
            const persistedFeed = await database.addGPSToDatabase(feed);
            if (persistedFeed) {
                feedStore.addFeedEntry(persistedFeed);
            }
            // clear previousLocation after GPS
            (ref as any).$previousLocation = '';
            (ref as any).$travelingToTime = now();
        }
    }
    if (
        (props as any).location &&
        (props as any).location[0] === 'traveling' &&
        (props as any).location[1] !== 'traveling'
    ) {
        // store previous location when user is traveling
        (ref as any).$previousLocation = (props as any).location[1];
        (ref as any).$travelingToTime = now();
    }
    if ((ref as any).bannerType === 'avatarBanner' && (props as any).bannerUrl && (props as any).bannerUrl[0]) {
        const currentBannerUrl = (props as any).bannerUrl[0];
        const previousBannerUrl = (props as any).bannerUrl[1];
        let avatarInfo = {
            ownerId: '',
            avatarName: ''
        };
        try {
            avatarInfo = await getAvatarName(currentBannerUrl);
        } catch (err) {
            console.log(err);
        }
        if (avatarInfo.ownerId) {
            let previousAvatarInfo = {
                ownerId: '',
                avatarName: ''
            };
            try {
                previousAvatarInfo = await getAvatarName(previousBannerUrl);
            } catch (err) {
                console.log(err);
            }
            feed = {
                created_at: nowIso(),
                type: 'Avatar',
                userId: (ref as any).id,
                displayName: (ref as any).displayName,
                ownerId: avatarInfo.ownerId,
                previousOwnerId: previousAvatarInfo.ownerId,
                avatarName: avatarInfo.avatarName,
                previousAvatarName: previousAvatarInfo.avatarName,
                currentAvatarImageUrl: avatarInfo.ownerId ? currentBannerUrl : '',
                currentAvatarThumbnailImageUrl: avatarInfo.ownerId ? currentBannerUrl : '',
                previousCurrentAvatarImageUrl: previousAvatarInfo.ownerId ? previousBannerUrl : '',
                previousCurrentAvatarThumbnailImageUrl: previousAvatarInfo.ownerId ? previousBannerUrl : ''
            };
            notificationStore.queueFeedNoty(feed);
            sharedFeedStore.addEntry(feed);
            const persistedFeed = await database.addAvatarToDatabase(feed);
            if (persistedFeed) {
                feedStore.addFeedEntry(persistedFeed);
            }
        }
    } else if ((props as any).iconUrl && (props as any).iconUrl[0]) {
        const currentIconUrl = (props as any).iconUrl[0];
        const previousIconUrl = (props as any).iconUrl[1];
        let avatarInfo = {
            ownerId: '',
            avatarName: ''
        };
        try {
            avatarInfo = await getAvatarName(currentIconUrl);
        } catch (err) {
            console.log(err);
        }
        if (avatarInfo.ownerId) {
            let previousAvatarInfo = {
                ownerId: '',
                avatarName: ''
            };
            try {
                previousAvatarInfo = await getAvatarName(previousIconUrl);
            } catch (err) {
                console.log(err);
            }
            feed = {
                created_at: nowIso(),
                type: 'Avatar',
                userId: (ref as any).id,
                displayName: (ref as any).displayName,
                ownerId: avatarInfo.ownerId,
                previousOwnerId: previousAvatarInfo.ownerId,
                avatarName: avatarInfo.avatarName,
                previousAvatarName: previousAvatarInfo.avatarName,
                currentAvatarImageUrl: avatarInfo.ownerId ? currentIconUrl : '',
                currentAvatarThumbnailImageUrl: avatarInfo.ownerId ? currentIconUrl : '',
                previousCurrentAvatarImageUrl: previousAvatarInfo.ownerId ? previousIconUrl : '',
                previousCurrentAvatarThumbnailImageUrl: previousAvatarInfo.ownerId ? previousIconUrl : ''
            };
            notificationStore.queueFeedNoty(feed);
            sharedFeedStore.addEntry(feed);
            const persistedFeed = await database.addAvatarToDatabase(feed);
            if (persistedFeed) {
                feedStore.addFeedEntry(persistedFeed);
            }
        }
    }
    // if status is offline, ignore status and statusDescription
    if (
        ((props as any).status && (props as any).status[0] !== 'offline' && (props as any).status[1] !== 'offline') ||
        (!(props as any).status && (props as any).statusDescription)
    ) {
        let status = '';
        let previousStatus = '';
        let statusDescription = '';
        let previousStatusDescription = '';
        if ((props as any).status) {
            if ((props as any).status[0]) {
                status = (props as any).status[0];
            }
            if ((props as any).status[1]) {
                previousStatus = (props as any).status[1];
            }
        } else if ((ref as any).status) {
            status = (ref as any).status;
            previousStatus = (ref as any).status;
        }
        if ((props as any).statusDescription) {
            if ((props as any).statusDescription[0]) {
                statusDescription = (props as any).statusDescription[0];
            }
            if ((props as any).statusDescription[1]) {
                previousStatusDescription = (props as any).statusDescription[1];
            }
        } else if ((ref as any).statusDescription) {
            statusDescription = (ref as any).statusDescription;
            previousStatusDescription = (ref as any).statusDescription;
        }
        feed = {
            created_at: nowIso(),
            type: 'Status',
            userId: (ref as any).id,
            displayName: (ref as any).displayName,
            status,
            statusDescription,
            previousStatus,
            previousStatusDescription
        };
        notificationStore.queueFeedNoty(feed);
        sharedFeedStore.addEntry(feed);
        const persistedFeed = await database.addStatusToDatabase(feed);
        if (persistedFeed) {
            feedStore.addFeedEntry(persistedFeed);
        }
    }
    if ((props as any).note && (props as any).note[0] !== null && (props as any).note[0] !== (props as any).note[1]) {
        checkNote((ref as any).id, (props as any).note[0]);
    }
}
