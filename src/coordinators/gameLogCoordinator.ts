import dayjs from 'dayjs';

import {
    createJoinLeaveEntry,
    createLocationEntry,
    createPortalSpawnEntry,
    createResourceLoadEntry,
    findUserByDisplayName,
    parseLocation,
    parseInventoryFromUrl,
    parsePrintFromUrl,
    replaceBioSymbols
} from '../shared/utils';
import { i18n } from '../plugins/i18n';
import { AppDebug, logWebRequest } from '../services/appConfig';
import { database } from '../services/database';
import { runLastLocationResetFlow, runUpdateCurrentUserLocationFlow } from './locationCoordinator';
import { getGroupName } from '../shared/utils';
import { userRequest } from '../api';
import { watchState } from '../services/watchState';
import { toast } from 'vue-sonner';

import { useAdvancedSettingsStore } from '../stores/settings/advanced';
import { useFriendStore } from '../stores/friend';
import { useGalleryStore } from '../stores/gallery';
import { useGameStore } from '../stores/game';
import { useGameLogStore } from '../stores/gameLog';
import { useGeneralSettingsStore } from '../stores/settings/general';
import { useInstanceStore } from '../stores/instance';
import { useLocationStore } from '../stores/location';
import { useModalStore } from '../stores/modal';
import { useNotificationStore } from '../stores/notification';
import { usePhotonStore } from '../stores/photon';
import { useSharedFeedStore } from '../stores/sharedFeed';
import { useUserStore } from '../stores/user';
import { useVrStore } from '../stores/vr';
import { useVrcxStore } from '../stores/vrcx';

import gameLogService from '../services/gameLog';

import * as workerTimers from 'worker-timers';

/**
 * Loads the player list from game log history and syncs it to
 * locationStore, instanceStore, vrStore, and userStore.
 */
export async function tryLoadPlayerList() {
    const gameStore = useGameStore();
    const locationStore = useLocationStore();
    const userStore = useUserStore();
    const friendStore = useFriendStore();
    const instanceStore = useInstanceStore();
    const vrStore = useVrStore();

    if (!gameStore.isGameRunning) {
        return;
    }
    console.log('Loading player list from game log...');
    let ctx;
    let i;
    const data = await database.getGamelogDatabase();
    if (data.length === 0) {
        return;
    }
    let length = 0;
    for (i = data.length - 1; i > -1; i--) {
        ctx = data[i];
        if (ctx.type === 'Location') {
            locationStore.setLastLocation({
                date: Date.parse(ctx.created_at),
                location: ctx.location,
                name: ctx.worldName,
                playerList: new Map(),
                friendList: new Map()
            });
            length = i;
            break;
        }
    }
    if (length > 0) {
        for (i = length + 1; i < data.length; i++) {
            ctx = data[i];
            if (ctx.type === 'OnPlayerJoined') {
                if (!ctx.userId) {
                    ctx.userId =
                        findUserByDisplayName(
                            userStore.cachedUsers,
                            ctx.displayName,
                            userStore.cachedUserIdsByDisplayName
                        )?.id ?? '';
                }
                const userMap = {
                    displayName: ctx.displayName,
                    userId: ctx.userId,
                    joinTime: Date.parse(ctx.created_at),
                    lastAvatar: ''
                };
                locationStore.lastLocation.playerList.set(ctx.userId, userMap);
                if (friendStore.friends.has(ctx.userId)) {
                    locationStore.lastLocation.friendList.set(ctx.userId, userMap);
                }
            }
            if (ctx.type === 'OnPlayerLeft') {
                locationStore.lastLocation.playerList.delete(ctx.userId);
                locationStore.lastLocation.friendList.delete(ctx.userId);
            }
        }
        locationStore.lastLocation.playerList.forEach((ref1) => {
            if (ref1.userId && typeof ref1.userId === 'string') {
                if (!userStore.cachedUsers.has(ref1.userId)) {
                    userRequest.getUser({ userId: ref1.userId });
                }
                if (!userStore.cachedProfiles.has(ref1.userId)) {
                    userRequest.getPublicProfile({ userId: ref1.userId });
                }
            }
        });

        runUpdateCurrentUserLocationFlow();
        instanceStore.updateCurrentInstanceWorld();
        vrStore.updateVRLastLocation();
        instanceStore.getCurrentInstanceUserList();
        userStore.applyUserDialogLocation();
        instanceStore.applyWorldDialogInstances();
        instanceStore.applyGroupDialogInstances();
    }
}

