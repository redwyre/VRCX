import { nextTick } from 'vue';
import { toast } from 'vue-sonner';
import { i18n } from '../plugins/i18n';

import {
    convertFileUrlToImageUrl,
    createDefaultGroupRef,
    hasGroupPermission,
    sanitizeEntityJson
} from '../shared/utils';
import { groupRequest, instanceRequest, queryRequest } from '../api';
import { database } from '../services/database';
import { FILTER_EVERYONE } from '../shared/constants/';
import { patchGroupFromEvent } from '../queries';
import { useGameStore } from '../stores/game';
import { useInstanceStore } from '../stores/instance';
import { useModalStore } from '../stores/modal';
import { useNotificationStore } from '../stores/notification';
import { useUiStore } from '../stores/ui';
import { useUserStore } from '../stores/user';
import { useGroupStore } from '../stores/group';
import { syncGroupSearchIndex, removeGroupSearchIndex, clearGroupSearchIndex } from './searchIndexCoordinator';
import { watchState } from '../services/watchState';

import configRepository from '../services/config';

import * as workerTimers from 'worker-timers';
import { UpdateGroupMemberRequest } from "vrchat";

/**
 * @param ref
 */
function applyGroupLanguage(ref: { $languages?: any; languages?: any; }) {
    const userStore = useUserStore();
    ref.$languages = [];
    const { languages } = ref;
    if (!languages) {
        return;
    }
    for (const language of languages) {
        const value = userStore.subsetOfLanguages[language];
        if (typeof value === 'undefined') {
            continue;
        }
        ref.$languages.push({
            key: language,
            value
        });
    }
}

/**
 * @param {object} json
 * @returns {import('@/types/vrcx').VrcxGroup}
 */
export function applyGroup(json: object) {
    const groupStore = useGroupStore();
    let ref = groupStore.cachedGroups.get((json as any).id);
    sanitizeEntityJson(json, ['rules', 'name', 'description']);
    if (Array.isArray((json as any).roles)) {
        for (const role of (json as any).roles) {
            sanitizeEntityJson(role, ['name', 'description']);
        }
    }
    if (typeof ref === 'undefined') {
        ref = createDefaultGroupRef(json);
        groupStore.cachedGroups.set(ref.id, ref);
    } else {
        if (groupStore.currentUserGroups.has(ref.id)) {
            // compare group props
            if (ref.ownerId && (json as any).ownerId && ref.ownerId !== (json as any).ownerId) {
                // owner changed
groupOwnerChange(json, ref.ownerId, (json as any).ownerId);
            }
            if (ref.name && (json as any).name && ref.name !== (json as any).name) {
                // name changed
groupChange(json, `Name changed from ${ref.name} to ${(json as any).name}`);
            }
            if (ref.myMember?.roleIds && (json as any).myMember?.roleIds) {
                const oldRoleIds = ref.myMember.roleIds;
                const newRoleIds = (json as any).myMember.roleIds;
                if (
                    oldRoleIds.length !== newRoleIds.length ||
                    !oldRoleIds.every((value: any, index: string | number) => value === newRoleIds[index])
                ) {
                    // roleIds changed
groupRoleChange(json, ref.roles, (json as any).roles, oldRoleIds, newRoleIds);
                }
            }
        }
        if ((json as any).myMember) {
            if (typeof (json as any).myMember.roleIds === 'undefined') {
                // keep roleIds
(json as any).myMember.roleIds = ref.myMember.roleIds;
            }
            Object.assign(ref.myMember, (json as any).myMember);
        }
        Object.assign(ref, json);
    }
    // update myMember without fetching member
    if (typeof (json as any).memberVisibility !== 'undefined') {
        ref.myMember.visibility = (json as any).memberVisibility;
    }
    if (typeof (json as any).isRepresenting !== 'undefined') {
        ref.myMember.isRepresenting = (json as any).isRepresenting;
    }
    if (typeof (json as any).membershipStatus !== 'undefined') {
        ref.myMember.membershipStatus = (json as any).membershipStatus;
    }
    if (typeof (json as any).roleIds !== 'undefined') {
        ref.myMember.roleIds = (json as any).roleIds;
    }
    applyGroupLanguage(ref);

    const currentUserGroupRef = groupStore.currentUserGroups.get(ref.id);
    if (currentUserGroupRef) {
        groupStore.currentUserGroups.set(ref.id, ref);
    }

    const D = groupStore.groupDialog;
    if (D.visible && D.id === ref.id) {
        D.inGroup = ref.membershipStatus === 'member';
        D.ref = ref;
    }
    patchGroupFromEvent(ref);
    if (groupStore.currentUserGroups.has(ref.id)) {
        syncGroupSearchIndex(ref);
    }
    return ref;
}

