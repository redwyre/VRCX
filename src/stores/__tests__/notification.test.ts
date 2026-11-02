import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia, Store } from 'pinia';

vi.mock('../../services/database', () => ({
    database: {
        getJoinCount: vi.fn(),
        addNotificationToDatabase: vi.fn(),
        addNotificationV2ToDatabase: vi.fn(),
        updateNotificationExpired: vi.fn(),
        seenNotificationV2: vi.fn()
    },
    dbVars: {
        maxTableSize: 1000
    }
}));

vi.mock('../../api', () => ({
    friendRequest: {},
    instanceRequest: {
        getInstance: vi.fn()
    },
    notificationRequest: {
        hideNotification: vi.fn(() => Promise.resolve({})),
        getNotifications: vi.fn(() => Promise.resolve({ json: [] })),
        getNotificationsV2: vi.fn(() => Promise.resolve({ json: [] })),
        getHiddenFriendRequests: vi.fn(() => Promise.resolve({ json: [] }))
    },
    queryRequest: {
        fetch: vi.fn()
    }
}));
vi.mock('@/plugins', () => ({
    i18n: {
        global: {
            t: vi.fn((key) => key)
        }
    },
    loadLocalizedStrings: vi.fn(() => Promise.resolve())
}));
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: vi.fn((key) => key),
        locale: ref('en')
    })
}));
vi.mock('../../services/config', () => ({
    default: {
        getBool: vi.fn((key, defaultValue) => {
            if (key === 'VRCX_autoDeclineFriendRequests') {
                return Promise.resolve(true);
            }
            return Promise.resolve(defaultValue);
        }),
        getInt: vi.fn((_key, defaultValue) => Promise.resolve(defaultValue)),
        getFloat: vi.fn((_key, defaultValue) => Promise.resolve(defaultValue)),
        getString: vi.fn((_key, defaultValue) => Promise.resolve(defaultValue)),

        setBool: vi.fn(),
        setInt: vi.fn(),
        setFloat: vi.fn(),
        setString: vi.fn(),

        remove: vi.fn(() => Promise.resolve())
    }
}));
vi.mock('../ui', () => ({
    useUiStore: () => ({
        notifyMenu: vi.fn(),
        removeNotify: vi.fn()
    })
}));
import { ComputedRef, Ref, ref } from 'vue';
vi.mock('vue-router', () => ({
    useRouter: () => ({
        currentRoute: ref({
            name: 'test'
        })
    })
}));
vi.mock('../../plugins/router', () => ({
    router: {
        currentRoute: ref({
            name: 'test'
        }),
        push: vi.fn(),
        replace: vi.fn()
    }
}));
vi.mock('../../shared/utils', async () => {
    const actual = await vi.importActual('../../shared/utils');

    return {
        ...(actual ?? {}),
        loadLocalizedStrings: vi.fn(() => Promise.resolve())
    };
});

const { database } = await import('../../services/database');
const { notificationRequest } = await import('../../api');

const { useNotificationStore } = await import('../notification');
const { useGeneralSettingsStore } = await import('../settings/general');

