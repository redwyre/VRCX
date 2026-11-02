/**
 * @param {string} instanceId
 * @returns
 */
function isRealInstance(instanceId: string) {
    if (!instanceId) {
        return false;
    }
    switch (instanceId) {
        case ':':
        case 'offline':
        case 'offline:offline':
        case 'private':
        case 'private:private':
        case 'traveling':
        case 'traveling:traveling':
            return false;
    }
    if (instanceId.startsWith('local')) {
        return false;
    }
    return true;
}

/**
 * @param {object} instance
 * @returns {string}
 */
function getLaunchURL(instance: object) {
    const L = instance;
    if ((L as any).instanceId) {
        if ((L as any).shortName) {
            return `https://vrchat.com/home/launch?worldId=${encodeURIComponent((L as any).worldId)}&instanceId=${encodeURIComponent((L as any).instanceId)}&shortName=${encodeURIComponent((L as any).shortName)}`;
        }
        return `https://vrchat.com/home/launch?worldId=${encodeURIComponent((L as any).worldId)}&instanceId=${encodeURIComponent((L as any).instanceId)}`;
    }
    return `https://vrchat.com/home/launch?worldId=${encodeURIComponent((L as any).worldId)}`;
}

const regionTagMap = {
    'US West': 'us',
    'US East': 'use',
    Europe: 'eu',
    Japan: 'jp'
};

/**
 * @param {object} opts
 * @param {string} opts.instanceName - Sanitised instance name segment
 * @param {string} opts.userId
 * @param {string} opts.accessType
 * @param {string} [opts.groupId]
 * @param {string} [opts.groupAccessType]
 * @param {string} opts.region - Display region name ('US West', 'US East', 'Europe', 'Japan')
 * @param {boolean} [opts.ageGate]
 * @param {boolean} [opts.strict]
 * @returns {string} Instance tag, e.g. '12345~hidden(usr_xxx)~region(us)'
 */
function buildLegacyInstanceTag({ instanceName, userId, accessType, groupId, groupAccessType, region, ageGate, strict }: {
    instanceName: string;
    userId: string;
    accessType: string;
    groupId?: string;
    groupAccessType?: string;
    region: string;
    ageGate?: boolean;
    strict?: boolean;
}) {
    const tags = [];

    if (instanceName) {
        tags.push(instanceName);
    }

    if (accessType !== 'public') {
        if (accessType === 'friends+') {
            tags.push(`~hidden(${userId})`);
        } else if (accessType === 'friends') {
            tags.push(`~friends(${userId})`);
        } else if (accessType === 'group') {
            tags.push(`~group(${groupId})`);
            tags.push(`~groupAccessType(${groupAccessType})`);
        } else {
            tags.push(`~private(${userId})`);
        }
        if (accessType === 'invite+') {
            tags.push('~canRequestInvite');
        }
    }

    if (accessType === 'group' && ageGate) {
        tags.push('~ageGate');
    }

    const regionCode = regionTagMap[region as keyof typeof regionTagMap];
    if (regionCode) {
        tags.push(`~region(${regionCode})`);
    }

    if (strict && (accessType === 'invite' || accessType === 'friends')) {
        tags.push('~strict');
    }

    return tags.join('');
}

export { isRealInstance, getLaunchURL, buildLegacyInstanceTag };