/**
 * @param {object} json
 * @returns {any}
 */
export function applyGroupMember(json: object) {
    const userStore = useUserStore();
    const groupStore = useGroupStore();
    let ref;
    if (typeof (json as any)?.user !== 'undefined') {
        if ((json as any).userId === userStore.currentUser.id) {
            (json as any).user = userStore.currentUser;
            (json as any).$displayName = userStore.currentUser.displayName;
        } else {
            ref = userStore.cachedUsers.get((json as any).user.id);
            if (typeof ref !== 'undefined') {
                (json as any).user = ref;
                (json as any).$displayName = ref.displayName;
            } else {
                (json as any).$displayName = (json as any).user?.displayName;
            }
        }
    }
    // update myMember without fetching member
    if ((json as any)?.userId === userStore.currentUser.id) {
        ref = groupStore.cachedGroups.get((json as any).groupId);
        if (typeof ref !== 'undefined') {
            /** @type {import('@/types/vrcx').Json<import('vrchat').GroupMyMember>} */




const groupMember: import('@/types/vrcx').Json<import('vrchat').GroupMyMember> = {
    ...ref.myMember,
    id: (json as any).id,
    isRepresenting: (json as any).isRepresenting,
    isSubscribedToAnnouncements: (json as any).isSubscribedToAnnouncements,
    isSubscribedToEventAnnouncements: (json as any).isSubscribedToEventAnnouncements,
    joinedAt: (json as any).joinedAt,
    lastPostReadAt: (json as any).lastPostReadAt,
    mRoleIds: (json as any).mRoleIds,
    membershipStatus: (json as any).membershipStatus,
    roleIds: (json as any).roleIds,
    userId: (json as any).userId,
    visibility: (json as any).visibility
};
            applyGroup({
    id: (json as any).groupId,
    myMember: groupMember
});
        }
    }

    return json;
}

/**
 * @param ref
 * @param message
 */
function groupChange(ref: any, message: any) {
    const groupStore = useGroupStore();
    const notificationStore = useNotificationStore();
    if (!groupStore.currentUserGroupsInit) {
        return;
    }
    // oh the level of cursed for compibility
    const json = {
        id: Math.random().toString(36),
        type: 'groupChange',
        senderUserId: ref.id,
        senderUsername: ref.name,
        imageUrl: ref.iconUrl,
        details: {
            imageUrl: ref.iconUrl
        },
        message,
        created_at: new Date().toJSON()
    };
    notificationStore.handleNotification({
        json,
        params: {
            notificationId: json.id
        }
    });

    // delay to wait for json to be assigned to ref
    workerTimers.setTimeout(() => saveCurrentUserGroups(), 100);
}

/**
 * @param {object} ref
 * @param {string} oldUserId
 * @param {string} newUserId
 * @returns {Promise<void>}
 */
async function groupOwnerChange(ref: object, oldUserId: string, newUserId: string) {
    const oldUser = await queryRequest.fetch('user.dialog', {
        userId: oldUserId
    });
    const newUser = await queryRequest.fetch('user.dialog', {
        userId: newUserId
    });
    const oldDisplayName = (oldUser as any)?.ref?.displayName;
    const newDisplayName = (newUser as any)?.ref?.displayName;

    groupChange(ref, `Owner changed from ${oldDisplayName} to ${newDisplayName}`);
}

/**
 * @param {object} ref
 * @param {Array} oldRoles
 * @param {Array} newRoles
 * @param {Array} oldRoleIds
 * @param {Array} newRoleIds
 */
