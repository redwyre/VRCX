import { createPinia } from 'pinia';

import { getSentry, isSentryOptedIn } from '../plugins';
import { useAdvancedSettingsStore } from './settings/advanced';
import { useActivityStore } from './activity';
import { useAppearanceSettingsStore } from './settings/appearance';
import { useAuthStore } from './auth';
import { useAvatarProviderStore } from './avatarProvider';
import { useAvatarStore } from './avatar';
import { useChartsStore } from './charts';
import { useDashboardStore } from './dashboard';
import { useExternalLinkStore } from './externalLink';
import { useDiscordPresenceSettingsStore } from './settings/discordPresence';
import { useFavoriteStore } from './favorite';
import { useFeedStore } from './feed';
import { useFriendStore } from './friend';
import { useGalleryStore } from './gallery';
import { useGameLogStore } from './gameLog';
import { useGameStore } from './game';
import { useGeneralSettingsStore } from './settings/general';
import { useQuickSearchStore } from './quickSearch';
import { useGroupStore } from './group';
import { useInstanceStore } from './instance';
import { useInviteStore } from './invite';
import { useLaunchStore } from './launch';
import { useLocationStore } from './location';
import { useModalStore } from './modal';
import { useModerationStore } from './moderation';
import { useNotificationStore } from './notification';
import { useNotificationsSettingsStore } from './settings/notifications';
import { usePhotonStore } from './photon';
import { useSearchStore } from './search';
import { useSharedFeedStore } from './sharedFeed';
import { useUiStore } from './ui';
import { useToolsStore } from './tools';
import { useUpdateLoopStore } from './updateLoop';
import { useUserStore } from './user';
import { useVRCXUpdaterStore } from './vrcxUpdater';
import { useVrStore } from './vr';
import { useVrcStatusStore } from './vrcStatus';
import { useVrcxStore } from './vrcx';
import { useWorldStore } from './world';
import { useWristOverlaySettingsStore } from './settings/wristOverlay';
import type * as SentryVue from '@sentry/vue';

export const pinia = createPinia();

async function registerSentryPiniaPlugin() {
    if (!NIGHTLY) return;
    if (!(await isSentryOptedIn())) return;

    const Sentry = (await getSentry()) as typeof SentryVue | null;
    if (!Sentry) return;

    pinia.use(
        Sentry.createSentryPiniaPlugin({
            stateTransformer: (state) => ({
                ...state,
                Auth: null,
                Feed: null,
                Favorite: null,
                Friend: null,
                User: {
                    ...(state.User as Record<string, any>),
                    currentUser: null,
                    subsetOfLanguages: null
                },
                GameLog: {
                    ...(state.GameLog as Record<string, any>),
                    gameLogTable: null
                },
                Notification: {
                    ...(state.Notification as Record<string, any>),
                    notificationTable: null
                },
                Moderation: {
                    ...(state.Moderation as Record<string, any>),
                    playerModerationTable: null,
                    cachedPlayerModerations: null,
                    cachedPlayerModerationsUserIds: null
                },
                Photon: null,
                SharedFeed: {
                    ...(state.SharedFeed as Record<string, any>),
                    sharedFeedData: null
                },
                Group: {
                    ...(state.Group as Record<string, any>),
                    groupInstances: null,
                    inGameGroupOrder: null
                },
                Avatar: {
                    ...(state.Avatar as Record<string, any>),
                    avatarHistory: null
                },
                Gallery: {
                    ...(state.Gallery as Record<string, any>),
                    emojiTable: null,
                    galleryTable: null,
                    instanceStickersCache: null,
                    inventoryTable: null,
                    printTable: null,
                    stickerTable: null,
                    VRCPlusIconsTable: null
                }
            })
        })
    );
}

export async function initPiniaPlugins() {
    await registerSentryPiniaPlugin();
}

export function createGlobalStores() {
    return {
        advancedSettings: useAdvancedSettingsStore(),
        activity: useActivityStore(),
        appearanceSettings: useAppearanceSettingsStore(),
        discordPresenceSettings: useDiscordPresenceSettingsStore(),
        generalSettings: useGeneralSettingsStore(),
        notificationsSettings: useNotificationsSettingsStore(),
        wristOverlaySettings: useWristOverlaySettingsStore(),
        avatarProvider: useAvatarProviderStore(),
        externalLink: useExternalLinkStore(),
        favorite: useFavoriteStore(),
        friend: useFriendStore(),
        photon: usePhotonStore(),
        user: useUserStore(),
        vrcxUpdater: useVRCXUpdaterStore(),
        avatar: useAvatarStore(),
        world: useWorldStore(),
        group: useGroupStore(),
        location: useLocationStore(),
        instance: useInstanceStore(),
        moderation: useModerationStore(),
        invite: useInviteStore(),
        gallery: useGalleryStore(),
        notification: useNotificationStore(),
        feed: useFeedStore(),
        ui: useUiStore(),
        tools: useToolsStore(),
        gameLog: useGameLogStore(),
        search: useSearchStore(),
        game: useGameStore(),
        launch: useLaunchStore(),
        vr: useVrStore(),
        vrcx: useVrcxStore(),
        sharedFeed: useSharedFeedStore(),
        updateLoop: useUpdateLoopStore(),
        auth: useAuthStore(),
        vrcStatus: useVrcStatusStore(),
        charts: useChartsStore(),
        dashboard: useDashboardStore(),
        modal: useModalStore(),
        quickSearch: useQuickSearchStore()
    };
}

export {
    useAuthStore,
    useAvatarStore,
    useAvatarProviderStore,
    useExternalLinkStore,
    useFavoriteStore,
    useFeedStore,
    useFriendStore,
    useGalleryStore,
    useGameStore,
    useGameLogStore,
    useGroupStore,
    useInstanceStore,
    useInviteStore,
    useLaunchStore,
    useLocationStore,
    useModerationStore,
    useNotificationStore,
    usePhotonStore,
    useSearchStore,
    useChartsStore,
    useDashboardStore,
    useAdvancedSettingsStore,
    useActivityStore,
    useAppearanceSettingsStore,
    useDiscordPresenceSettingsStore,
    useGeneralSettingsStore,
    useNotificationsSettingsStore,
    useWristOverlaySettingsStore,
    useToolsStore,
    useUiStore,
    useUserStore,
    useVrStore,
    useVrcxStore,
    useVRCXUpdaterStore,
    useWorldStore,
    useSharedFeedStore,
    useUpdateLoopStore,
    useVrcStatusStore,
    useModalStore,
    useQuickSearchStore
};
