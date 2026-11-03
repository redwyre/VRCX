import { instanceRequest } from '../api';
import { parseLocation } from '../shared/utils/locationParser';

/**
 * @param {object} instance
 */
function refreshInstancePlayerCount(instance: string) {
    const L = parseLocation(instance);
    if (L.isRealInstance) {
        instanceRequest.getInstance({
            worldId: L.worldId,
            instanceId: L.instanceId
        });
    }
}

export { refreshInstancePlayerCount };