function groupRoleChange(ref: object, oldRoles: Array<any>, newRoles: Array<any>, oldRoleIds: Array<any>, newRoleIds: Array<any>) {
    // check for removed/added roleIds
    for (const roleId of oldRoleIds) {
        if (!newRoleIds.includes(roleId)) {
            let roleName = '';
            const role = oldRoles.find((fineRole) => fineRole.id === roleId);
            if (role) {
                roleName = role.name;
            }
            groupChange(ref, `Role ${roleName} removed`);
        }
    }
    if (typeof newRoles !== 'undefined') {
        for (const roleId of newRoleIds) {
            if (!oldRoleIds.includes(roleId)) {
                let roleName = '';
                const role = newRoles.find((fineRole) => fineRole.id === roleId);
                if (role) {
                    roleName = role.name;
                }
                groupChange(ref, `Role ${roleName} added`);
            }
        }
    }
}

/**
 * @param groupId
 * @param options
 */
export function showGroupDialog(groupId: string | undefined, options = {}) {
    const t = i18n.global.t;
    const groupStore = useGroupStore();
    const uiStore = useUiStore();
    const instanceStore = useInstanceStore();
    if (!groupId) {
        return;
    }
    const forceRefresh = Boolean((options as any)?.forceRefresh);
    const isMainDialogOpen = uiStore.openDialog({
        type: 'group',
        id: groupId
    });
    const D = groupStore.groupDialog;
    D.visible = true;
    if (isMainDialogOpen && D.id === groupId && !forceRefresh) {
        uiStore.setDialogCrumbLabel('group', D.id, (D.ref as any)?.name || D.id);
        instanceStore.applyGroupDialogInstances();
        D.loading = false;
        return;
    }
    D.loading = true;
    D.id = groupId;
    D.inGroup = false;
    D.ownerDisplayName = '';
    D.announcement = {};
    D.posts = [];
    D.postsFiltered = [];
    D.instances = [];
    D.memberRoles = [];
    D.lastVisit = '';
    D.joinCount = 0;
    D.memberSearch = '';
    D.memberSearchResults = [];
    D.galleries = {};
    D.listings = [];
    D.members = [];
    D.memberFilter = FILTER_EVERYONE;
    D.calendar = [];
    const loadGroupRequest = groupRequest.getGroup({
        groupId,
        includeRoles: true
    });

    loadGroupRequest
        .catch((err) => {
            D.loading = false;




            D.id = null;
            D.visible = false;
            uiStore.jumpBackDialogCrumb();
            toast.error(t('message.group.load_failed'));
            throw err;
        })
        .then((args) => {
            const ref = args.ref || applyGroup(args.json);
            if (groupId === ref.id) {
                D.ref = ref;
                uiStore.setDialogCrumbLabel('group', D.id, (D.ref as any)?.name || D.id);
                D.inGroup = ref.membershipStatus === 'member';




                D.ownerDisplayName = ref.ownerId;
                D.visible = true;
                D.loading = false;
                queryRequest
                    .fetch('user.dialog', {
                        userId: ref.ownerId
                    })
                    .then((args1) => {
                        D.ownerDisplayName = (args1 as any).ref.displayName;
                    });
                database.getLastGroupVisit(D.id).then((r) => {
                    if (D.id === ref.id) {
                        D.lastVisit = r.created_at;
                    }
                });
                database.getGroupJoinCount(D.id).then((r) => {
                    if (D.id === ref.id) {
                        D.joinCount = r.joinCount;
                    }
                });
                instanceStore.applyGroupDialogInstances();
                getGroupDialogGroup(groupId, ref);
            }
        });
}

export function clearGroupMemberModerationDialog() {
    const groupStore = useGroupStore();
    const D = groupStore.groupMemberModeration;
    D.tables.members.data = [];
    D.tables.members.pageIndex = 0;
    D.tables.bans.data = [];
    D.tables.bans.pageIndex = 0;
    D.tables.invites.data = [];
    D.tables.invites.pageIndex = 0;
    D.tables.logs.data = [];
    D.tables.logs.pageIndex = 0;
}

/**
 * @param groupId
 * @param userId
 */
export function showGroupMemberModerationDialog(groupId: string, userId = '') {
    const uiStore = useUiStore();
    const groupStore = useGroupStore();
    const isMainDialogOpen = uiStore.openDialog({
        type: 'group-member-moderation',
        id: groupId
    });
    const D = groupStore.groupMemberModeration;
    if (!isMainDialogOpen || groupId !== D.id) {
        clearGroupMemberModerationDialog();
    }
    D.id = groupId;
    D.openWithUserId = userId;

    D.groupRef = {};
    D.auditLogTypes = [];
    queryRequest.fetch('group.dialog', { groupId }).then((args) => {
        D.groupRef = (args as any).ref;
        uiStore.setDialogCrumbLabel('group-member-moderation', D.id, (D.groupRef as any)?.name || D.id);
        if (hasGroupPermission(D.groupRef, 'group-audit-view')) {
            groupRequest.getGroupAuditLogTypes({ groupId }).then((args) => {
                if (D.id !== args.params.groupId) {
                    return;
                }




                D.auditLogTypes = args.json;
            });
        }
    });
    D.visible = true;
}

