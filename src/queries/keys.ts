export const queryKeys = Object.freeze({
    user: (userId: any) => ['user', userId],
    profile: (userId: any) => ['profile', userId],
    avatar: (avatarId: any) => ['avatar', avatarId],
    world: (worldId: any) => ['world', worldId],
    group: (groupId: any, includeRoles = false) => ['group', groupId, Boolean(includeRoles)],
    groupMember: ({ groupId, userId }: any) => ['group', groupId, 'member', userId],
    groupMembers: ({ groupId, n = 100, offset = 0, sort = '', roleId = '' }: any) => [
        'group',
        groupId,
        'members',
        {
            n: Number(n),
            offset: Number(offset),
            sort: String(sort || ''),
            roleId: String(roleId || '')
        }
    ],
    groupGallery: ({ groupId, galleryId, n = 100, offset = 0 }: any) => [
        'group',
        groupId,
        'gallery',
        galleryId,
        {
            n: Number(n),
            offset: Number(offset)
        }
    ],
    groupCalendar: (groupId: any) => ['group', groupId, 'calendar'],
    groupCalendarEvent: ({ groupId, eventId }: any) => ['group', groupId, 'calendarEvent', eventId],
    avatarGallery: (avatarId: any) => ['avatar', avatarId, 'gallery'],
    worldsByUser: ({
        userId,
        n = 50,
        offset = 0,
        sort = '',
        order = '',
        user = '',
        releaseStatus = '',
        option = ''
    }: any) => [
        'worlds',
        'user',
        userId,
        {
            n: Number(n),
            offset: Number(offset),
            sort: String(sort || ''),
            order: String(order || ''),
            user: String(user || ''),
            releaseStatus: String(releaseStatus || ''),
            option: String(option || '')
        }
    ],
    favoriteLimits: () => ['favorite', 'limits'],
    userInventoryItem: ({ inventoryId, userId }: any) => ['inventory', 'item', userId, inventoryId],
    fileAnalysis: ({ fileId, version, variant }: any) => ['analysis', fileId, Number(version), String(variant || '')],
    worldPersistData: (worldId: any) => ['world', worldId, 'persistData'],
    mutualCounts: (userId: any) => ['user', userId, 'mutualCounts'],
    visits: () => ['visits'],
    instanceCount: () => ['instances', 'count'],
    file: (fileId: any) => ['file', fileId],
    avatarStyles: () => ['avatar', 'styles'],
    representedGroup: (userId: any) => ['user', userId, 'representedGroup'],
    vrchatCredits: () => ['credits']
});