/**
 * Core game log entry processor. Dispatches game log events to the
 * appropriate stores based on type.
 *
 * @param {object} gameLog
 * @param {string} location
 */
export async function addGameLogEntry(gameLog: object, location: string) {
    const gameLogStore = useGameLogStore();
    const locationStore = useLocationStore();
    const instanceStore = useInstanceStore();
    const userStore = useUserStore();
    const friendStore = useFriendStore();
    const vrStore = useVrStore();
    const gameStore = useGameStore();
    const vrcxStore = useVrcxStore();
    const advancedSettingsStore = useAdvancedSettingsStore();
    const generalSettingsStore = useGeneralSettingsStore();
    const galleryStore = useGalleryStore();
    const photonStore = usePhotonStore();
    const sharedFeedStore = useSharedFeedStore();
    const notificationStore = useNotificationStore();

    let entry: any = undefined;
    let persistedEntryPromise;
    if (advancedSettingsStore.gameLogDisabled) {
        return;
    }
    let userId = String((gameLog as any).userId || '');
    if (!userId && (gameLog as any).displayName) {
        userId =
    findUserByDisplayName(userStore.cachedUsers, (gameLog as any).displayName, userStore.cachedUserIdsByDisplayName)
        ?.id ?? '';
    }
    switch ((gameLog as any).type) {
        case 'location-destination':
            if (gameStore.isGameRunning) {
                gameLogStore.addGameLog({
    created_at: (gameLog as any).dt,
    type: 'LocationDestination',
    location: (gameLog as any).location
});
                await runLastLocationResetFlow((gameLog as any).dt);
                locationStore.setLastLocationLocation('traveling');
                locationStore.setLastLocationDestination((gameLog as any).location);
                locationStore.setLastLocationDestinationTime(Date.parse((gameLog as any).dt));
                gameLogStore.state.lastLocationAvatarList.clear();
                instanceStore.removeQueuedInstance((gameLog as any).location);
                runUpdateCurrentUserLocationFlow();
                gameLogStore.clearNowPlaying();
                gameLogStore.resetNowPlayingProducers();
                instanceStore.updateCurrentInstanceWorld();
                userStore.applyUserDialogLocation();
                instanceStore.applyWorldDialogInstances();
                instanceStore.applyGroupDialogInstances();
            }
            break;
        case 'location':
            instanceStore.addInstanceJoinHistory(locationStore.lastLocation.location, (gameLog as any).dt);
            const worldName = replaceBioSymbols((gameLog as any).worldName);
            if (gameStore.isGameRunning) {
                await runLastLocationResetFlow((gameLog as any).dt);
                gameLogStore.clearNowPlaying();
                gameLogStore.resetNowPlayingProducers();
                locationStore.setLastLocation({
    date: Date.parse((gameLog as any).dt),
    location: (gameLog as any).location,
    name: worldName,
    playerList: new Map(),
    friendList: new Map()
});
                instanceStore.removeQueuedInstance((gameLog as any).location);
                runUpdateCurrentUserLocationFlow();
                vrStore.updateVRLastLocation();
                instanceStore.updateCurrentInstanceWorld();
                userStore.applyUserDialogLocation();
                instanceStore.applyWorldDialogInstances();
                instanceStore.applyGroupDialogInstances();
            }
            instanceStore.addInstanceJoinHistory((gameLog as any).location, (gameLog as any).dt);
            const L = parseLocation((gameLog as any).location);
            entry = createLocationEntry((gameLog as any).dt, (gameLog as any).location, L.worldId, worldName);
            getGroupName((gameLog as any).location).then((groupName) => {
    entry.groupName = groupName;
});
            persistedEntryPromise = gameLogStore.addGamelogLocationToDatabase(entry);
            break;
        case 'player-joined':
            const joinTime = Date.parse((gameLog as any).dt);
            const userMap = {
    displayName: (gameLog as any).displayName,
    userId,
    joinTime,
    lastAvatar: ''
};
            locationStore.lastLocation.playerList.set(userId, userMap);
            const ref = userStore.cachedUsers.get(userId);
            if (!userId) {
                console.error('Missing userId:', (gameLog as any).displayName);
            } else if (userId === userStore.currentUser.id) {
                // skip
            } else if (friendStore.friends.has(userId) && typeof ref !== 'undefined') {
                locationStore.lastLocation.friendList.set(userId, userMap);
                friendStore.updateFriendLastSeen(userId, (gameLog as any).dt);
                if (
                    ref.location !== locationStore.lastLocation.location &&
                    ref.travelingToLocation !== locationStore.lastLocation.location
                ) {
                    ref.$location_at = joinTime;
                }
            } else if (typeof ref !== 'undefined') {
                ref.$location_at = joinTime;
            } else {
                if (AppDebug.debugGameLog || AppDebug.debugWebRequests) {
                    console.log('Fetching user from gameLog:', userId);
                }
                userRequest.getUser({ userId });
                userRequest.getPublicProfile({ userId });
            }
            vrStore.updateVRLastLocation();
            instanceStore.getCurrentInstanceUserList();
            entry = createJoinLeaveEntry('OnPlayerJoined', (gameLog as any).dt, (gameLog as any).displayName, location, userId);
            persistedEntryPromise = database.addGamelogJoinLeaveToDatabase(entry);
            break;
        case 'player-left':
            const ref1 = locationStore.lastLocation.playerList.get(userId);
            if (typeof ref1 === 'undefined') {
                break;
            }
            const time = dayjs((gameLog as any).dt).valueOf() - ref1.joinTime;
            locationStore.lastLocation.playerList.delete(userId);
            locationStore.lastLocation.friendList.delete(userId);
            friendStore.updateFriendLastSeen(userId, (gameLog as any).dt);
            gameLogStore.state.lastLocationAvatarList.delete((gameLog as any).displayName);
            photonStore.photonLobbyAvatars.delete(userId);
            vrStore.updateVRLastLocation();
            instanceStore.getCurrentInstanceUserList();
            entry = createJoinLeaveEntry('OnPlayerLeft', (gameLog as any).dt, (gameLog as any).displayName, location, userId, time);
            persistedEntryPromise = database.addGamelogJoinLeaveToDatabase(entry);
            break;
        case 'portal-spawn':
            if (vrcxStore.ipcEnabled && gameStore.isGameRunning) {
                break;
            }
            entry = createPortalSpawnEntry((gameLog as any).dt, location);
            persistedEntryPromise = database.addGamelogPortalSpawnToDatabase(entry);
            break;
        case 'nowplaying':
            await gameLogStore.handleNowPlayingEvent(gameLog, location);
            break;
        case 'video-play':
            if (gameLogStore.hasNowPlayingProducer()) {
                break;
            }
            (gameLog as any).videoUrl = decodeURI((gameLog as any).videoUrl);
            if (gameLogStore.lastVideoUrl === (gameLog as any).videoUrl) {
                break;
            }
            gameLogStore.setLastVideoUrl((gameLog as any).videoUrl);
            await gameLogStore.addGameLogVideo(gameLog, location, userId);
            break;
        case 'video-sync':
            const timestamp = (gameLog as any).timestamp.replace(/,/g, '');
            if (gameLogStore.nowPlaying.playing) {
                gameLogStore.nowPlaying.offset = parseInt(timestamp, 10);
            }
            break;
        case 'resource-load-string':
        case 'resource-load-image':
            if (!generalSettingsStore.logResourceLoad || gameLogStore.lastResourceloadUrl === (gameLog as any).resourceUrl) {
                break;
            }
            gameLogStore.setLastResourceloadUrl((gameLog as any).resourceUrl);
            entry = createResourceLoadEntry((gameLog as any).type, (gameLog as any).dt, (gameLog as any).resourceUrl, location);
            persistedEntryPromise = database.addGamelogResourceLoadToDatabase(entry);
            break;
        case 'screenshot':
            vrcxStore.processScreenshot((gameLog as any).screenshotPath);
            break;
        case 'api-request':
            logWebRequest('[GAMELOG API]', (gameLog as any).url);
            if (advancedSettingsStore.saveInstanceEmoji) {
                const inv = parseInventoryFromUrl((gameLog as any).url);
                if (inv) {
                    galleryStore.queueCheckInstanceInventory(inv.inventoryId, inv.userId);
                }
            }
            if (advancedSettingsStore.saveInstancePrints) {
                const printId = parsePrintFromUrl((gameLog as any).url);
                if (printId) {
                    galleryStore.queueSavePrintToFile(printId);
                }
            }
            break;
        case 'avatar-change':
            if (!gameStore.isGameRunning) {
                break;
            }
            let avatarName = gameLogStore.state.lastLocationAvatarList.get((gameLog as any).displayName);
            if (photonStore.photonLoggingEnabled || avatarName === (gameLog as any).avatarName) {
                break;
            }
            if (!avatarName) {
                avatarName = (gameLog as any).avatarName;
                gameLogStore.state.lastLocationAvatarList.set((gameLog as any).displayName, avatarName);
                break;
            }
            avatarName = (gameLog as any).avatarName;
            gameLogStore.state.lastLocationAvatarList.set((gameLog as any).displayName, avatarName);
            entry = {
    created_at: (gameLog as any).dt,
    type: 'AvatarChange',
    userId,
    name: avatarName,
    displayName: (gameLog as any).displayName
};
            break;
        case 'vrcx':
            const type = (gameLog as any).data.substr(0, (gameLog as any).data.indexOf(' '));
            if (type === 'VideoPlay(VRDancing)') {
                await gameLogStore.addGameLogVRDancing(gameLog, location);
            } else if (type === 'LSMedia') {
                await gameLogStore.addGameLogLSMedia(gameLog, location);
            } else if (type === 'VideoPlay(PopcornPalace)') {
                await gameLogStore.addGameLogPopcornPalace(gameLog, location);
            }
            break;
        case 'photon-id':
            if (!gameStore.isGameRunning || !watchState.isFriendsLoaded) {
                break;
            }
            const photonId = parseInt((gameLog as any).photonId, 10);
            const ref2 = photonStore.photonLobby.get(photonId);
            if (typeof ref2 === 'undefined') {
                const foundUser = findUserByDisplayName(userStore.cachedUsers, (gameLog as any).displayName, userStore.cachedUserIdsByDisplayName);
                if (foundUser) {
                    photonStore.photonLobby.set(photonId, foundUser);
                    photonStore.photonLobbyCurrent.set(photonId, foundUser);
                }
                const ctx1 = {
    displayName: (gameLog as any).displayName
};
                photonStore.photonLobby.set(photonId, ctx1);
                photonStore.photonLobbyCurrent.set(photonId, ctx1);
                instanceStore.getCurrentInstanceUserList();
            }
            break;
        case 'notification':
            break;
        case 'event':
            entry = {
    created_at: (gameLog as any).dt,
    type: 'Event',
    data: (gameLog as any).event
};
            persistedEntryPromise = database.addGamelogEventToDatabase(entry);
            if (gameStore.isGameRunning && (gameLog as any).event.startsWith('VideoError: ')) {
                checkYoutubeBotError((gameLog as any).event);
            }
            break;
        case 'vrc-quit':
            if (!gameStore.isGameRunning) {
                break;
            }
            if (advancedSettingsStore.vrcQuitFix) {
                const bias = Date.parse((gameLog as any).dt) + 3000;
                if (bias < Date.now()) {
                    console.log('QuitFix: Bias too low, not killing VRC');
                    break;
                }
                (AppApi as any).QuitGame().then((processCount: any) => {
    if (processCount > 1) {
        console.log('QuitFix: More than 1 process running, not killing VRC');
    }
    else if (processCount === 1) {
        console.log('QuitFix: Killed VRC');
    }
    else {
        console.log('QuitFix: Nothing to kill, no VRC process running');
    }
});
            }
            break;
        case 'openvr-init':
            gameStore.setIsGameNoVR(false);
            configRepository.setBool('isGameNoVR', gameStore.isGameNoVR);
            vrStore.updateOpenVR();
            break;
        case 'desktop-mode':
            gameStore.setIsGameNoVR(true);
            configRepository.setBool('isGameNoVR', gameStore.isGameNoVR);
            vrStore.updateOpenVR();
            break;
        case 'udon-exception':
            if (generalSettingsStore.udonExceptionLogging) {
                console.log('UdonException', (gameLog as any).data);
            }
            break;
        case 'sticker-spawn':
            if (!advancedSettingsStore.saveInstanceStickers) {
                break;
            }
            galleryStore.trySaveStickerToFile((gameLog as any).displayName, (gameLog as any).userId, (gameLog as any).inventoryId);
            break;
    }
    if (typeof entry !== 'undefined') {
        sharedFeedStore.addEntry(entry);
        notificationStore.queueGameLogNoty(entry);
        if (persistedEntryPromise) {
            const persistedEntry = await persistedEntryPromise;
            if (persistedEntry) {
                gameLogStore.addGameLog(persistedEntry);
            }
        } else {
            gameLogStore.addGameLog(entry);
        }
    }
}