/**
 * @param groupId
 * @returns {Promise<void>}
 */
export async function loadGroupRolesDialogRoles(groupId: string) {
    const groupStore = useGroupStore();
    const D = groupStore.groupRolesDialog;
    D.loading = true;
    try {
        if (!canEditGroupRoles(D.groupRef)) {
            const args = await groupRequest.getGroup({ groupId, includeRoles: true });
            if (D.id !== args.params.groupId) {
                return;
            }
            D.groupRef = args.ref;




            setGroupRolesDialogRoles(args.ref.roles);
            await loadViewOnlyGroupPermissions(groupId);
            return;
        }
        const args = await groupRequest.getGroupRoles({ groupId });
        if (D.id !== args.params.groupId) {
            return;
        }
        setGroupRolesDialogRoles(args.json.map((role) => sanitizeEntityJson(role, ['name', 'description'])));
    } finally {
        D.loading = false;
    }
}

/**
 * @param {object} groupRef
 * @returns {boolean}
 */
function canEditGroupRoles(groupRef: object) {
    return (
        hasGroupPermission(groupRef, 'group-roles-manage') || hasGroupPermission(groupRef, 'group-default-role-manage')
    );
}

/**
 * @param {Array} roles
 */
function setGroupRolesDialogRoles(roles: Array<any>) {
    const groupStore = useGroupStore();
    const D = groupStore.groupRolesDialog;




    D.roles = [...roles].sort((a, b) => a.order - b.order);
}

/**
 * @param {string} groupId
 * @returns {Promise<void>} Jank to load group permission list from another group
 */
async function loadViewOnlyGroupPermissions(groupId: string) {
    const groupStore = useGroupStore();
    const D = groupStore.groupRolesDialog;
    const managedGroup = Array.from(groupStore.currentUserGroups.values()).find((group) =>
        hasGroupPermission(group, 'group-roles-manage')
    );
    if (managedGroup) {
        try {
            const args = await groupRequest.getGroupPermissionList({ groupId: managedGroup.id });
            if (D.id !== groupId) {
                return;
            }




            D.permissions = args.json.map((permission) => ({ ...permission, allowedToAdd: false }));
            return;
        } catch (error) {
            console.error('Failed to load group permission list:', error);
        }
    }
    if (D.id !== groupId) {
        return;
    }
    const permissionNames = new Set();
    for (const role of D.roles) {
        for (const permission of (role as any).permissions) {
            permissionNames.add(permission);
        }
    }




    D.permissions = Array.from(permissionNames)
        .sort()
        .map((name) => ({ name, allowedToAdd: false }));
}

/**
 * @param groupId
 */
export function showGroupRolesDialog(groupId: string) {
    const uiStore = useUiStore();
    const groupStore = useGroupStore();
    uiStore.openDialog({
        type: 'group-roles',
        id: groupId
    });
    const D = groupStore.groupRolesDialog;
    if (D.id !== groupId) {
        D.roles = [];
        D.permissions = [];
        D.selectedRoleId = '';
    }
    D.id = groupId;
    D.groupRef = {};
    D.loading = true;
    queryRequest
        .fetch('group.dialog', { groupId, includeRoles: true })
        .then((args) => {
            if (D.id !== groupId) {
                return;
            }
            D.groupRef = (args as any).ref;
            uiStore.setDialogCrumbLabel('group-roles', D.id, (D.groupRef as any)?.name || D.id);
            if (!canEditGroupRoles(D.groupRef)) {
                setGroupRolesDialogRoles((D.groupRef as any).roles);
                loadViewOnlyGroupPermissions(groupId).finally(() => {
                    D.loading = false;
                });
                return;
            }
            loadGroupRolesDialogRoles(groupId);
            groupRequest.getGroupPermissionList({ groupId }).then((args) => {
                if (D.id !== args.params.groupId) {
                    return;
                }




                D.permissions = args.json;
            });
        })
        .catch((error) => {
            D.loading = false;
            throw error;
        });
    D.visible = true;
}

