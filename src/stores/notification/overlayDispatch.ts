import { extractFileId, extractFileVersion } from '../../shared/utils';
import { getNotificationMessage, toNotificationText } from '../../shared/utils/notificationMessage';

/**
 * Creates the overlay dispatch functions for the Notification store.
 *
 * @param {object} deps
 * @param {Function} deps.getUserIdFromNoty
 * @param {object} deps.queryRequest
 * @param {object} deps.notificationsSettingsStore
 * @param {object} deps.advancedSettingsStore
 * @returns {object} The overlay dispatch functions
 */
export function createOverlayDispatch({ getUserIdFromNoty, queryRequest, notificationsSettingsStore, advancedSettingsStore }: {
    getUserIdFromNoty: Function;
    queryRequest: object;
    notificationsSettingsStore: object;
    advancedSettingsStore: object;
}) {
    /**
     * @param {object} noty
     * @returns
     */
    async function notySaveImage(noty: object) {
        const imageUrl = await notyGetImage(noty);
        let fileId = extractFileId(imageUrl);
        let fileVersion = extractFileVersion(imageUrl);
        let imageLocation = '';
        try {
            if (fileId && fileVersion) {
                imageLocation = await (AppApi as any).GetImage(imageUrl, fileId, fileVersion);
            } else if (imageUrl && imageUrl.startsWith('http')) {




                fileVersion = imageUrl.split('/').pop(); // 1416226261.thumbnail-500.png




                fileId = fileVersion.split('.').shift(); imageLocation = await (AppApi as any).GetImage(imageUrl, fileId, fileVersion);
            }
        } catch (err) {
            console.error(imageUrl, err);
        }
        return imageLocation;
    }

    /**
     * @param noty
     * @param message
     * @param image
     */
    function displayDesktopToast(noty: object, message: string, image: string) {
        const result = getNotificationMessage(noty, message);
        if (result) {
            desktopNotification(result.title, result.body, image);
        }
    }

    /**
     * @param {string} noty
     * @param {string} message
     * @param {string} imageFile
     */
    function displayOverlayNotification(noty: string, message: string, imageFile: string) {
        let image = '';
        if (imageFile) {
            image = `file:///${imageFile}`;
        }
        (AppApi as any).ExecuteVrOverlayFunction('playNoty', JSON.stringify({ noty, message, image }));
    }

    /**
     * @param {any} noty
     * @param {string} message
     * @param {string} image
     */
    function displayXSNotification(noty: any, message: string, image: string) {
        const result = getNotificationMessage(noty, message);
        if (!result) return;
        const timeout = Math.floor(parseInt((notificationsSettingsStore as any).notificationTimeout.toString(), 10) / 1000);
        const opacity = parseFloat((advancedSettingsStore as any).notificationOpacity.toString()) / 100;
        const text = toNotificationText(result.title, result.body, noty.type);
        (AppApi as any).XSNotification('VRCX', text, timeout, opacity, image);
    }

    /**
     * @param playOvrtHudNotifications
     * @param playOvrtWristNotifications
     * @param noty
     * @param message
     * @param image
     */
    function displayOvrtNotification(playOvrtHudNotifications: any, playOvrtWristNotifications: any, noty: any, message: any, image: any) {
        const result = getNotificationMessage(noty, message);
        if (!result) return;
        const timeout = Math.floor(parseInt((notificationsSettingsStore as any).notificationTimeout.toString(), 10) / 1000);
        const opacity = parseFloat((advancedSettingsStore as any).notificationOpacity.toString()) / 100;
        const text = toNotificationText(result.title, result.body, noty.type);
        (AppApi as any).OVRTNotification(playOvrtHudNotifications, playOvrtWristNotifications, 'VRCX', text, timeout, opacity, image);
    }

    /**
     * @param {object} noty
     * @returns
     */
    async function notyGetImage(noty: object) {
        let imageUrl = '';
        const userId = getUserIdFromNoty(noty);

        if ((noty as any).thumbnailImageUrl) {
            imageUrl = (noty as any).thumbnailImageUrl;
        } else if ((noty as any).details && (noty as any).details.imageUrl) {
            imageUrl = (noty as any).details.imageUrl;
        } else if ((noty as any).imageUrl) {
            imageUrl = (noty as any).imageUrl;
        } else if (userId && !userId.startsWith('grp_')) {
            imageUrl = await (queryRequest as any).fetch('user', {
    userId
})
    .catch((err: any) => {
    console.error(err);
    return '';
})
    .then((args: {
    json: {
        iconUrl: any;
        profilePicOverride: any;
        currentAvatarThumbnailImageUrl: any;
    };
}) => {
    if (!args.json) {
        return '';
    }
    if (args.json.iconUrl) {
        return args.json.iconUrl;
    }
    if (args.json.profilePicOverride) {
        return args.json.profilePicOverride;
    }
    return args.json.currentAvatarThumbnailImageUrl;
});
        }
        return imageUrl;
    }

    /**
     * @param {string} displayName
     * @param {string} message
     * @param {string} image
     */
    function desktopNotification(displayName: string, message: string, image: string) {
        if (WINDOWS) {
            (AppApi as any).DesktopNotification(displayName, message, image);
        } else {
            window.electron.desktopNotification(displayName, message, image);
        }
    }

    return {
        notySaveImage,
        displayDesktopToast,
        displayOverlayNotification,
        displayXSNotification,
        displayOvrtNotification,
        notyGetImage,
        desktopNotification
    };
}