let youtubeBotErrorPrompted = false;

/**
 * @param {string} videoError
 */
async function checkYoutubeBotError(videoError: string) {
    if (youtubeBotErrorPrompted || !videoError.includes('Sign in to confirm')) {
        return;
    }
    youtubeBotErrorPrompted = true;
    if (await configRepository.getBool('VRCX_hideYoutubeBotErrorPrompt', false)) {
        return;
    }
    const t = i18n.global.t;
    const { ok, checked }: any = await useModalStore().confirm({
        description: t('confirm.youtube_bot_error'),
        title: t('confirm.youtube_bot_error_title'),
        checkboxLabel: t('dialog.alertdialog.dont_show_again')
    });
    if (checked) {
        configRepository.setBool('VRCX_hideYoutubeBotErrorPrompt', true);
    }
    if (ok) {
        (AppApi as any).OpenSteamStorePage(4296960);
    }
}

/**
 * Parses raw game log JSON and delegates to addGameLogEntry.
 * Called from C# / updateLoop.
 *
 * @param {string} json
 */
export async function addGameLogEvent(json: string) {
    const locationStore = useLocationStore();

    const rawLogs = JSON.parse(json);
    const gameLog = gameLogService.parseRawGameLog(rawLogs[1], rawLogs[2], rawLogs.slice(3));
    if (
        AppDebug.debugGameLog &&
        gameLog.type !== 'photon-id' &&
        gameLog.type !== 'api-request' &&
        gameLog.type !== 'udon-exception'
    ) {
        console.log('gameLog:', gameLog);
    }
    await addGameLogEntry(gameLog, locationStore.lastLocation.location);
}