/**
 * @param groupId
 */
export function getGroupDialogCalendar(groupId: any) {
    const groupStore = useGroupStore();
    const D = groupStore.groupDialog;
    queryRequest.fetch('groupCalendar', { groupId }).then((args) => {
        if (D.id === (args as any).params.groupId) {
            D.calendar = (args as any).json.results;
            for (const event of D.calendar) {
                Object.assign(event, groupStore.applyGroupEvent(event));
                // fetch again for isFollowing
queryRequest
    .fetch('groupCalendarEvent', {
    groupId,
    eventId: (event as any).id
})
    .then((args) => {
    Object.assign(event, groupStore.applyGroupEvent((args as any).json));
});
            }
        }
    });
}

/**
 * @param groupId
 * @param {object} [existingRef]
 * @returns {Promise<object>}
 */
export function getGroupDialogGroup(groupId: any, existingRef?: object) {
    const groupStore = useGroupStore();
    const instanceStore = useInstanceStore();
    const D = groupStore.groupDialog;
    D.isGetGroupDialogGroupLoading = false;

    const refPromise = existingRef
    ? Promise.resolve({ ref: existingRef, args: undefined })
    : queryRequest
        .fetch('group.dialog', { groupId, includeRoles: true })
        .then((args) => ({ ref: applyGroup((args as any).json), args }));

    return refPromise
        .catch((err) => {
            throw err;
        })
        .then((result) => {
            const ref = result.ref;
            if (D.id === ref.id) {
                D.loading = false;
                D.ref = ref;
                D.inGroup = ref.membershipStatus === 'member';
                D.memberRoles = [];
                for (const role of ref.roles) {
                    if (
                        D.ref &&
    (D.ref as any).myMember &&
    Array.isArray((D.ref as any).myMember.roleIds) &&
    (D.ref as any).myMember.roleIds.includes(role.id)
                    ) {




                        D.memberRoles.push(role);
                    }
                }
                groupStore.getAllGroupPosts({
                    groupId
                });
                D.isGetGroupDialogGroupLoading = true;
                groupRequest
                    .getGroupInstances({
                        groupId
                    })
                    .then((args) => {
                        if (groupStore.groupDialog.id === args.params.groupId) {
                            instanceStore.applyGroupDialogInstances(args.json.instances);
                        }




                        for (const json of args.json.instances) {
                            instanceStore.applyInstance(json);
                            queryRequest
                                .fetch('world.dialog', {
                                    worldId: json.world.id
                                })
                                .then((args1) => {
                                    json.world = (args1 as any).ref;
                                });
                            // get queue size etc
                            instanceRequest.getInstance({
                                worldId: json.worldId,
                                instanceId: json.instanceId
                            });
                        }
                    });
                getGroupDialogCalendar(groupId);
            }
            nextTick(() => (D.isGetGroupDialogGroupLoading = false));
            return result.args || result;
        });
}

/**
 * @param {object} ref
 */
export function applyPresenceGroups(ref: object) {
    const groupStore = useGroupStore();
    if (!groupStore.currentUserGroupsInit) {
        // wait for init before diffing
        return;
    }
    const groups = (ref as any).presence?.groups;
    if (!groups) {
        console.error('applyPresenceGroups: invalid groups', ref);
        return;
    }
    if (groups.length === 0) {
        // as it turns out, this is not the most trust worthly source of info
        return;
    }

    // update group list
    for (const groupId of groups) {
        if (!groupStore.currentUserGroups.has(groupId)) {
            onGroupJoined(groupId);
        }
    }
    for (const groupId of groupStore.currentUserGroups.keys()) {
        if (!groups.includes(groupId)) {
            onGroupLeft(groupId);
        }
    }
}

/**
 * @param {string} groupId
 */
export function onGroupJoined(groupId: string) {
    const groupStore = useGroupStore();
    if (!groupStore.currentUserGroups.has(groupId)) {
        groupStore.currentUserGroups.set(groupId, {
            id: groupId,
            name: '',
            iconUrl: ''
        });
        syncGroupSearchIndex({
            id: groupId,
            name: '',
            ownerId: '',
            iconUrl: ''
        });
        groupRequest.getGroup({ groupId, includeRoles: true }).then((args) => {
            applyGroup(args.json);
            saveCurrentUserGroups();
            return args;
        });
    }
}

