import { useLocalStorage } from '@vueuse/core';

import { useGeneralSettingsStore } from '../stores/settings/general';

/**
 * Persisted Map tracking recent invite/request actions.
 * Key: `${userId}:${actionType}`, Value: timestamp (ms).
 * Stored in localStorage via @vueuse/core.
 */
const recentActions = useLocalStorage('VRCX_recentActions', {});

const TRACKED_ACTIONS = new Set([
    'Send Friend Request',
    'Invite',
    'Invite Photo',
    'Invite Message',
    'Request Invite',
    'Request Invite Photo',
    'Request Invite Message'
]);

/**
 * @param {string} userId
 * @param {string} actionType
 */
export function recordRecentAction(userId: string, actionType: string) {
    if (!TRACKED_ACTIONS.has(actionType)) {
        return;
    }
    (recentActions.value as any)[`${userId}:${actionType}`] = Date.now();
}

/**
 * @param {string} userId
 * @param {string} actionType
 * @returns {boolean}
 */
export function isActionRecent(userId: string, actionType: string) {
    const generalSettings = useGeneralSettingsStore();
    if (!generalSettings.recentActionCooldownEnabled) {
        return false;
    }
    const key = `${userId}:${actionType}`;
    const ts = (recentActions.value as any)[key];
    if (!ts) {
        return false;
    }
    const cooldownMs = generalSettings.recentActionCooldownMinutes * 60 * 1000;
    if (Date.now() - ts < cooldownMs) {
        return true;
    }
    // Expired, clean up
delete (recentActions.value as any)[key];
    return false;
}

export function clearRecentActions() {
    recentActions.value = {};
}