/**
 * Starts game log processing from the database tail.
 */
export async function getGameLogTable() {
    const dateTill = await database.getLastDateGameLogDatabase();
    await updateGameLog(dateTill);
}

/**
 * Fetches all game log entries since dateTill and processes them.
 *
 * @param {string} dateTill
 */
async function updateGameLog(dateTill: string) {
    await gameLogService.setDateTill(dateTill);
    await new Promise((resolve) => {
        workerTimers.setTimeout(resolve, 10000);
    });
    let location = '';
    for (const gameLog of await gameLogService.getAll()) {
        if (gameLog.type === 'location') {
            location = (gameLog as any).location;
        }
        await addGameLogEntry(gameLog, location);
    }
}

/**
 * Shows confirmation dialog before toggling the game log disabled setting.
 */
export async function disableGameLogDialog() {
    const gameStore = useGameStore();
    const advancedSettingsStore = useAdvancedSettingsStore();
    const modalStore = useModalStore();
    const t = i18n.global.t;

    if (gameStore.isGameRunning) {
        toast.error(t('message.gamelog.vrchat_must_be_closed'));
        return;
    }
    if (!advancedSettingsStore.gameLogDisabled) {
        modalStore
            .confirm({
                description: t('confirm.disable_gamelog'),
                title: t('confirm.title')
            })
            .then(({ ok }) => {
                if (!ok) return;
                advancedSettingsStore.setGameLogDisabled();
            })
            .catch(() => {});
    } else {
        advancedSettingsStore.setGameLogDisabled();
    }
}

import configRepository from '../services/config';