/**
 * @param {string} groupId
 */
export async function onGroupLeft(groupId: string) {
    const groupStore = useGroupStore();
    const args = await groupRequest.getGroup({ groupId });
    const ref = applyGroup(args.json);
    if (ref.membershipStatus === 'member') {
        // wtf, not trusting presence
        console.error(`onGroupLeft: presence lied, still a member of ${groupId}`);
        return;
    }
    if (groupStore.groupDialog.visible && groupStore.groupDialog.id === groupId) {
        showGroupDialog(groupId);
    }
    if (groupStore.currentUserGroups.has(groupId)) {
        groupStore.currentUserGroups.delete(groupId);
        removeGroupSearchIndex(groupId);
        groupChange(ref, 'Left group');

        // delay to wait for json to be assigned to ref
        workerTimers.setTimeout(() => saveCurrentUserGroups(), 100);
    }
}

export function saveCurrentUserGroups() {
    const groupStore = useGroupStore();
    const userStore = useUserStore();
    if (!groupStore.currentUserGroupsInit) {
        return;
    }
    const groups = [];
    for (const ref of groupStore.currentUserGroups.values()) {
        groups.push({
            id: ref.id,
            name: ref.name,
            ownerId: ref.ownerId,
            iconUrl: ref.iconUrl,
            roles: ref.roles,
            roleIds: ref.myMember?.roleIds
        });
    }
    configRepository.setString(`VRCX_currentUserGroups_${userStore.currentUser.id}`, JSON.stringify(groups));
}

/**
 * @param userId
 * @param groups
 */
export async function loadCurrentUserGroups(userId: string, groups: any) {
    const groupStore = useGroupStore();
    const savedGroups = JSON.parse(await configRepository.getString(`VRCX_currentUserGroups_${userId}`, '[]'));
    groupStore.cachedGroups.clear();
    groupStore.currentUserGroups.clear();
    clearGroupSearchIndex();
    for (const group of savedGroups) {
        const json = {
            id: group.id,
            name: group.name,
            iconUrl: group.iconUrl,
            ownerId: group.ownerId,
            roles: group.roles,
            myMember: {
                roleIds: group.roleIds
            }
        };
        const ref = applyGroup(json);
        groupStore.currentUserGroups.set(group.id, ref);
        syncGroupSearchIndex(ref);
    }

    if (groups) {
        const promises = groups.map(async (groupId: any) => {
            const groupRef = groupStore.cachedGroups.get(groupId);

            if (typeof groupRef !== 'undefined' && groupRef.roles?.length > 0) {
                return;
            }

            try {
                console.log(`Fetching group with missing roles ${groupId}`);
                const args = await groupRequest.getGroup({
                    groupId,
                    includeRoles: true
                });
                const ref = applyGroup(args.json);
                groupStore.currentUserGroups.set(groupId, ref);
                syncGroupSearchIndex(ref);
            } catch (err) {
                console.error(err);
            }
        });

        await Promise.allSettled(promises);
    }

    groupStore.setCurrentUserGroupsInit(true);
    getCurrentUserGroups();
}

export async function getCurrentUserGroups() {
    const groupStore = useGroupStore();
    const userStore = useUserStore();
    const args = await groupRequest.getGroups({
        userId: userStore.currentUser.id
    });
    handleGroupList(args);
    groupStore.currentUserGroups.clear();
    clearGroupSearchIndex();
    for (const group of args.json) {
        const ref = applyGroup(group);
        if (!groupStore.currentUserGroups.has(group.id)) {
            groupStore.currentUserGroups.set(group.id, ref);
            syncGroupSearchIndex(ref);
        }
    }
    const args1 = await groupRequest.getGroupPermissions({
        userId: userStore.currentUser.id
    });
    handleGroupPermissions(args1);
    saveCurrentUserGroups();
}

export function getCurrentUserRepresentedGroup() {
    const userStore = useUserStore();
    return groupRequest
        .getRepresentedGroup({
            userId: userStore.currentUser.id
        })
        .then((args) => {
            handleGroupRepresented(args);
            return args;
        });
}

export async function initUserGroups() {
    const userStore = useUserStore();
    updateInGameGroupOrder();
    loadCurrentUserGroups(userStore.currentUser.id, userStore.currentUser?.presence?.groups);
}

