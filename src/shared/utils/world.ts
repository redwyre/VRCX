import { parseLocation } from './location';
import { queryRequest } from '../../api';
import { rpcWorlds } from '../constants';

/**
 * @param {string} location
 * @returns {Promise<string>}
 */
async function getWorldName(location: string) {
    let worldName = '';

    const L = parseLocation(location);
    if (L.isRealInstance && L.worldId) {
        try {
            const args = await queryRequest.fetch('world.dialog', {
                worldId: L.worldId
            });
            worldName = (args as any).ref.name;
        } catch (e) {
            console.error('getWorldName failed location', location, e);
        }
    }

    return worldName;
}

/**
 * @param {string} location
 * @returns
 */
function isRpcWorld(location: string) {
    const L = parseLocation(location);
    if (rpcWorlds.includes(L.worldId)) {
        return true;
    }
    return false;
}

export { getWorldName, isRpcWorld };
