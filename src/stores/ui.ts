import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { toast } from 'vue-sonner';
import { useMagicKeys } from '@vueuse/core';
import { useRouter, RouteRecordNameGeneric } from 'vue-router';

import { AppDebug } from '../services/appConfig';
import { refreshCustomCss } from '../shared/utils/base/ui';
import { updateLocalizedStrings } from '../plugins/i18n';
import { useAppearanceSettingsStore } from './settings/appearance';
import { useAvatarStore } from './avatar';
import { useGroupStore } from './group';
import {
    clearGroupMemberModerationDialog,
    showGroupDialog,
    showGroupMemberModerationDialog,
    showGroupRolesDialog
} from '../coordinators/groupCoordinator';
import { showWorldDialog } from '../coordinators/worldCoordinator';
import { showAvatarDialog } from '../coordinators/avatarCoordinator';
import { showUserDialog } from '../coordinators/userCoordinator';
import { useInstanceStore } from './instance';
import { useNotificationStore } from './notification';
import { useSearchStore } from './search';
import { useUserStore } from './user';
import { useWorldStore } from './world';

export const useUiStore = defineStore('Ui', () => {
    const notificationStore = useNotificationStore();
    const instanceStore = useInstanceStore();
    const router = useRouter();
    const keys = useMagicKeys();
    const { directAccessPaste } = useSearchStore();
    const appearanceSettings = useAppearanceSettingsStore();

    const ctrlR = keys['Ctrl+R'];
    const ctrlD = keys['Ctrl+D'];
    const metaD = keys['Meta+D'];
    const shift = keys['Shift'];
    const ctrlShiftI = keys['Ctrl+Shift+I'];
    const altShiftR = keys['Alt+Shift+R'];

    const notifiedMenus = ref([]);
    const shiftHeld = ref(false);
    const trayIconNotify = ref(false);
    const dialogCrumbs = ref([]);

    watch(ctrlR, (isPressed) => {
        if (isPressed) {
            location.reload();
        }
    });

    watch(ctrlD, (isPressed) => {
        if (isPressed) {
            directAccessPaste();
        }
    });

    watch(metaD, (isPressed) => {
        if (isPressed) {
            directAccessPaste();
        }
    });

    watch(shift, (isHeld) => {
        shiftHeld.value = isHeld;
    });

    watch(ctrlShiftI, (isPressed) => {
        if (isPressed) {
            showConsole();
        }
    });

    watch(altShiftR, (isPressed) => {
        if (isPressed) {
            refreshCustomCss();
            updateLocalizedStrings();
            toast.success('Custom CSS and localization strings refreshed');
        }
    });

    function pushDialogCrumb(data: { label?: any; id: any; type?: any }) {
        const { type, id, label } = data;
        if (!type || !id) {
            return;
        }
        const items = dialogCrumbs.value;
        const last = items[items.length - 1];
        if (last && (last as any).type === type && (last as any).id === id) {
            if (label && (last as any).label !== label) {
                (last as any).label = label;
            }
            return;
        }
        const existingIndex = items.findIndex((item) => (item as any).type === type && (item as any).id === id);
        if (existingIndex !== -1) {
            items.splice(existingIndex + 1);
            if (label) {
                (items[existingIndex] as any).label = label;
            }
            return;
        }
        if (!data.label) {
            data.label = data.id;
        }

        items.push(data);
    }

    function setDialogCrumbLabel(type: any, id: any, label: any) {
        if (!type || !id || !label) {
            return;
        }
        const item = dialogCrumbs.value.find((entry) => (entry as any).type === type && (entry as any).id === id);
        if (item) {
            (item as any).label = label;
        }
    }

    function jumpDialogCrumb(index: number) {
        if (index < 0 || index >= dialogCrumbs.value.length) {
            return;
        }
        dialogCrumbs.value.splice(index + 1);
    }

    function jumpBackDialogCrumb() {
        if (dialogCrumbs.value.length > 0) {
            dialogCrumbs.value.pop();
        }
        if (dialogCrumbs.value.length === 0) {
            closeMainDialog();
            return;
        }
        handleBreadcrumbClick(dialogCrumbs.value.length - 1);
    }

    function handleBreadcrumbClick(index: number) {
        const item = dialogCrumbs.value[index];
        if (!item) {
            return;
        }
        jumpDialogCrumb(index);
        if ((item as any).type === 'user') {
            showUserDialog((item as any).id);
            return;
        }
        if ((item as any).type === 'world') {
            showWorldDialog((item as any).tag, (item as any).shortName);
            return;
        }
        if ((item as any).type === 'avatar') {
            showAvatarDialog((item as any).id);
            return;
        }
        if ((item as any).type === 'group') {
            showGroupDialog((item as any).id);
            return;
        }
        if ((item as any).type === 'previous-instances-user') {
            instanceStore.showPreviousInstancesListDialog('user', (item as any).id);
            return;
        }
        if ((item as any).type === 'previous-instances-world') {
            instanceStore.showPreviousInstancesListDialog('world', (item as any).id);
            return;
        }
        if ((item as any).type === 'previous-instances-group') {
            instanceStore.showPreviousInstancesListDialog('group', (item as any).id);
            return;
        }
        if ((item as any).type === 'previous-instances-info') {
            instanceStore.showPreviousInstancesInfoDialog((item as any).id);
            return;
        }
        if ((item as any).type === 'group-member-moderation') {
            showGroupMemberModerationDialog((item as any).id);
            return;
        }
        if ((item as any).type === 'group-roles') {
            showGroupRolesDialog((item as any).id);
            return;
        }
        console.error(`Unknown dialog crumb type: ${(item as any).type}, closing dialog`);
        closeMainDialog();
    }

    function clearDialogCrumbs() {
        dialogCrumbs.value = [];
    }

    function closeMainDialog() {
        const userStore = useUserStore();
        const worldStore = useWorldStore();
        const avatarStore = useAvatarStore();
        const groupStore = useGroupStore();
        const instanceStore = useInstanceStore();

        userStore.setUserDialogVisible(false);
        worldStore.setWorldDialogVisible(false);
        avatarStore.setAvatarDialogVisible(false);
        groupStore.setGroupDialogVisible(false);
        groupStore.setGroupMemberModerationVisible(false);
        clearGroupMemberModerationDialog();
        groupStore.setGroupRolesDialogVisible(false);
        instanceStore.hidePreviousInstancesDialogs();
        clearDialogCrumbs();
    }

    /**
     * @param {object} data
     * @param {string} data.type
     * @param {string} data.id
     * @param {string} [data.tag]
     * @param {string} [data.shortName]
     * @param {string} [data.label]
     * @returns {boolean}
     */
    function openDialog(data: { type: string; id: string; tag?: string; shortName?: string; label?: string }) {
        const { type } = data;
        const userStore = useUserStore();
        const worldStore = useWorldStore();
        const avatarStore = useAvatarStore();
        const groupStore = useGroupStore();
        const instanceStore = useInstanceStore();
        const isPrevInfo = type === 'previous-instances-info';
        const isPrevList = type && type.startsWith('previous-instances-') && type !== 'previous-instances-info';
        const hadActiveDialog =
            dialogCrumbs.value.length > 0 ||
            userStore.userDialog.visible ||
            worldStore.worldDialog.visible ||
            avatarStore.avatarDialog.visible ||
            groupStore.groupDialog.visible ||
            groupStore.groupMemberModeration.visible ||
            groupStore.groupRolesDialog.visible ||
            (instanceStore.previousInstancesInfoDialog.visible && !isPrevInfo) ||
            (instanceStore.previousInstancesListDialog.visible && !isPrevList);

        if (type !== 'user') {
            userStore.setUserDialogVisible(false);
        }
        if (type !== 'world') {
            worldStore.setWorldDialogVisible(false);
        }
        if (type !== 'avatar') {
            avatarStore.setAvatarDialogVisible(false);
        }
        if (type !== 'group') {
            groupStore.setGroupDialogVisible(false);
        }
        if (type !== 'group-member-moderation') {
            groupStore.setGroupMemberModerationVisible(false);
        }
        if (type !== 'group-roles') {
            groupStore.setGroupRolesDialogVisible(false);
        }
        if (!isPrevInfo) {
            instanceStore.setPreviousInstancesInfoDialogVisible(false);
        }
        if (!isPrevList) {
            instanceStore.setPreviousInstancesListDialogVisible(false);
        }
        if (!hadActiveDialog) {
            clearDialogCrumbs();
        }

        pushDialogCrumb(data);
        return hadActiveDialog;
    }

    // Make sure file drops outside of the screenshot manager don't navigate to the file path dropped.
    // This issue persists on prompts created with prompt(), unfortunately. Not sure how to fix that.
    document.body.addEventListener('drop', function (e) {
        e.preventDefault();
    });

    function showConsole() {
        (AppApi as any).ShowDevTools();
        if (AppDebug.debug || AppDebug.debugWebRequests || AppDebug.debugWebSocket || AppDebug.debugUserDiff) {
            return;
        }
        console.log(
            '%cCareful! This might not do what you think.',
            'background-color: red; color: yellow; font-size: 32px; font-weight: bold'
        );
        console.log(
            '%cIf someone told you to copy-paste something here, it can give them access to your account.',
            'font-size: 20px;'
        );
    }

    watch(
        () => router.currentRoute.value.name,
        (routeName) => {
            if (routeName) {
                const name = String(routeName);
                removeNotify(name);
                if (name === 'notification') {
                    notificationStore.clearUnseenNotifications();
                }
            }
        }
    );

    function notifyMenu(index: RouteRecordNameGeneric) {
        const currentRouteName = router.currentRoute.value?.name;

        if (index !== currentRouteName && !notifiedMenus.value.includes(index)) {
            notifiedMenus.value.push(index);
            updateTrayIconNotify();
        }
    }

    function removeNotify(index: string) {
        notifiedMenus.value = notifiedMenus.value.filter((i) => i !== index);
        updateTrayIconNotify();
    }

    function clearAllNotifications() {
        notifiedMenus.value = [];
        updateTrayIconNotify();
    }

    function updateTrayIconNotify(force = false) {
        const newState =
            appearanceSettings.notificationIconDot &&
            (notifiedMenus.value.includes('notification') || notifiedMenus.value.includes('friend-log'));

        if (trayIconNotify.value !== newState || force) {
            trayIconNotify.value = newState;
            if (LINUX) {
                window.electron.setTrayIconNotification(trayIconNotify.value);
                return;
            }
            (AppApi as any).SetTrayIconNotification(trayIconNotify.value);
        }
    }
    updateTrayIconNotify(true);

    return {
        notifiedMenus,
        shiftHeld,
        dialogCrumbs,

        notifyMenu,
        removeNotify,
        clearAllNotifications,
        showConsole,
        updateTrayIconNotify,
        pushDialogCrumb,
        setDialogCrumbLabel,
        jumpDialogCrumb,
        clearDialogCrumbs,
        closeMainDialog,
        openDialog,
        jumpBackDialogCrumb,
        handleBreadcrumbClick
    };
});