export async function updateInGameGroupOrder() {
    const groupStore = useGroupStore();
    const gameStore = useGameStore();
    const userStore = useUserStore();
    groupStore.setInGameGroupOrder([]);
    try {
        const json = await gameStore.getVRChatRegistryKey(`VRC_GROUP_ORDER_${userStore.currentUser.id}`);
        if (!json) {
            return;
        }
        groupStore.setInGameGroupOrder(JSON.parse(String(json)));
    } catch (err) {
        console.error(err);
    }
}

/**
 * @param {object} group
 * @param {string} userId
 * @returns {boolean}
 */
export function isSoleGroupOwner(group: object, userId: string) {
    return (group as any)?.ownerId === userId && typeof (group as any).memberCount === 'number' && (group as any).memberCount <= 1;
}

/**
 * @param groupId
 */
export function leaveGroup(groupId: any) {
    const groupStore = useGroupStore();
    const userStore = useUserStore();
    const group = groupStore.cachedGroups.get(groupId) ?? groupStore.currentUserGroups.get(groupId);
    const deleteOwnedGroup = isSoleGroupOwner(group, userStore.currentUser.id);
    const request = deleteOwnedGroup
        ? groupRequest.deleteGroup({
              groupId,
              hardDelete: false
          })
        : groupRequest.leaveGroup({
              groupId
          });
    return request.then((args) => {
        const groupId = args.params.groupId;
        if (groupStore.groupDialog.visible && groupStore.groupDialog.id === groupId) {
            if (deleteOwnedGroup) {
                groupStore.groupDialog.visible = false;
            } else {
                groupStore.groupDialog.inGroup = false;
                getGroupDialogGroup(groupId);
            }
        }
        if (deleteOwnedGroup) {
            groupStore.currentUserGroups.delete(groupId);
            groupStore.cachedGroups.delete(groupId);
            removeGroupSearchIndex(groupId);
            saveCurrentUserGroups();
        }
        if (
            userStore.userDialog.visible &&
            userStore.userDialog.id === userStore.currentUser.id &&
            userStore.userDialog.representedGroup.id === groupId
        ) {
            getCurrentUserRepresentedGroup();
        }
    });
}

/**
 * @param groupId
 */
export function leaveGroupPrompt(groupId: any) {
    const t = i18n.global.t;
    const modalStore = useModalStore();
    const groupStore = useGroupStore();
    const userStore = useUserStore();
    const group = groupStore.currentUserGroups.get(groupId) ?? groupStore.cachedGroups.get(groupId);
    const deleteOwnedGroup = isSoleGroupOwner(group, userStore.currentUser.id);
    modalStore
        .confirm({
            description: deleteOwnedGroup ? t('confirm.delete_group', { name: group.name }) : t('confirm.leave_group'),
            title: t('confirm.title'),
            destructive: true
        })
        .then(({ ok }) => {
            if (!ok) return;
            leaveGroup(groupId);
        })
        .catch(() => {});
}

/**
 * @param groupId
 * @param visibility
 */
export function setGroupVisibility(groupId: string, visibility: any) {
    const t = i18n.global.t;
    const userStore = useUserStore();
    return groupRequest
        .setGroupMemberProps(userStore.currentUser.id, groupId, {
            visibility
        })
        .then((args) => {
            handleGroupMemberProps(args);
            toast.success(t('message.group.visibility_updated'));
            return args;
        });
}

/**
 * @param groupId
 * @param subscribe
 */
export function setGroupSubscription(groupId: string, subscribe: any) {
    const t = i18n.global.t;
    const userStore = useUserStore();
    return groupRequest
        .setGroupMemberProps(userStore.currentUser.id, groupId, {
            isSubscribedToAnnouncements: subscribe
        })
        .then((args) => {
            handleGroupMemberProps(args);
            toast.success(t('message.group.subscription_updated'));
            return args;
        });
}

/**
 * @param groupId
 * @param subscribeToEventAnnouncements
 */
export function setGroupEventAnnouncements(groupId: string, subscribe: any) {
    const t = i18n.global.t;
    const userStore = useUserStore();
    return groupRequest
        .setGroupMemberProps(userStore.currentUser.id, groupId, {
            isSubscribedToEventAnnouncements: subscribe
        })
        .then((args) => {
            handleGroupMemberProps(args);
            toast.success(t('message.group.event_announcement_updated'));
            return args;
        });
}

