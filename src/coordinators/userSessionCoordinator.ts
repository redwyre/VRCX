import { getWorldName, parseLocation } from '../shared/utils';
import { runUpdateFriendshipsFlow, updateUserCurrentStatus } from './friendRelationshipCoordinator';
import { useAuthStore } from '../stores/auth';
import { addAvatarToHistory, addAvatarWearTime } from './avatarCoordinator';
import { useGameStore } from '../stores/game';
import { applyPresenceGroups } from './groupCoordinator';
import { useInstanceStore } from '../stores/instance';
import { useUserStore } from '../stores/user';

/**
 * Runs avatar transition side effects for current user updates.
 *
 * @param {object} args Avatar transition context.
 * @param {object} args.json Current user payload.
 * @param {object} args.ref Current user state reference.
 * @param {boolean} args.isLoggedIn Whether current user is already logged in.
 * @param {object} [options] Test seams.
 * @param {function} [options.now] Timestamp provider.
 */
export function runAvatarSwapFlow({ json, ref, isLoggedIn }: {
    json: object;
    ref: object;
    isLoggedIn: boolean;
}, { now = Date.now }: {




    now?: function;
} = {}) {
    const gameStore = useGameStore();

    if (!isLoggedIn) {
        return;
    }
    if ((json as any).currentAvatar !== (ref as any).currentAvatar) {
        addAvatarToHistory((json as any).currentAvatar);
        if (gameStore.isGameRunning) {
            addAvatarWearTime((ref as any).currentAvatar);
            (ref as any).$previousAvatarSwapTime = now();
        }
    }
}

/**
 * Runs one-time side effects for first current-user hydration after login.
 *
 * @param {object} ref Current user state reference.
 * @param {object} [options] Test seams.
 * @param {function} [options.now] Timestamp provider.
 */
export function runFirstLoginFlow(ref: object, { now = Date.now }: {




    now?: function;
} = {}) {
    const gameStore = useGameStore();
    const authStore = useAuthStore();
    const userStore = useUserStore();

    if (gameStore.isGameRunning) {
        (ref as any).$previousAvatarSwapTime = now();
    }
    userStore.clearCachedUsers(); // clear before running applyUser
    userStore.setCurrentUser(ref);
    authStore.loginComplete();
}

/**
 * Runs cross-store synchronization after current-user data is applied.
 *
 * @param {object} ref Current user state reference.
 */
export function runPostApplySyncFlow(ref: object) {
    const instanceStore = useInstanceStore();

    applyPresenceGroups(ref);
    instanceStore.applyQueuedInstance((ref as any).queuedInstance);
    updateUserCurrentStatus(ref);
    if (typeof (ref as any).friends !== 'undefined') {
        runUpdateFriendshipsFlow(ref);
    }
}

/**
 * Syncs home location derived state and visible dialog display name.
 *
 * @param {object} ref Current user state reference.
 */
export function runHomeLocationSyncFlow(ref: object) {
    const userStore = useUserStore();

    if ((ref as any).homeLocation === (ref as any).$homeLocation?.tag) {
        return;
    }
    (ref as any).$homeLocation = parseLocation((ref as any).homeLocation);
    // apply home location name to user dialog
    if (userStore.userDialog.visible && userStore.userDialog.id === (ref as any).id) {
        getWorldName(userStore.currentUser.homeLocation).then((worldName) => {
            userStore.userDialog.$homeLocationName = worldName;
        });
    }
}
