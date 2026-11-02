import { defineStore } from 'pinia';
import { reactive, toRefs } from 'vue';

const initialDialogState = () => ({
    groupCalendar: false,
    blockedGroups: false,
    groupInvites: false,
    noteExport: false,
    exportDiscordNames: false,
    exportFriendsList: false,
    exportAvatarsList: false,
    editInviteMessages: false,
    autoChangeStatus: false,
    moderationReports: false,
    purchaseHistory: false,
    infoPush: false
});

export const useToolsStore = defineStore('Tools', () => {
    const dialogs = reactive(initialDialogState());

    function setDialogVisible(dialogKey: string, value: boolean) {
        if (!(dialogKey in dialogs)) {
            console.warn(`[toolsStore] Unknown dialog key "${dialogKey}" passed to setDialogVisible`);
            return;
        }
        dialogs[dialogKey as keyof typeof dialogs] = value;
    }

    function openDialog(dialogKey: any) {
        setDialogVisible(dialogKey, true);
    }

    function closeDialog(dialogKey: any) {
        setDialogVisible(dialogKey, false);
    }

    function closeAllDialogs() {
        Object.keys(dialogs).forEach((dialogKey) => {
            dialogs[dialogKey as keyof typeof dialogs] = false;
        });
    }

    return {
        ...toRefs(dialogs),
        setDialogVisible,
        openDialog,
        closeDialog,
        closeAllDialogs
    };
});
