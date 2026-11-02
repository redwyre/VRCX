import { useUserStore } from '../stores';
import {
    userImage as userImagePure,
    userImageFull as userImageFullPure,
    userStatusClass as userStatusClassPure
} from '../shared/utils/user';

/**
 * Composable that provides store-aware user display functions.
 * Delegates to the pure utility functions after resolving store data.
 */
export function useUserDisplay() {
    const userStore = useUserStore();

    function userStatusClass(user: object, pendingOffline = false) {
        return userStatusClassPure(user, pendingOffline, userStore.currentUser);
    }

    function userImage(user: object, isIcon = false, resolution = '128') {
        return userImagePure(user, isIcon, resolution);
    }

    function userImageFull(user: object) {
        return userImageFullPure(user);
    }

    return { userStatusClass, userImage, userImageFull };
}