describe('notification store - auto decline friend requests', () => {
    let notificationStore: Store<"Notification", Pick<{ notificationInitStatus: Ref<boolean, boolean>; notificationTable: Ref<{ data: any[]; filters: any; pageSize: number; pageSizeLinked: boolean; paginationProps: { layout: string; }; }, { data: any[]; filters: any[]; pageSize: number; pageSizeLinked: boolean; paginationProps: { layout: string; }; } | { data: any[]; filters: any; pageSize: number; pageSizeLinked: boolean; paginationProps: { layout: string; }; }>; unseenNotifications: Ref<any[], any[]>; isNotificationsLoading: Ref<boolean, boolean>; inventoryBundleDialog: Ref<{ visible: boolean; bundles: any[]; }, { visible: boolean; bundles: any[]; } | { visible: boolean; bundles: any[]; }>; freeStoreItemDialog: Ref<{ visible: boolean; listings: any[]; }, { visible: boolean; listings: any[]; } | { visible: boolean; listings: any[]; }>; initNotifications: () => Promise<void>; expireNotification: (notificationId: string) => void; refreshNotifications: () => Promise<void>; checkInventoryBundles: () => Promise<void>; checkFreeStoreItems: () => Promise<void>; queueNotificationNoty: (noty: object) => void; playNoty: (noty: any) => void; queueGameLogNoty: (gamelog: any) => void; queueFeedNoty: (feed: any) => void; queueFriendLogNoty: (noty: any) => void; queueModerationNoty: (noty: any) => void; handleNotificationAccept: (args: any) => void; handleNotificationSee: (notificationId: any) => void; handlePipelineNotification: (args: any) => void; handleNotificationV2Update: (args: any) => void; handleNotificationHide: (notificationId: any) => void; handleNotificationV2Hide: (notificationId: any) => void; handleNotification: (args: any) => void; handleNotificationV2: (args: any) => void; testNotification: () => void; acceptFriendRequestNotification: (row: any) => void; hideNotification: (row: any) => Promise<void>; hideNotificationPrompt: (row: any) => void; acceptRequestInvite: (row: any) => void; sendNotificationResponse: (notificationId: any, responses: any, responseType: any) => void; deleteNotificationLog: (row: any) => void; deleteNotificationLogPrompt: (row: any) => void; isNotificationCenterOpen: Ref<boolean, boolean>; friendNotifications: ComputedRef<any[]>; groupNotifications: ComputedRef<any[]>; otherNotifications: ComputedRef<any[]>; unseenFriendNotifications: ComputedRef<any[]>; unseenGroupNotifications: ComputedRef<any[]>; unseenOtherNotifications: ComputedRef<any[]>; recentFriendNotifications: ComputedRef<any[]>; recentGroupNotifications: ComputedRef<any[]>; recentOtherNotifications: ComputedRef<any[]>; hasUnseenNotifications: ComputedRef<boolean>; getNotificationCategory: (type: string) => "other" | "friend" | "group"; isNotificationExpired: (notification: any) => any; openNotificationLink: (link: any) => void; queueMarkAsSeen: (notificationId: string, version?: number) => void; markAllAsSeen: () => void; appendNotificationTableEntry: (entry: object) => void; setNotificationInitStatus: (value: boolean) => void; clearUnseenNotifications: () => void; }, "notificationInitStatus" | "notificationTable" | "unseenNotifications" | "isNotificationsLoading" | "inventoryBundleDialog" | "freeStoreItemDialog" | "isNotificationCenterOpen">, Pick<{ notificationInitStatus: Ref<boolean, boolean>; notificationTable: Ref<{ data: any[]; filters: any; pageSize: number; pageSizeLinked: boolean; paginationProps: { layout: string; }; }, { data: any[]; filters: any[]; pageSize: number; pageSizeLinked: boolean; paginationProps: { layout: string; }; } | { data: any[]; filters: any; pageSize: number; pageSizeLinked: boolean; paginationProps: { layout: string; }; }>; unseenNotifications: Ref<any[], any[]>; isNotificationsLoading: Ref<boolean, boolean>; inventoryBundleDialog: Ref<{ visible: boolean; bundles: any[]; }, { visible: boolean; bundles: any[]; } | { visible: boolean; bundles: any[]; }>; freeStoreItemDialog: Ref<{ visible: boolean; listings: any[]; }, { visible: boolean; listings: any[]; } | { visible: boolean; listings: any[]; }>; initNotifications: () => Promise<void>; expireNotification: (notificationId: string) => void; refreshNotifications: () => Promise<void>; checkInventoryBundles: () => Promise<void>; checkFreeStoreItems: () => Promise<void>; queueNotificationNoty: (noty: object) => void; playNoty: (noty: any) => void; queueGameLogNoty: (gamelog: any) => void; queueFeedNoty: (feed: any) => void; queueFriendLogNoty: (noty: any) => void; queueModerationNoty: (noty: any) => void; handleNotificationAccept: (args: any) => void; handleNotificationSee: (notificationId: any) => void; handlePipelineNotification: (args: any) => void; handleNotificationV2Update: (args: any) => void; handleNotificationHide: (notificationId: any) => void; handleNotificationV2Hide: (notificationId: any) => void; handleNotification: (args: any) => void; handleNotificationV2: (args: any) => void; testNotification: () => void; acceptFriendRequestNotification: (row: any) => void; hideNotification: (row: any) => Promise<void>; hideNotificationPrompt: (row: any) => void; acceptRequestInvite: (row: any) => void; sendNotificationResponse: (notificationId: any, responses: any, responseType: any) => void; deleteNotificationLog: (row: any) => void; deleteNotificationLogPrompt: (row: any) => void; isNotificationCenterOpen: Ref<boolean, boolean>; friendNotifications: ComputedRef<any[]>; groupNotifications: ComputedRef<any[]>; otherNotifications: ComputedRef<any[]>; unseenFriendNotifications: ComputedRef<any[]>; unseenGroupNotifications: ComputedRef<any[]>; unseenOtherNotifications: ComputedRef<any[]>; recentFriendNotifications: ComputedRef<any[]>; recentGroupNotifications: ComputedRef<any[]>; recentOtherNotifications: ComputedRef<any[]>; hasUnseenNotifications: ComputedRef<boolean>; getNotificationCategory: (type: string) => "other" | "friend" | "group"; isNotificationExpired: (notification: any) => any; openNotificationLink: (link: any) => void; queueMarkAsSeen: (notificationId: string, version?: number) => void; markAllAsSeen: () => void; appendNotificationTableEntry: (entry: object) => void; setNotificationInitStatus: (value: boolean) => void; clearUnseenNotifications: () => void; }, "friendNotifications" | "groupNotifications" | "otherNotifications" | "unseenFriendNotifications" | "unseenGroupNotifications" | "unseenOtherNotifications" | "recentFriendNotifications" | "recentGroupNotifications" | "recentOtherNotifications" | "hasUnseenNotifications">, Pick<{ notificationInitStatus: Ref<boolean, boolean>; notificationTable: Ref<{ data: any[]; filters: any; pageSize: number; pageSizeLinked: boolean; paginationProps: { layout: string; }; }, { data: any[]; filters: any[]; pageSize: number; pageSizeLinked: boolean; paginationProps: { layout: string; }; } | { data: any[]; filters: any; pageSize: number; pageSizeLinked: boolean; paginationProps: { layout: string; }; }>; unseenNotifications: Ref<any[], any[]>; isNotificationsLoading: Ref<boolean, boolean>; inventoryBundleDialog: Ref<{ visible: boolean; bundles: any[]; }, { visible: boolean; bundles: any[]; } | { visible: boolean; bundles: any[]; }>; freeStoreItemDialog: Ref<{ visible: boolean; listings: any[]; }, { visible: boolean; listings: any[]; } | { visible: boolean; listings: any[]; }>; initNotifications: () => Promise<void>; expireNotification: (notificationId: string) => void; refreshNotifications: () => Promise<void>; checkInventoryBundles: () => Promise<void>; checkFreeStoreItems: () => Promise<void>; queueNotificationNoty: (noty: object) => void; playNoty: (noty: any) => void; queueGameLogNoty: (gamelog: any) => void; queueFeedNoty: (feed: any) => void; queueFriendLogNoty: (noty: any) => void; queueModerationNoty: (noty: any) => void; handleNotificationAccept: (args: any) => void; handleNotificationSee: (notificationId: any) => void; handlePipelineNotification: (args: any) => void; handleNotificationV2Update: (args: any) => void; handleNotificationHide: (notificationId: any) => void; handleNotificationV2Hide: (notificationId: any) => void; handleNotification: (args: any) => void; handleNotificationV2: (args: any) => void; testNotification: () => void; acceptFriendRequestNotification: (row: any) => void; hideNotification: (row: any) => Promise<void>; hideNotificationPrompt: (row: any) => void; acceptRequestInvite: (row: any) => void; sendNotificationResponse: (notificationId: any, responses: any, responseType: any) => void; deleteNotificationLog: (row: any) => void; deleteNotificationLogPrompt: (row: any) => void; isNotificationCenterOpen: Ref<boolean, boolean>; friendNotifications: ComputedRef<any[]>; groupNotifications: ComputedRef<any[]>; otherNotifications: ComputedRef<any[]>; unseenFriendNotifications: ComputedRef<any[]>; unseenGroupNotifications: ComputedRef<any[]>; unseenOtherNotifications: ComputedRef<any[]>; recentFriendNotifications: ComputedRef<any[]>; recentGroupNotifications: ComputedRef<any[]>; recentOtherNotifications: ComputedRef<any[]>; hasUnseenNotifications: ComputedRef<boolean>; getNotificationCategory: (type: string) => "other" | "friend" | "group"; isNotificationExpired: (notification: any) => any; openNotificationLink: (link: any) => void; queueMarkAsSeen: (notificationId: string, version?: number) => void; markAllAsSeen: () => void; appendNotificationTableEntry: (entry: object) => void; setNotificationInitStatus: (value: boolean) => void; clearUnseenNotifications: () => void; }, "initNotifications" | "expireNotification" | "refreshNotifications" | "checkInventoryBundles" | "checkFreeStoreItems" | "queueNotificationNoty" | "playNoty" | "queueGameLogNoty" | "queueFeedNoty" | "queueFriendLogNoty" | "queueModerationNoty" | "handleNotificationAccept" | "handleNotificationSee" | "handlePipelineNotification" | "handleNotificationV2Update" | "handleNotificationHide" | "handleNotificationV2Hide" | "handleNotification" | "handleNotificationV2" | "testNotification" | "acceptFriendRequestNotification" | "hideNotification" | "hideNotificationPrompt" | "acceptRequestInvite" | "sendNotificationResponse" | "deleteNotificationLog" | "deleteNotificationLogPrompt" | "getNotificationCategory" | "isNotificationExpired" | "openNotificationLink" | "queueMarkAsSeen" | "markAllAsSeen" | "appendNotificationTableEntry" | "setNotificationInitStatus" | "clearUnseenNotifications">>;
    let generalSettingsStore: Store<"GeneralSettings", Pick<{ isStartAtWindowsStartup: Ref<boolean, boolean>; isStartAsMinimizedState: Ref<boolean, boolean>; isCloseToTray: Ref<boolean, boolean>; disableGpuAcceleration: Ref<boolean, boolean>; disableVrOverlayGpuAcceleration: Ref<boolean, boolean>; localFavoriteFriendsGroups: Ref<any[], any[]>; udonExceptionLogging: Ref<boolean, boolean>; logResourceLoad: Ref<boolean, boolean>; autoLoginDelayEnabled: Ref<boolean, boolean>; autoLoginDelaySeconds: Ref<number, number>; autoStateChangeEnabled: Ref<boolean, boolean>; autoStateChangeAloneStatus: Ref<string, string>; autoStateChangeCompanyStatus: Ref<string, string>; autoStateChangeInstanceTypes: Ref<any[], any[]>; autoStateChangeNoFriends: Ref<boolean, boolean>; autoStateChangeAloneDescEnabled: Ref<boolean, boolean>; autoStateChangeAloneDesc: Ref<string, string>; autoStateChangeCompanyDescEnabled: Ref<boolean, boolean>; autoStateChangeCompanyDesc: Ref<string, string>; autoStateChangeGroups: Ref<any[], any[]>; autoAcceptInviteRequests: Ref<string, string>; autoAcceptInviteGroups: Ref<any[], any[]>; autoAcceptInviteStatuses: Ref<any[], any[]>; recentActionCooldownEnabled: Ref<boolean, boolean>; recentActionCooldownMinutes: Ref<number, number>; autoDeclineFriendRequests: Ref<boolean, boolean>; setIsStartAtWindowsStartup: () => void; setIsStartAsMinimizedState: () => void; setIsCloseToTray: () => void; setDisableGpuAcceleration: () => void; setDisableVrOverlayGpuAcceleration: () => void; setLocalFavoriteFriendsGroups: (value: string[]) => void; setUdonExceptionLogging: () => void; setLogResourceLoad: () => void; setAutoLoginDelayEnabled: () => void; promptAutoLoginDelaySeconds: () => void; setAutoStateChangeEnabled: () => void; setAutoStateChangeAloneStatus: (value: string) => void; setAutoStateChangeCompanyStatus: (value: string) => void; setAutoStateChangeInstanceTypes: (value: any) => void; setAutoStateChangeNoFriends: () => void; setAutoStateChangeAloneDescEnabled: () => void; setAutoStateChangeAloneDesc: (value: string) => void; setAutoStateChangeCompanyDescEnabled: () => void; setAutoStateChangeCompanyDesc: (value: string) => void; setAutoStateChangeGroups: (value: Array<any>) => void; setAutoAcceptInviteRequests: (value: string) => void; setAutoAcceptInviteGroups: (value: string[]) => void; setAutoAcceptInviteStatuses: (value: string[]) => void; promptProxySettings: () => void; setRecentActionCooldownEnabled: () => void; setRecentActionCooldownMinutes: (value: any) => void; setAutoDeclineFriendRequests: () => void; }, "isStartAtWindowsStartup" | "isStartAsMinimizedState" | "isCloseToTray" | "disableGpuAcceleration" | "disableVrOverlayGpuAcceleration" | "localFavoriteFriendsGroups" | "udonExceptionLogging" | "logResourceLoad" | "autoLoginDelayEnabled" | "autoLoginDelaySeconds" | "autoStateChangeEnabled" | "autoStateChangeAloneStatus" | "autoStateChangeCompanyStatus" | "autoStateChangeInstanceTypes" | "autoStateChangeNoFriends" | "autoStateChangeAloneDescEnabled" | "autoStateChangeAloneDesc" | "autoStateChangeCompanyDescEnabled" | "autoStateChangeCompanyDesc" | "autoStateChangeGroups" | "autoAcceptInviteRequests" | "autoAcceptInviteGroups" | "autoAcceptInviteStatuses" | "recentActionCooldownEnabled" | "recentActionCooldownMinutes" | "autoDeclineFriendRequests">, Pick<{ isStartAtWindowsStartup: Ref<boolean, boolean>; isStartAsMinimizedState: Ref<boolean, boolean>; isCloseToTray: Ref<boolean, boolean>; disableGpuAcceleration: Ref<boolean, boolean>; disableVrOverlayGpuAcceleration: Ref<boolean, boolean>; localFavoriteFriendsGroups: Ref<any[], any[]>; udonExceptionLogging: Ref<boolean, boolean>; logResourceLoad: Ref<boolean, boolean>; autoLoginDelayEnabled: Ref<boolean, boolean>; autoLoginDelaySeconds: Ref<number, number>; autoStateChangeEnabled: Ref<boolean, boolean>; autoStateChangeAloneStatus: Ref<string, string>; autoStateChangeCompanyStatus: Ref<string, string>; autoStateChangeInstanceTypes: Ref<any[], any[]>; autoStateChangeNoFriends: Ref<boolean, boolean>; autoStateChangeAloneDescEnabled: Ref<boolean, boolean>; autoStateChangeAloneDesc: Ref<string, string>; autoStateChangeCompanyDescEnabled: Ref<boolean, boolean>; autoStateChangeCompanyDesc: Ref<string, string>; autoStateChangeGroups: Ref<any[], any[]>; autoAcceptInviteRequests: Ref<string, string>; autoAcceptInviteGroups: Ref<any[], any[]>; autoAcceptInviteStatuses: Ref<any[], any[]>; recentActionCooldownEnabled: Ref<boolean, boolean>; recentActionCooldownMinutes: Ref<number, number>; autoDeclineFriendRequests: Ref<boolean, boolean>; setIsStartAtWindowsStartup: () => void; setIsStartAsMinimizedState: () => void; setIsCloseToTray: () => void; setDisableGpuAcceleration: () => void; setDisableVrOverlayGpuAcceleration: () => void; setLocalFavoriteFriendsGroups: (value: string[]) => void; setUdonExceptionLogging: () => void; setLogResourceLoad: () => void; setAutoLoginDelayEnabled: () => void; promptAutoLoginDelaySeconds: () => void; setAutoStateChangeEnabled: () => void; setAutoStateChangeAloneStatus: (value: string) => void; setAutoStateChangeCompanyStatus: (value: string) => void; setAutoStateChangeInstanceTypes: (value: any) => void; setAutoStateChangeNoFriends: () => void; setAutoStateChangeAloneDescEnabled: () => void; setAutoStateChangeAloneDesc: (value: string) => void; setAutoStateChangeCompanyDescEnabled: () => void; setAutoStateChangeCompanyDesc: (value: string) => void; setAutoStateChangeGroups: (value: Array<any>) => void; setAutoAcceptInviteRequests: (value: string) => void; setAutoAcceptInviteGroups: (value: string[]) => void; setAutoAcceptInviteStatuses: (value: string[]) => void; promptProxySettings: () => void; setRecentActionCooldownEnabled: () => void; setRecentActionCooldownMinutes: (value: any) => void; setAutoDeclineFriendRequests: () => void; }, never>, Pick<{ isStartAtWindowsStartup: Ref<boolean, boolean>; isStartAsMinimizedState: Ref<boolean, boolean>; isCloseToTray: Ref<boolean, boolean>; disableGpuAcceleration: Ref<boolean, boolean>; disableVrOverlayGpuAcceleration: Ref<boolean, boolean>; localFavoriteFriendsGroups: Ref<any[], any[]>; udonExceptionLogging: Ref<boolean, boolean>; logResourceLoad: Ref<boolean, boolean>; autoLoginDelayEnabled: Ref<boolean, boolean>; autoLoginDelaySeconds: Ref<number, number>; autoStateChangeEnabled: Ref<boolean, boolean>; autoStateChangeAloneStatus: Ref<string, string>; autoStateChangeCompanyStatus: Ref<string, string>; autoStateChangeInstanceTypes: Ref<any[], any[]>; autoStateChangeNoFriends: Ref<boolean, boolean>; autoStateChangeAloneDescEnabled: Ref<boolean, boolean>; autoStateChangeAloneDesc: Ref<string, string>; autoStateChangeCompanyDescEnabled: Ref<boolean, boolean>; autoStateChangeCompanyDesc: Ref<string, string>; autoStateChangeGroups: Ref<any[], any[]>; autoAcceptInviteRequests: Ref<string, string>; autoAcceptInviteGroups: Ref<any[], any[]>; autoAcceptInviteStatuses: Ref<any[], any[]>; recentActionCooldownEnabled: Ref<boolean, boolean>; recentActionCooldownMinutes: Ref<number, number>; autoDeclineFriendRequests: Ref<boolean, boolean>; setIsStartAtWindowsStartup: () => void; setIsStartAsMinimizedState: () => void; setIsCloseToTray: () => void; setDisableGpuAcceleration: () => void; setDisableVrOverlayGpuAcceleration: () => void; setLocalFavoriteFriendsGroups: (value: string[]) => void; setUdonExceptionLogging: () => void; setLogResourceLoad: () => void; setAutoLoginDelayEnabled: () => void; promptAutoLoginDelaySeconds: () => void; setAutoStateChangeEnabled: () => void; setAutoStateChangeAloneStatus: (value: string) => void; setAutoStateChangeCompanyStatus: (value: string) => void; setAutoStateChangeInstanceTypes: (value: any) => void; setAutoStateChangeNoFriends: () => void; setAutoStateChangeAloneDescEnabled: () => void; setAutoStateChangeAloneDesc: (value: string) => void; setAutoStateChangeCompanyDescEnabled: () => void; setAutoStateChangeCompanyDesc: (value: string) => void; setAutoStateChangeGroups: (value: Array<any>) => void; setAutoAcceptInviteRequests: (value: string) => void; setAutoAcceptInviteGroups: (value: string[]) => void; setAutoAcceptInviteStatuses: (value: string[]) => void; promptProxySettings: () => void; setRecentActionCooldownEnabled: () => void; setRecentActionCooldownMinutes: (value: any) => void; setAutoDeclineFriendRequests: () => void; }, "setIsStartAtWindowsStartup" | "setIsStartAsMinimizedState" | "setIsCloseToTray" | "setDisableGpuAcceleration" | "setDisableVrOverlayGpuAcceleration" | "setLocalFavoriteFriendsGroups" | "setUdonExceptionLogging" | "setLogResourceLoad" | "setAutoLoginDelayEnabled" | "promptAutoLoginDelaySeconds" | "setAutoStateChangeEnabled" | "setAutoStateChangeAloneStatus" | "setAutoStateChangeCompanyStatus" | "setAutoStateChangeInstanceTypes" | "setAutoStateChangeNoFriends" | "setAutoStateChangeAloneDescEnabled" | "setAutoStateChangeAloneDesc" | "setAutoStateChangeCompanyDescEnabled" | "setAutoStateChangeCompanyDesc" | "setAutoStateChangeGroups" | "setAutoAcceptInviteRequests" | "setAutoAcceptInviteGroups" | "setAutoAcceptInviteStatuses" | "promptProxySettings" | "setRecentActionCooldownEnabled" | "setRecentActionCooldownMinutes" | "setAutoDeclineFriendRequests">>;

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        notificationStore = useNotificationStore();
        generalSettingsStore = useGeneralSettingsStore();

        generalSettingsStore.autoDeclineFriendRequests = true;
    });

    it('declines a friend request when join count is 0', async () => {
        vi.mocked(database.getJoinCount).mockResolvedValue({
            joinCount: '0',
            userId: 'usr_test'
        });

        const ref = {
            id: 'not_test',
            type: 'friendRequest',
            senderUserId: 'usr_test',
            senderUsername: 'TestUser'
        };

        // handleNotification normally runs before handlePipelineNotification,
        // so put the notification in the local table first.
        notificationStore.notificationTable.data.push(ref);

        notificationStore.handlePipelineNotification({
            json: ref,
            params: {
                notificationId: ref.id
            }
        });

        await vi.waitFor(() => {
            expect(database.getJoinCount).toHaveBeenCalledWith({
                id: 'usr_test',
                displayName: 'TestUser'
            });
        });

        await vi.waitFor(() => {
            expect(notificationRequest.hideNotification).toHaveBeenCalledWith({
                notificationId: 'not_test'
            });
        });

        await vi.waitFor(() => {
            expect(notificationStore.notificationTable.data).not.toContain(ref);
        });
    });

    it('does not decline when join count is greater than 0', async () => {
        vi.mocked(database.getJoinCount).mockResolvedValue({
            joinCount: '2',
            userId: 'usr_test'
        });

        const ref = {
            id: 'not_test',
            type: 'friendRequest',
            senderUserId: 'usr_test',
            senderUsername: 'TestUser'
        };

        notificationStore.notificationTable.data.push(ref);

        notificationStore.handlePipelineNotification({
            json: ref,
            params: {
                notificationId: ref.id
            }
        });

        await vi.waitFor(() => {
            expect(database.getJoinCount).toHaveBeenCalled();
        });

        expect(notificationRequest.hideNotification).not.toHaveBeenCalled();
        expect(notificationStore.notificationTable.data.some((n: { id: string; }) => n.id === 'not_test')).toBe(true);
    });

    it('does nothing when auto decline is disabled', async () => {
        generalSettingsStore.autoDeclineFriendRequests = false;

        const ref = {
            id: 'not_test',
            type: 'friendRequest',
            senderUserId: 'usr_test',
            senderUsername: 'TestUser'
        };

        notificationStore.handlePipelineNotification({
            json: ref,
            params: {
                notificationId: ref.id
            }
        });

        await Promise.resolve();

        expect(database.getJoinCount).not.toHaveBeenCalled();
        expect(notificationRequest.hideNotification).not.toHaveBeenCalled();
    });

    it('does not run auto decline logic for other notification types', async () => {
        const ref = {
            id: 'not_test',
            type: 'invite',
            senderUserId: 'usr_test',
            senderUsername: 'TestUser'
        };

        notificationStore.handlePipelineNotification({
            json: ref,
            params: {
                notificationId: ref.id
            }
        });

        await Promise.resolve();

        expect(database.getJoinCount).not.toHaveBeenCalled();
        expect(notificationRequest.hideNotification).not.toHaveBeenCalled();
    });
});
