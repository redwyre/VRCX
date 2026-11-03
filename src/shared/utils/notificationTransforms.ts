import { replaceBioSymbols } from './base/string';
import type { NotificationV2 } from 'vrchat';
import type { Json, VrcxNotification } from '@/types/vrcx';

/**
 * Remove null/undefined keys from a notification JSON object
 * and sanitize message/title fields with replaceBioSymbols.
 *
 * @param {object} json - Notification data (mutated in place)
 * @returns {object} The same json reference
 */
export function sanitizeNotificationJson(json: object) {
    for (const key in json) {
        if ((json as any)[key] === null || typeof (json as any)[key] === 'undefined') {
            delete (json as any)[key];
        }
    }
    if ((json as any).message) {
        (json as any).message = replaceBioSymbols((json as any).message);
    }
    if ((json as any).title) {
        (json as any).title = replaceBioSymbols((json as any).title);
    }
    return json;
}

/**
 * Parse a notification's details field from string to object if needed.
 *
 * @param {any} details - Raw details value
 * @returns {object} Parsed details object
 */
export function parseNotificationDetails(details: any) {
    if (details === Object(details)) {
        return details;
    }
    if (details !== '{}' && typeof details === 'string') {
        try {
            const object = JSON.parse(details);
            if (object === Object(object)) {
                return object;
            }
        } catch (err) {
            console.log(err);
        }
    }
    return {};
}

/**
 * Build a default V1 notification ref from JSON data.
 * Does NOT perform cache lookup — caller is responsible for
 * checking existing refs and merging.
 *
 * @param {Partial<VrcxNotification>} json - Sanitized notification JSON
 * @returns {VrcxNotification} Default notification ref
 */

export function createDefaultNotificationRef(json: Partial<VrcxNotification>) {
    const ref = {
        id: '',
        senderUserId: '',
        senderUsername: '',
        receiverUserId: '',
        type: '',
        message: '',
        details: {},
        seen: false,
        created_at: '',
        // VRCX
        $isExpired: false,
        //
        ...json
    } as VrcxNotification;
    ref.details = parseNotificationDetails(ref.details);
    return ref;
}

/**
 * Build a default V2 notification ref from JSON data.
 * Handles boop legacy formatting.
 *
 * @param {Partial<Json<NotificationV2>>} json - Sanitized notification JSON
 * @returns {Json<NotificationV2>} Default notification V2 ref
 */

export function createDefaultNotificationV2Ref(json: Partial<Json<NotificationV2>>) {
    return {
        id: '',
        createdAt: '',
        updatedAt: '',
        expiresAt: '',
        type: '',
        link: '',
        linkText: '',
        message: '',
        title: '',
        imageUrl: '',
        seen: false,
        senderUserId: '',
        senderUsername: '',
        receiverUserId: '',
        data: {},
        responses: [],
        details: {},
        version: 2,
        canDelete: false,
        category: '',
        displayData: null,
        expiryAfterSeen: 0,
        ignoreDND: false,
        isSystem: false,
        linkTextKey: '',
        messageKey: '',
        relatedNotificationsId: '',
        requireSeen: false,
        titleKey: '',
        ...json
    } as Json<NotificationV2>;
}

/**
 * Apply legacy boop formatting to a V2 notification ref.
 * Mutates the ref in place.
 *
 * @param {object} ref - Notification V2 ref
 * @param {string} endpointDomain - API endpoint domain for emoji URLs
 */
export function applyBoopLegacyHandling(ref: object, endpointDomain: string) {
    if ((ref as any).type !== 'boop' || !(ref as any).title) {
        return;
    }
    (ref as any).message = (ref as any).title;
    (ref as any).title = '';
    if ((ref as any).details?.emojiId?.startsWith('default_')) {
        (ref as any).imageUrl = (ref as any).details.emojiId;
        (ref as any).message += ` ${(ref as any).details.emojiId.replace('default_', '')}`;
    } else {
        (ref as any).imageUrl =
            `${endpointDomain}/file/${(ref as any).details.emojiId}/${(ref as any).details.emojiVersion}`;
    }
}
