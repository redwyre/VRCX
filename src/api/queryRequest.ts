import { entityQueryPolicies, fetchWithEntityPolicy, queryKeys } from '../queries';

import avatarRequest from './avatar';
import favoriteRequest from './favorite';

import groupRequest from './group';
import instanceRequest from './instance';
import inventoryRequest from './inventory';
import marketplaceRequest from './marketplace';
import miscRequest from './misc';
import userRequest from './user';

import worldRequest from './world';
import { GroupSearchSort, GroupRoleId } from "vrchat";

const registry = Object.freeze({
    user: {
        key: (params: { userId: any; }) => queryKeys.user(params.userId),
        policy: entityQueryPolicies.user,
        queryFn: (params: { userId: string; }) => userRequest.getUser(params)
    },
    'user.dialog': {
        key: (params: { userId: any; }) => queryKeys.user(params.userId),
        policy: Object.freeze({
            ...entityQueryPolicies.user,
            staleTime: 60_000
        }),
        queryFn: (params: { userId: string; }) => userRequest.getUser(params)
    },
    'user.force': {
        key: (params: { userId: any; }) => queryKeys.user(params.userId),
        policy: Object.freeze({
            ...entityQueryPolicies.user,
            staleTime: 0
        }),
        queryFn: (params: { userId: string; }) => userRequest.getUser(params)
    },
    publicProfile: {
        key: (params: { userId: any; }) => queryKeys.profile(params.userId),
        policy: entityQueryPolicies.profile,
        queryFn: (params: { userId: string; }) => userRequest.getPublicProfile(params)
    },
    avatar: {
        key: (params: { avatarId: any; }) => queryKeys.avatar(params.avatarId),
        policy: entityQueryPolicies.avatar,
        queryFn: (params: { avatarId: string; }) => avatarRequest.getAvatar(params)
    },
    'avatar.dialog': {
        key: (params: { avatarId: any; }) => queryKeys.avatar(params.avatarId),
        policy: Object.freeze({
            ...entityQueryPolicies.avatar,
            staleTime: 120_000
        }),
        queryFn: (params: { avatarId: string; }) => avatarRequest.getAvatar(params)
    },
    world: {
        key: (params: { worldId: any; }) => queryKeys.world(params.worldId),
        policy: entityQueryPolicies.world,
        queryFn: (params: { worldId: string; }) => worldRequest.getWorld(params)
    },
    'world.dialog': {
        key: (params: { worldId: any; }) => queryKeys.world(params.worldId),
        policy: Object.freeze({
            ...entityQueryPolicies.world,
            staleTime: 120_000
        }),
        queryFn: (params: { worldId: string; }) => worldRequest.getWorld(params)
    },
    'world.location': {
        key: (params: { worldId: any; }) => queryKeys.world(params.worldId),
        policy: Object.freeze({
            ...entityQueryPolicies.world,
            staleTime: 120_000
        }),
        queryFn: (params: { worldId: string; }) => worldRequest.getWorld(params)
    },
    'world.force': {
        key: (params: { worldId: any; }) => queryKeys.world(params.worldId),
        policy: Object.freeze({
            ...entityQueryPolicies.world,
            staleTime: 0
        }),
        queryFn: (params: { worldId: string; }) => worldRequest.getWorld(params)
    },
    worldsByUser: {
        key: (params: { userId: any; n?: number | undefined; offset?: number | undefined; sort?: string | undefined; order?: string | undefined; user?: string | undefined; releaseStatus?: string | undefined; option?: string | undefined; }) => queryKeys.worldsByUser(params),
        policy: entityQueryPolicies.worldCollection,
        queryFn: (params: any) => worldRequest.getWorlds(params, params.option || undefined)
    },
    group: {
        key: (params: { groupId: any; includeRoles: boolean | undefined; }) => queryKeys.group(params.groupId, params.includeRoles),
        policy: entityQueryPolicies.group,
        queryFn: (params: { groupId: string; } & { includeRoles?: boolean; purpose?: string; }) => groupRequest.getGroup(params)
    },
    'group.dialog': {
        key: (params: { groupId: any; includeRoles: boolean | undefined; }) => queryKeys.group(params.groupId, params.includeRoles),
        policy: Object.freeze({
            ...entityQueryPolicies.group,
            staleTime: 120_000
        }),
        queryFn: (params: { groupId: string; } & { includeRoles?: boolean; purpose?: string; }) => groupRequest.getGroup(params)
    },
    'group.force': {
        key: (params: { groupId: any; includeRoles: boolean | undefined; }) => queryKeys.group(params.groupId, params.includeRoles),
        policy: Object.freeze({
            ...entityQueryPolicies.group,
            staleTime: 0
        }),
        queryFn: (params: { groupId: string; } & { includeRoles?: boolean; purpose?: string; }) => groupRequest.getGroup(params)
    },
    groupMember: {
        key: (params: { groupId: any; userId: any; }) => queryKeys.groupMember(params),
        policy: entityQueryPolicies.groupCollection,
        queryFn: (params: { groupId: string; userId: string; }) => groupRequest.getGroupMember(params)
    },
    groupMembers: {
        key: (params: { groupId: any; n?: number | undefined; offset?: number | undefined; sort?: string | undefined; roleId?: string | undefined; }) => queryKeys.groupMembers(params),
        policy: entityQueryPolicies.groupCollection,
        queryFn: (params: { groupId: string; } & { n?: number; offset?: number; sort?: GroupSearchSort; roleId?: GroupRoleId; }) => groupRequest.getGroupMembers(params)
    },
    groupGallery: {
        key: (params: { groupId: any; galleryId: any; n?: number | undefined; offset?: number | undefined; }) => queryKeys.groupGallery(params),
        policy: entityQueryPolicies.groupCollection,
        queryFn: (params: { groupId: string; galleryId: string; } & { n?: number; offset?: number; v?: number; approved?: boolean; }) => groupRequest.getGroupGallery(params)
    },
    groupCalendar: {
        key: (params: { groupId: any; }) => queryKeys.groupCalendar(params.groupId),
        policy: entityQueryPolicies.groupCollection,
        queryFn: (params: { groupId: string; }) => groupRequest.getGroupCalendar(params.groupId)
    },
    groupCalendarEvent: {
        key: (params: { groupId: any; eventId: any; }) => queryKeys.groupCalendarEvent(params),
        policy: entityQueryPolicies.groupCalendarEvent,
        queryFn: (params: { groupId: string; eventId: string; }) => groupRequest.getGroupCalendarEvent(params)
    },
    avatarGallery: {
        key: (params: { avatarId: any; }) => queryKeys.avatarGallery(params.avatarId),
        policy: entityQueryPolicies.avatarGallery,
        queryFn: (params: { avatarId: string; }) => avatarRequest.getAvatarGallery(params.avatarId)
    },
    'avatarGallery.force': {
        key: (params: { avatarId: any; }) => queryKeys.avatarGallery(params.avatarId),
        policy: Object.freeze({
            ...entityQueryPolicies.avatarGallery,
            staleTime: 0
        }),
        queryFn: (params: { avatarId: string; }) => avatarRequest.getAvatarGallery(params.avatarId)
    },
    favoriteLimits: {
        key: () => queryKeys.favoriteLimits(),
        policy: entityQueryPolicies.favoriteLimits,
        queryFn: () => favoriteRequest.getFavoriteLimits()
    },
    userInventoryItem: {
        key: (params: { inventoryId: any; userId: any; }) => queryKeys.userInventoryItem(params),
        policy: entityQueryPolicies.inventoryCollection,
        queryFn: (params: { inventoryId: string; userId: string; flags: any; }) => inventoryRequest.getUserInventoryItem(params)
    },
    fileAnalysis: {
        key: (params: { fileId: any; version: any; variant: any; }) => queryKeys.fileAnalysis(params),
        policy: entityQueryPolicies.fileAnalysis,
        queryFn: (params: { fileId: string; version: number; variant: string; }) => miscRequest.getFileAnalysis(params)
    },
    worldPersistData: {
        key: (params: { worldId: any; }) => queryKeys.worldPersistData(params.worldId),
        policy: entityQueryPolicies.worldPersistData,
        queryFn: (params: { worldId: string; }) => miscRequest.hasWorldPersistData(params)
    },
    mutualCounts: {
        key: (params: { userId: any; }) => queryKeys.mutualCounts(params.userId),
        policy: entityQueryPolicies.mutualCounts,
        queryFn: (params: { userId: string; }) => userRequest.getMutualCounts(params)
    },
    visits: {
        key: () => queryKeys.visits(),
        policy: entityQueryPolicies.visits,
        queryFn: () => miscRequest.getVisits()
    },
    instanceCount: {
        key: () => queryKeys.instanceCount(),
        policy: entityQueryPolicies.instanceCount,
        queryFn: () => instanceRequest.getInstanceCount()
    },
    file: {
        key: (params: { fileId: any; }) => queryKeys.file(params.fileId),
        policy: entityQueryPolicies.fileObject,
        queryFn: (params: { fileId: string; }) => miscRequest.getFile(params)
    },
    avatarStyles: {
        key: () => queryKeys.avatarStyles(),
        policy: entityQueryPolicies.avatarStyles,
        queryFn: () => avatarRequest.getAvailableAvatarStyles()
    },
    representedGroup: {
        key: (params: { userId: any; }) => queryKeys.representedGroup(params.userId),
        policy: entityQueryPolicies.representedGroup,
        queryFn: (params: { userId: string; }) => groupRequest.getRepresentedGroup(params)
    },
    vrchatCredits: {
        key: () => queryKeys.vrchatCredits(),
        policy: entityQueryPolicies.vrchatCredits,
        queryFn: () => marketplaceRequest.getVRChatCredits()
    }
});

const queryRequest = {
    async fetch<T>(resource: keyof typeof registry, params: any = {}): Promise<T & { cache: boolean }> {
        const entry = registry[resource];
        if (!entry) {
            throw new Error(`Unknown query resource: ${String(resource)}`);
        }

        const { data, cache } = await fetchWithEntityPolicy({
            queryKey: entry.key(params),
            policy: entry.policy,
            queryFn: () => entry.queryFn(params),
            label: resource
        });

        return {
            ...data,
            cache
        };
    }
};

export default queryRequest;