// ─── Event handlers ──────────────────────────────────────────────────────────

/**
 * @param args
 */
export function handleGroupRepresented(args: { json?: any; params?: any; cache?: boolean; }) {
    const userStore = useUserStore();
    const D = userStore.userDialog;
    const json = args.json;
    D.representedGroup = json;
    D.representedGroup.$thumbnailUrl = convertFileUrlToImageUrl(json.iconUrl);
    if (!json || !json.isRepresenting) {
        D.isRepresentedGroupLoading = false;
    }
    if (!json.groupId) {
        // no group
        return;
    }
    if (args.params.userId !== userStore.currentUser.id) {
        // not current user, don't apply someone elses myMember
        return;
    }
    json.$memberId = json.id;
    json.id = json.groupId;
    applyGroup(json);
}

/**
 * @param args
 */
export function handleGroupList(args: { json: any; params?: any; }) {
    for (const json of args.json) {
        json.$memberId = json.id;
        json.id = json.groupId;
        applyGroup(json);
    }
}

/**
 * @param args
 */
export function handleGroupMemberProps(args: { json: any; userId: any; groupId?: string; params?: UpdateGroupMemberRequest; }) {
    const groupStore = useGroupStore();
    const userStore = useUserStore();
    if (args.userId === userStore.currentUser.id) {
        const json = args.json;
        json.$memberId = json.id;
        json.id = json.groupId;
        if (groupStore.groupDialog.visible && groupStore.groupDialog.id === json.groupId) {
            (groupStore.groupDialog.ref as any).myMember.visibility = json.visibility;
            (groupStore.groupDialog.ref as any).myMember.isSubscribedToAnnouncements = json.isSubscribedToAnnouncements;
            (groupStore.groupDialog.ref as any).myMember.isSubscribedToEventAnnouncements =
    json.isSubscribedToEventAnnouncements;
        }
        if (userStore.userDialog.visible && userStore.userDialog.id === userStore.currentUser.id) {
            getCurrentUserRepresentedGroup();
        }
        handleGroupMember({
            json,
            params: {
                groupId: json.groupId
            }
        });
    }
    let member;
    if (groupStore.groupDialog.id === args.json.groupId) {
        let i;
        for (i = 0; i < groupStore.groupDialog.members.length; ++i) {
            member = groupStore.groupDialog.members[i];
            if ((member as any).userId === args.json.userId) {
                Object.assign(member, applyGroupMember(args.json));
                break;
            }
        }
        for (i = 0; i < groupStore.groupDialog.memberSearchResults.length; ++i) {
            member = groupStore.groupDialog.memberSearchResults[i];
            if ((member as any).userId === args.json.userId) {
                Object.assign(member, applyGroupMember(args.json));
                break;
            }
        }
    }
}

/**
 * @param args
 */
export function handleGroupPermissions(args: { json: any; params: any; }) {
    const groupStore = useGroupStore();
    const userStore = useUserStore();
    if (args.params.userId !== userStore.currentUser.id) {
        return;
    }
    const json = args.json;
    for (const groupId in json) {
        const permissions = json[groupId];
        const group = groupStore.cachedGroups.get(groupId);
        if (group) {
            group.myMember.permissions = permissions;
        }
    }
}

/**
 * @param args
 */
export function handleGroupMember(args: { json: any; params?: { groupId: any; } | { groupId: any; }; ref?: any; }) {
    args.ref = applyGroupMember(args.json);
}

/**
 * @param args
 */
export async function handleGroupUserInstances(args: { json: any; }) {
    const groupStore = useGroupStore();
    const instanceStore = useInstanceStore();
    groupStore.setGroupInstances([]);
    for (const json of args.json.instances) {
        if (args.json.fetchedAt) {
            // tack on fetchedAt
            json.$fetchedAt = args.json.fetchedAt;
        }
        const instanceRef = instanceStore.applyInstance(json);
        const groupRef = groupStore.cachedGroups.get(json.ownerId);
        if (typeof groupRef === 'undefined') {
            if (watchState.isFriendsLoaded) {
                const args = await groupRequest.getGroup({
                    groupId: json.ownerId
                });
                applyGroup(args.json);
            }
            return;
        }




        groupStore.groupInstances.push({
            group: groupRef,
            instance: instanceRef
        });
    }
}
