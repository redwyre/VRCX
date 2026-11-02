import { ref } from 'vue';
import { toast } from 'vue-sonner';

import { debounce, mergeGroupMemberSearchResults } from '../../../shared/utils';
import { queryRequest } from '../../../api';

import * as workerTimers from 'worker-timers';

/**
 * Composable for group moderation data fetching, member management,
 * searching, sorting and filtering.
 *
 * @param {object} deps
 * @param {import('vue').Ref} deps.groupMemberModeration - Store ref
 * @param {import('vue').Ref} deps.currentUser - Store ref
 * @param {Function} deps.applyGroupMember - Store action
 * @param {Function} deps.handleGroupMember - Store action
 * @param {object} deps.tables - Reactive table data objects
 * @param {object} deps.tables.members
 * @param {object} deps.tables.bans
 * @param {object} deps.tables.invites
 * @param {object} deps.tables.joinRequests
 * @param {object} deps.tables.blocked
 * @param {object} deps.tables.logs
 * @param {object} deps.selection - From useGroupModerationSelection
 * @param {object} deps.selection.selectedUsers
 * @param {Function} deps.selection.setSelectedUsers
 * @param {object} deps.groupRequest - API module
 */
export function useGroupModerationData(deps: {
    groupMemberModeration: import('vue').Ref;
    currentUser: import('vue').Ref;
    applyGroupMember: Function;
    handleGroupMember: Function;
    tables: {
        members: object;
        bans: object;
        invites: object;
        joinRequests: object;
        blocked: object;
        logs: object;
    };
    selection: {
        selectedUsers: object;
        setSelectedUsers: Function;
    };
    groupRequest: object;
}) {
    const { groupMemberModeration, currentUser, applyGroupMember, handleGroupMember, tables, selection, groupRequest } =
        deps;

    const isGroupMembersLoading = ref(false);
    const isGroupMembersDone = ref(false);
    const memberFilter = ref({
        id: null,
        name: 'dialog.group.members.filters.everyone'
    });
    const memberSortOrder = ref({
        id: '',
        name: 'dialog.group.members.sorting.joined_at_desc',
        value: 'joinedAt:desc'
    });
    const memberSearch = ref('');
    const members = ref([]);
    const loadMoreGroupMembersParams = ref({
        n: 100,
        offset: 0,
        groupId: '',
        sort: 'joinedAt:desc',
        roleId: ''
    });

    // ── Members ──────────────────────────────────────────────────

    async function getGroupMembers() {
        members.value = [];
        isGroupMembersDone.value = false;
        loadMoreGroupMembersParams.value = {
            sort: 'joinedAt:desc',
            roleId: '',
            n: 100,
            offset: 0,
            groupId: groupMemberModeration.value.id
        };
        if (memberSortOrder.value.value) {
            loadMoreGroupMembersParams.value.sort = memberSortOrder.value.value;
        }
        if (memberFilter.value.id !== null) {
            loadMoreGroupMembersParams.value.roleId = memberFilter.value.id;
        }
        await (groupRequest as any).getGroupMember({
    groupId: groupMemberModeration.value.id,
    userId: currentUser.value.id
})
    .then((args: {
    ref: any;
    json: {
        user: any;
    };
}) => {
    args.ref = applyGroupMember(args.json);
    if (args.json) {
        args.json.user = currentUser.value;
        if (memberFilter.value.id === null) {




            members.value.push(args.json);
        }
    }
    return args;
});
        await loadMoreGroupMembers();
    }

    /**
     * @param {object} [options]
     * @param {boolean} [options.preserveSearch] - Keep the active member search when loading more members
     */
    async function loadMoreGroupMembers(options: {
    preserveSearch?: boolean;
} = {}) {
        if (isGroupMembersDone.value || isGroupMembersLoading.value) {
            return;
        }
        const params = loadMoreGroupMembersParams.value;
        if (params.roleId === '') {




            delete params.roleId;
        }
        if (!options.preserveSearch) {
            memberSearch.value = '';
        }
        isGroupMembersLoading.value = true;
        await (groupRequest as any).getGroupMembers(params)
    .finally(() => {
    isGroupMembersLoading.value = false;
})
    .then((args: {
    json: string | any[];
    params: {
        groupId: any;
    };
}) => {
    for (const json of args.json) {
        handleGroupMember({
            json,
            params: { groupId: args.params.groupId }
        });
    }
    for (let i = 0; i < args.json.length; i++) {
        const member = args.json[i];
        if (member.userId === currentUser.value.id) {
            if (members.value.length > 0 && (members.value[0] as any).userId === currentUser.value.id) {
                members.value.splice(0, 1);
            }
            break;
        }
    }
    if (args.json.length < params.n) {
        isGroupMembersDone.value = true;
    }




    members.value = [...members.value, ...args.json];
    if (!options.preserveSearch) {
        (tables.members as any).data = members.value.map((member) => ({




            ...member,
            $selected: Boolean((selection.selectedUsers as any)[(member as any).userId])
        }));
    }
    params.offset += params.n;
    return args;
})
    .catch((err: any) => {
    isGroupMembersDone.value = true;
    throw err;
});
    }

    async function loadAllGroupMembers() {
        if (isGroupMembersLoading.value) {
            return;
        }
        await getGroupMembers();
        while (groupMemberModeration.value.visible && !isGroupMembersDone.value) {
            isGroupMembersLoading.value = true;
            await new Promise((resolve) => {
                workerTimers.setTimeout(resolve, 1000);
            });
            isGroupMembersLoading.value = false;
            await loadMoreGroupMembers();
        }
    }

    /**
     * @param sortOrder
     */
    async function setGroupMemberSortOrder(sortOrder: { id: string; name: string; value: string; }) {
        if (memberSortOrder.value === sortOrder) {
            return;
        }
        memberSortOrder.value = sortOrder;
        await getGroupMembers();
    }

    /**
     * @param filter
     */
    async function setGroupMemberFilter(filter: { id: null; name: string; }) {
        if (memberFilter.value === filter) {
            return;
        }
        memberFilter.value = filter;
        await getGroupMembers();
    }

    let memberSearchRequestId = 0;
    const groupMembersSearchDebounced = debounce(groupMembersSearchRequest, 200);
    const groupMembersSearchMaxPages = 10;

    function groupMembersSearch() {
        memberSearchRequestId += 1;
        if (memberSearch.value.length < 3) {
            (tables.members as any).data = [];
            isGroupMembersLoading.value = false;
            return;
        }
        groupMembersSearchDebounced();
    }

    async function groupMembersSearchRequest() {
        const groupId = groupMemberModeration.value.id;
        const search = memberSearch.value;
        const requestId = memberSearchRequestId;
        (tables.members as any).data = [];
        if (!search || search.length < 3) {
            isGroupMembersLoading.value = false;
            return;
        }
        isGroupMembersLoading.value = true;
        try {
            const args = await (groupRequest as any).getGroupMembersSearch({
    groupId,
    query: search,
    n: 100,
    offset: 0
});
            for (const json of args.json.results) {
                handleGroupMember({
                    json,
                    params: { groupId: args.params.groupId }
                });
            }
            if (
                requestId !== memberSearchRequestId ||
                groupId !== args.params.groupId ||
                search !== memberSearch.value
            ) {
                return;
            }
            const results = mergeGroupMemberSearchResults(args.json.results, members.value, search);
            (tables.members as any).data = results.map((member) => ({
    ...member,
    $selected: Boolean((selection.selectedUsers as any)[member.userId])
}));
            await groupMembersSearchLoadRemaining(requestId, search);
        } catch {
            // ignore search errors, they are reported by the request layer
        } finally {
            if (requestId === memberSearchRequestId) {
                isGroupMembersLoading.value = false;
            }
        }
    }

    async function groupMembersSearchLoadRemaining(requestId: number, search: string) {
        const groupId = groupMemberModeration.value.id;
        for (let page = 0; page < groupMembersSearchMaxPages; ++page) {
            if (
                (tables.members as any).data.length ||
    !groupMemberModeration.value.visible ||
    loadMoreGroupMembersParams.value.groupId !== groupId ||
    requestId !== memberSearchRequestId ||
    search !== memberSearch.value ||
    isGroupMembersDone.value
            ) {
                return;
            }
            isGroupMembersLoading.value = true;
            await new Promise((resolve) => {
                workerTimers.setTimeout(resolve, 1000);
            });
            isGroupMembersLoading.value = false;
            if (
                !groupMemberModeration.value.visible ||
                requestId !== memberSearchRequestId ||
                search !== memberSearch.value ||
                isGroupMembersDone.value
            ) {
                return;
            }
            try {
                await loadMoreGroupMembers({ preserveSearch: true });
            } catch {
                return;
            }
            if (requestId !== memberSearchRequestId || search !== memberSearch.value) {
                return;
            }
            const results = mergeGroupMemberSearchResults((tables.members as any).data, members.value, search);
            (tables.members as any).data = results.map((member) => ({
    ...member,
    $selected: Boolean((selection.selectedUsers as any)[member.userId])
}));
        }
    }

    // ── Bans ─────────────────────────────────────────────────────

    /**
     * @param groupId
     */
    async function getAllGroupBans(groupId: any) {
        (tables.bans as any).data = [];
        const params = { groupId, n: 100, offset: 0 };
        const count = 50; // 5000 max
        isGroupMembersLoading.value = true;
        const fetchedBans: any = [];
        try {
            for (let i = 0; i < count; i++) {
                const args = await (groupRequest as any).getGroupBans(params);
                if (args && args.json) {
                    if (groupMemberModeration.value.id !== args.params.groupId) {
                        continue;
                    }
                    args.json.forEach((json: any) => {
                        const ref = applyGroupMember(json);
                        fetchedBans.push(ref);
                    });
                    if (args.json.length < params.n) {
                        break;
                    }
                    params.offset += params.n;
                } else {
                    break;
                }
                if (!groupMemberModeration.value.visible) {
                    break;
                }
            }
            (tables.bans as any).data = fetchedBans;
        } catch {
            toast.error('Failed to get group bans');
        } finally {
            isGroupMembersLoading.value = false;
        }
    }

    // ── Invites / Join Requests / Blocked ────────────────────────

    /**
     * @param groupId
     */
    async function getAllGroupInvites(groupId: any) {
        (tables.invites as any).data = [];
        const params = { groupId, n: 100, offset: 0 };
        const count = 50; // 5000 max
        isGroupMembersLoading.value = true;
        let newData = [];
        try {
            for (let i = 0; i < count; i++) {
                const args = await (groupRequest as any).getGroupInvites(params);
                if (args) {
                    if (groupMemberModeration.value.id !== args.params.groupId) {
                        return;
                    }
                    for (const json of args.json) {
                        const ref = applyGroupMember(json);
                        newData.push(ref);
                    }
                }
                params.offset += params.n;
                if (args.json.length < params.n) {
                    break;
                }
                if (!groupMemberModeration.value.visible) {
                    break;
                }
            }
            (tables.invites as any).data = newData;
        } catch {
            toast.error('Failed to get group invites');
        } finally {
            isGroupMembersLoading.value = false;
        }
    }

    /**
     * @param groupId
     */
    async function getAllGroupJoinRequests(groupId: any) {
        (tables.joinRequests as any).data = [];
        const params = { groupId, n: 100, offset: 0, blocked: false };
        const count = 50; // 5000 max
        isGroupMembersLoading.value = true;
        let newData = [];
        try {
            for (let i = 0; i < count; i++) {
                const args = await (groupRequest as any).getGroupJoinRequests(params);
                if (groupMemberModeration.value.id !== args.params.groupId) {
                    return;
                }
                for (const json of args.json) {
                    const ref = applyGroupMember(json);
                    newData.push(ref);
                }
                params.offset += params.n;
                if (args.json.length < params.n) {
                    break;
                }
                if (!groupMemberModeration.value.visible) {
                    break;
                }
            }
            (tables.joinRequests as any).data = newData;
        } catch {
            toast.error('Failed to get group join requests');
        } finally {
            isGroupMembersLoading.value = false;
        }
    }

    /**
     * @param groupId
     */
    async function getAllGroupBlockedRequests(groupId: any) {
        (tables.blocked as any).data = [];
        const params = { groupId, n: 100, offset: 0, blocked: true };
        const count = 50; // 5000
        isGroupMembersLoading.value = true;
        let newData = [];
        try {
            for (let i = 0; i < count; i++) {
                const args = await (groupRequest as any).getGroupJoinRequests(params);
                if (groupMemberModeration.value.id !== args.params.groupId) {
                    return;
                }
                for (const json of args.json) {
                    const ref = applyGroupMember(json);
                    newData.push(ref);
                }
                params.offset += params.n;
                if (args.json.length < params.n) {
                    break;
                }
                if (!groupMemberModeration.value.visible) {
                    break;
                }
            }
            (tables.blocked as any).data = newData;
        } catch {
            toast.error('Failed to get group join requests');
        } finally {
            isGroupMembersLoading.value = false;
        }
    }

    /**
     * @param groupId
     */
    async function getAllGroupInvitesAndJoinRequests(groupId: any) {
        try {
            await Promise.all([
                getAllGroupInvites(groupId),
                getAllGroupJoinRequests(groupId),
                getAllGroupBlockedRequests(groupId)
            ]);
        } catch (error) {
            console.error('Error fetching group invites/requests:', error);
        }
    }

    // ── Logs ─────────────────────────────────────────────────────

    /**
     * @param groupId
     * @param eventTypes
     */
    async function getAllGroupLogs(groupId: any, eventTypes = []) {
        (tables.logs as any).data = [];
        const params = { groupId, n: 100, offset: 0 };
        if (eventTypes.length) {
            (params as any).eventTypes = eventTypes;
        }
        const count = 50; // 5000 max
        isGroupMembersLoading.value = true;
        let newData: any = [];
        try {
            for (let i = 0; i < count; i++) {
                const args = await (groupRequest as any).getGroupLogs(params);
                if (args) {
                    if (groupMemberModeration.value.id !== args.params.groupId) {
                        continue;
                    }
                    for (const json of args.json.results) {
                        const existsInData = newData.some((dataItem: { id: any; }) => dataItem.id === json.id);
                        if (!existsInData) {
                            newData.push(json);
                        }
                    }
                }
                params.offset += params.n;
                if (!args.json.hasNext) {
                    break;
                }
                if (!groupMemberModeration.value.visible) {
                    break;
                }
            }
            (tables.logs as any).data = newData;
        } catch {
            toast.error('Failed to get group logs');
        } finally {
            isGroupMembersLoading.value = false;
        }
    }

    // ── User Selection ───────────────────────────────────────────

    /**
     * @param userId
     */
    async function addGroupMemberToSelection(userId: unknown) {
        const D = groupMemberModeration.value;
        let member: { userId?: any; user?: any; displayName?: any } = {};
        const memberArgs = await (groupRequest as any).getGroupMember({
    groupId: D.id,
    userId
});
        if (memberArgs && memberArgs.json) {
            member = applyGroupMember(memberArgs.json);
        }
        if (member && member.user) {
            selection.setSelectedUsers(member.userId, member);
            return;
        }
        const userArgs = await queryRequest.fetch('user.dialog', { userId });
        member.userId = (userArgs as any).json.id;
        member.user = (userArgs as any).json;
        member.displayName = (userArgs as any).json.displayName;
        selection.setSelectedUsers(member.userId, member);
    }

    /**
     * @param userIdInput
     */
    async function selectGroupMemberUserId(userIdInput: any) {
        if (!userIdInput) return;
        const regexUserId = /usr_[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}/g;
        let match;
        const userIdList = new Set();
        while ((match = regexUserId.exec(userIdInput)) !== null) {
            userIdList.add(match[0]);
        }
        if (userIdList.size === 0) {
            userIdList.add(userIdInput);
        }
        const promises: any = [];
        userIdList.forEach((userId) => {
            promises.push(addGroupMemberToSelection(userId));
        });
        await Promise.allSettled(promises);
    }

    // ── Reset ────────────────────────────────────────────────────

    function resetData() {
        (tables.members as any).data = [];
        (tables.bans as any).data = [];
        (tables.invites as any).data = [];
        (tables.joinRequests as any).data = [];
        (tables.blocked as any).data = [];
        (tables.logs as any).data = [];
        memberSearch.value = '';
        members.value = [];
        isGroupMembersDone.value = false;
    }

    return {
        isGroupMembersLoading,
        isGroupMembersDone,
        memberFilter,
        memberSortOrder,
        memberSearch,
        members,
        loadAllGroupMembers,
        getGroupMembers,
        setGroupMemberSortOrder,
        setGroupMemberFilter,
        groupMembersSearch,
        selectGroupMemberUserId,
        addGroupMemberToSelection,
        getAllGroupBans,
        getAllGroupLogs,
        getAllGroupInvites,
        getAllGroupJoinRequests,
        getAllGroupBlockedRequests,
        getAllGroupInvitesAndJoinRequests,
        resetData
    };
}
