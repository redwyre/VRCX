import { reactive, ref, watch } from 'vue';
import { defineStore } from 'pinia';

import { replaceBioSymbols } from '../shared/utils';
import { groupRequest } from '../api';
import { initUserGroups } from '../coordinators/groupCoordinator';
import { watchState } from '../services/watchState';
import type { VrcxGroup, VrcxGroupPost, VrcxUser } from '../types/vrcx';

export const useGroupStore = defineStore('Group', () => {
    let cachedGroups = new Map();

    const groupDialog = ref({
        visible: false,
        loading: false,
        activeTab: 'Info',
        lastActiveTab: 'Info',
        isGetGroupDialogGroupLoading: false,
        id: '',
        inGroup: false,
        ownerDisplayName: '',
        ref: {} as VrcxGroup,
        announcement: {} as VrcxGroupPost,
        posts: [] as VrcxGroupPost[],
        postsFiltered: [],
        calendar: [],
        members: [],
        memberSearch: '',
        memberSearchResults: [],
        instances: [],
        memberRoles: [],
        lastVisit: '',
        joinCount: 0,
        memberFilter: {
            name: 'dialog.group.members.filters.everyone',
            id: null
        },
        memberSortOrder: {
            name: 'dialog.group.members.sorting.joined_at_desc',
            value: 'joinedAt:desc'
        },
        postsSearch: '',
        galleries: {},
        listings: []
    });

    const groupEditDialog = ref({
        visible: false,
        loading: false,
        roleTemplatesLoading: false,
        mode: 'create',
        groupId: '',
        name: '',
        shortCode: '',
        description: '',
        joinState: 'open',
        privacy: 'default',
        roleTemplate: 'default',
        roleTemplates: [],
        languages: [],
        rules: '',
        links: [],
        bannerId: '',
        bannerUrl: '',
        iconId: '',
        iconUrl: '',
        allowGroupJoinPrompt: false
    });

    const groupEventEditDialog = ref({
        visible: false,
        loading: false,
        mode: 'create',
        groupId: '',
        eventId: '',
        groupRef: {} as VrcxGroup,
        startsAt: '',
        endsAt: '',
        title: '',
        accessType: 'group',
        description: '',
        category: 'other',
        tags: [],
        imageId: '',
        imageUrl: '',
        roleIds: [],
        parentId: null,
        platforms: [],
        languages: [],
        sendCreationNotification: false,
        hostEarlyJoinMinutes: 60,
        guestEarlyJoinMinutes: 5,
        closeInstanceAfterEndMinutes: 5,
        seriesId: null,
        recurrence: null
    });
    const groupEventRevision = ref(0);

    const currentUserGroups = reactive(new Map());

    const inviteGroupDialog = ref({
        visible: false,
        loading: false,
        groupId: '',
        groupName: '',
        userId: '',
        userIds: [],
        userObject: {
            id: '',
            displayName: '',
            $userColour: ''
        }
    });

    const moderateGroupDialog = ref({
        visible: false,
        groupId: '',
        groupName: '',
        userId: '',
        userObject: {} as VrcxUser
    });

    const groupMemberModeration = ref({
        visible: false,
        loading: false,
        id: '',
        groupRef: {} as VrcxGroup,
        auditLogTypes: [],
        openWithUserId: '',
        activeTab: '',
        activeInviteTab: '',
        selectedUsers: {},
        selectedUsersArray: [],
        tables: {
            members: {
                data: [],
                pageSize: 15,
                pageIndex: 0
            },
            bans: {
                data: [],
                pageSize: 15,
                pageIndex: 0,
                filters: [{ prop: ['$displayName'], value: '' }]
            },
            invites: {
                data: [],
                pageSize: 15,
                pageIndex: 0
            },
            joinRequests: {
                data: [],
                pageSize: 15,
                pageIndex: 0
            },
            blocked: {
                data: [],
                pageSize: 15,
                pageIndex: 0
            },
            logs: {
                data: [],
                pageSize: 15,
                pageIndex: 0,
                filters: [{ prop: ['description'], value: '' }]
            }
        }
    });

    const groupRolesDialog = ref({
        visible: false,
        loading: false,
        id: '',
        groupRef: {} as VrcxGroup,
        roles: [],
        permissions: [],
        selectedRoleId: ''
    });

    const inGameGroupOrder = ref([]);

    const groupInstances = ref([]);

    const currentUserGroupsInit = ref(false);

    watch(
        () => watchState.isLoggedIn,
        (isLoggedIn) => {
            groupDialog.value.visible = false;
            groupEditDialog.value.visible = false;
            groupEventEditDialog.value.visible = false;
            inviteGroupDialog.value.visible = false;
            moderateGroupDialog.value.visible = false;
            groupMemberModeration.value.visible = false;
            groupRolesDialog.value.visible = false;
            currentUserGroupsInit.value = false;
            cachedGroups.clear();
            currentUserGroups.clear();
            if (isLoggedIn) {
                initUserGroups();
            }
        },
        { flush: 'sync' }
    );

    /**
     * @param {{ groupId: string }} params
     * @returns {Promise<{ posts: any; params }>}
     */
    async function getAllGroupPosts(params: { groupId: string }) {
        const n = 100;
        const posts = [];
        let offset = 0;
        let total = Infinity;
        let pages = 0;
        do {
            const args = await groupRequest.getGroupPosts({
                groupId: params.groupId,
                n,
                offset
            });
            const pagePosts = args.json?.posts ?? [];
            total = Number(args.json?.total ?? pagePosts.length);
            posts.push(...pagePosts);
            offset += n;
            pages += 1;
            if (pagePosts.length === 0) {
                break;
            }
        } while (offset < total && pages < 50);
        const returnArgs = {
            posts,
            params
        };
        const D = groupDialog.value;
        if (D.id === params.groupId) {
            for (const post of posts) {
                post.title = replaceBioSymbols(post.title);

                post.text = replaceBioSymbols(post.text);
            }
            D.announcement = posts[0] ?? {};

            D.posts = posts;
            updateGroupPostSearch();
        }

        return returnArgs;
    }

    /**
     * @param event
     */
    function applyGroupEvent(event: { title: string; description: string }) {
        return {
            userInterest: {
                createdAt: null,
                isFollowing: false,
                updatedAt: null
            },
            ...event,
            title: replaceBioSymbols(event.title),
            description: replaceBioSymbols(event.description)
        };
    }

    /**
     * @param a
     * @param b
     */
    function sortGroupInstancesByInGame(a: { group: { id: any } }, b: { group: { id: any } }) {
        const aIndex = inGameGroupOrder.value.indexOf(a?.group?.id);

        const bIndex = inGameGroupOrder.value.indexOf(b?.group?.id);
        if (aIndex === -1 && bIndex === -1) {
            return 0;
        }
        if (aIndex === -1) {
            return 1;
        }
        if (bIndex === -1) {
            return -1;
        }
        return aIndex - bIndex;
    }

    function updateGroupPostSearch() {
        const D = groupDialog.value;
        const search = D.postsSearch.toLowerCase();
        D.postsFiltered = D.posts.filter((post) => {
            if (search === '') {
                return true;
            }
            if ((post as any).title.toLowerCase().includes(search)) {
                return true;
            }
            if ((post as any).text.toLowerCase().includes(search)) {
                return true;
            }
            return false;
        });
    }

    /**
     * @param {object} args
     */
    function handleGroupPost(args: object) {
        const D = groupDialog.value;
        if (D.id !== (args as any).params.groupId) {
            return;
        }

        const newPost = (args as any).json;
        newPost.title = replaceBioSymbols(newPost.title);
        newPost.text = replaceBioSymbols(newPost.text);
        let hasPost = false;
        // update existing post
        for (const post of D.posts) {
            if ((post as any).id === newPost.id) {
                Object.assign(post, newPost);
                hasPost = true;
                break;
            }
        }
        // set or update announcement
        if (newPost.id === (D.announcement as any).id || !(D.announcement as any).id) {
            D.announcement = newPost;
        }
        // add new post
        if (!hasPost) {
            D.posts.unshift(newPost);
        }
        updateGroupPostSearch();
    }

    function clearGroupInstances() {
        groupInstances.value = [];
    }

    /**
     * @param {boolean} value
     */
    function setGroupDialogVisible(value: boolean) {
        groupDialog.value.visible = value;
    }

    /**
     * @param userId
     */
    function showModerateGroupDialog(userId: string) {
        const D = moderateGroupDialog.value;
        D.userId = userId;
        D.userObject = {} as VrcxUser;
        D.visible = true;
    }

    /**
     * @param {boolean} value
     */
    function setGroupMemberModerationVisible(value: boolean) {
        groupMemberModeration.value.visible = value;
    }

    /**
     * @param {boolean} value
     */
    function setGroupRolesDialogVisible(value: boolean) {
        groupRolesDialog.value.visible = value;
    }

    /**
     * @param {boolean} value
     */
    function setCurrentUserGroupsInit(value: boolean) {
        currentUserGroupsInit.value = value;
    }

    /**
     * @param {Array} value
     */
    function setInGameGroupOrder(value: Array<any>) {
        inGameGroupOrder.value = value;
    }

    /**
     * @param {Array} value
     */
    function setGroupInstances(value: Array<any>) {
        groupInstances.value = value;
    }

    function resetGroupEditDialog() {
        groupEditDialog.value = {
            visible: false,
            loading: false,
            roleTemplatesLoading: false,
            mode: 'create',
            groupId: '',
            name: '',
            shortCode: '',
            description: '',
            joinState: 'open',
            privacy: 'default',
            roleTemplate: 'default',
            roleTemplates: [],
            languages: [],
            rules: '',
            links: [],
            bannerId: '',
            bannerUrl: '',
            iconId: '',
            iconUrl: '',
            allowGroupJoinPrompt: false
        };
    }

    async function showCreateGroupDialog() {
        resetGroupEditDialog();
        const D = groupEditDialog.value;
        D.visible = true;
        D.roleTemplatesLoading = true;
        try {
            const args = await groupRequest.getRoleTemplates();

            D.roleTemplates = Array.isArray(args.json)
                ? args.json
                : Object.entries(args.json ?? {}).map(([value, template]) => ({
                      value,
                      ...(typeof template === 'object' && template !== null ? template : {})
                  }));
        } finally {
            D.roleTemplatesLoading = false;
        }
    }

    /**
     * @param {object} group
     */
    function showEditGroupDialog(group: object) {
        resetGroupEditDialog();
        groupEditDialog.value = {
            visible: true,
            loading: false,
            roleTemplatesLoading: false,
            mode: 'edit',
            groupId: (group as any).id,
            name: (group as any).name,
            shortCode: (group as any).shortCode,
            description: (group as any).description,
            joinState: (group as any).joinState ?? 'open',
            privacy: (group as any).privacy ?? 'default',
            roleTemplate: (group as any).roleTemplate ?? 'default',

            roleTemplates: Array.isArray((group as any).roleTemplates) ? [...(group as any).roleTemplates] : [],

            languages: Array.isArray((group as any).languages) ? [...(group as any).languages] : [],
            rules: (group as any).rules,

            links: Array.isArray((group as any).links) ? [...(group as any).links] : [],
            bannerId: (group as any).bannerId,
            bannerUrl: (group as any).bannerUrl,
            iconId: (group as any).iconId,
            iconUrl: (group as any).iconUrl,
            allowGroupJoinPrompt: !!(group as any).allowGroupJoinPrompt
        };
    }

    function resetGroupEventEditDialog() {
        const startsAt = new Date();
        startsAt.setMinutes(0, 0, 0);
        startsAt.setHours(startsAt.getHours() + 1);
        const endsAt = new Date(startsAt);
        endsAt.setHours(endsAt.getHours() + 2);
        groupEventEditDialog.value = {
            visible: false,
            loading: false,
            mode: 'create',
            groupId: '',
            eventId: '',
            groupRef: {} as VrcxGroup,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            title: '',
            accessType: 'group',
            description: '',
            category: 'other',
            tags: [],
            imageId: '',
            imageUrl: '',
            roleIds: [],
            parentId: null,
            platforms: [],
            languages: [],
            sendCreationNotification: false,
            hostEarlyJoinMinutes: 60,
            guestEarlyJoinMinutes: 5,
            closeInstanceAfterEndMinutes: 5,
            seriesId: null,
            recurrence: null
        };
    }

    /**
     * @param {object} group
     */
    function showCreateGroupEventDialog(group: object) {
        resetGroupEventEditDialog();
        groupEventEditDialog.value = {
            ...groupEventEditDialog.value,
            visible: true,
            groupId: (group as any).id,
            groupRef: group as VrcxGroup
        };
    }

    /**
     * @param {object} event
     * @param {object} group
     */
    function showEditGroupEventDialog(event: object, group: object) {
        resetGroupEventEditDialog();
        groupEventEditDialog.value = {
            visible: true,
            loading: false,
            mode: 'edit',
            groupId: (event as any).ownerId,
            eventId: (event as any).id,
            groupRef: group as VrcxGroup,
            startsAt: (event as any).startsAt,
            endsAt: (event as any).endsAt,
            title: (event as any).title ?? '',
            accessType: (event as any).accessType ?? 'group',
            description: (event as any).description ?? '',
            category: (event as any).category ?? 'other',

            tags: Array.isArray((event as any).tags) ? [...(event as any).tags] : [],
            imageId: (event as any).imageId ?? '',
            imageUrl: (event as any).imageUrl ?? '',

            roleIds: Array.isArray((event as any).roleIds) ? [...(event as any).roleIds] : [],
            parentId: null,

            platforms: Array.isArray((event as any).platforms) ? [...(event as any).platforms] : [],

            languages: Array.isArray((event as any).languages) ? [...(event as any).languages] : [],
            sendCreationNotification: false,
            hostEarlyJoinMinutes: (event as any).hostEarlyJoinMinutes ?? 60,
            guestEarlyJoinMinutes: (event as any).guestEarlyJoinMinutes ?? 5,
            closeInstanceAfterEndMinutes: (event as any).closeInstanceAfterEndMinutes ?? 5,
            seriesId: (event as any).seriesId,
            recurrence: (event as any).recurrence
        };
    }

    function markGroupEventMutation() {
        groupEventRevision.value++;
    }

    return {
        groupDialog,
        groupEditDialog,
        groupEventEditDialog,
        groupEventRevision,
        currentUserGroups,
        inviteGroupDialog,
        moderateGroupDialog,
        groupMemberModeration,
        groupRolesDialog,
        cachedGroups,
        inGameGroupOrder,
        groupInstances,
        currentUserGroupsInit,
        getAllGroupPosts,
        applyGroupEvent,
        sortGroupInstancesByInGame,
        updateGroupPostSearch,
        handleGroupPost,
        clearGroupInstances,
        setGroupDialogVisible,
        showModerateGroupDialog,
        setGroupMemberModerationVisible,
        setGroupRolesDialogVisible,
        setCurrentUserGroupsInit,
        setInGameGroupOrder,
        setGroupInstances,
        showCreateGroupDialog,
        showEditGroupDialog,
        showCreateGroupEventDialog,
        showEditGroupEventDialog,
        markGroupEventMutation
    };
});
