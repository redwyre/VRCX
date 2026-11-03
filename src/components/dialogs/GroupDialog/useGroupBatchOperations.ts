import { ref } from 'vue';
import type { Ref } from 'vue';
import { toast } from 'vue-sonner';

/**
 * Composable for batch moderation operations with progress tracking.
 *
 * @param {object} deps
 * @param {Ref} deps.currentUser
 * @param {Ref} deps.groupMemberModeration
 * @param {Function} deps.deselectedUsers
 * @param {object} deps.groupRequest
 * @param {Function} deps.handleGroupMemberRoleChange
 * @param {Function} deps.handleGroupMemberProps
 */
export function useGroupBatchOperations(deps: {
    currentUser: Ref;
    groupMemberModeration: Ref;
    deselectedUsers: Function;
    groupRequest: object;
    handleGroupMemberRoleChange: Function;
    handleGroupMemberProps: Function;
}) {
    const progressCurrent = ref(0);
    const progressTotal = ref(0);

    /**
     * Generic batch operation runner.
     *
     * @param {object} options
     * @param {Function} options.action - Async (user, groupId) => void
     * @param {string} options.logPrefix - E.g. 'Banning'
     * @param {string} options.successMessage - E.g. 'Banned {count} group members'
     * @param {string} options.errorMessage - E.g. 'Failed to ban group member'
     * @param {boolean} [options.skipSelf]
     * @param {Function} [options.onComplete] - Called after the loop finishes
     * @returns {Promise<void>}
     */
    async function runBatchOperation({
        action,
        logPrefix,
        successMessage,
        errorMessage,
        skipSelf = true,
        onComplete
    }: {
        action: Function;
        logPrefix: string;
        successMessage: string;
        errorMessage: string;
        skipSelf?: boolean;
        onComplete?: Function;
    }) {
        const users = [...deps.groupMemberModeration.value.selectedUsersArray];
        const memberCount = users.length;
        const groupId = deps.groupMemberModeration.value.id;
        progressTotal.value = memberCount;
        let allSuccess = true;

        for (let i = 0; i < memberCount; i++) {
            if (!progressTotal.value) break;
            const user = users[i];
            progressCurrent.value = i + 1;

            if (skipSelf && user.userId === deps.currentUser.value.id) continue;

            console.log(`${logPrefix} ${user.userId} ${i + 1}/${memberCount}`);
            try {
                await action(user, groupId);
            } catch (err) {
                console.error(err);
                toast.error(`${errorMessage}: ${err}`);
                allSuccess = false;
            }
        }

        if (allSuccess) {
            toast.success(successMessage.replace('{count}', String(memberCount)));
        }
        progressCurrent.value = 0;
        progressTotal.value = 0;
        deps.deselectedUsers(null, true);
        if (onComplete) onComplete();
    }

    /**
     * @param callbacks
     */
    async function groupMembersBan(callbacks: { onComplete?: () => void } = {}) {
        await runBatchOperation({
            action: (
                user: {
                    userId: any;
                },
                groupId: any
            ) =>
                (deps.groupRequest as any).banGroupMember({
                    groupId,
                    userId: user.userId
                }),
            logPrefix: 'Banning',
            successMessage: 'Banned {count} group members',
            errorMessage: 'Failed to ban group member',
            onComplete: callbacks?.onComplete
        });
    }

    /**
     * @param callbacks
     */
    async function groupMembersUnban(callbacks: { onComplete?: () => void } = {}) {
        await runBatchOperation({
            action: (
                user: {
                    userId: any;
                },
                groupId: any
            ) =>
                (deps.groupRequest as any).unbanGroupMember({
                    groupId,
                    userId: user.userId
                }),
            logPrefix: 'Unbanning',
            successMessage: 'Unbanned {count} group members',
            errorMessage: 'Failed to unban group member',
            onComplete: callbacks?.onComplete
        });
    }

    /**
     * @param callbacks
     */
    async function groupMembersKick(callbacks: { onComplete?: () => void } = {}) {
        await runBatchOperation({
            action: (
                user: {
                    userId: any;
                },
                groupId: any
            ) =>
                (deps.groupRequest as any).kickGroupMember({
                    groupId,
                    userId: user.userId
                }),
            logPrefix: 'Kicking',
            successMessage: 'Kicked {count} group members',
            errorMessage: 'Failed to kick group member',
            onComplete: callbacks?.onComplete
        });
    }

    /**
     * @param noteValue
     * @param callbacks
     */
    async function groupMembersSaveNote(noteValue: any, callbacks: { onComplete?: () => void } = {}) {
        await runBatchOperation({
            action: async (user: { managerNotes: any; userId: any }, groupId: any) => {
                if (user.managerNotes === noteValue) return;
                const args = await (deps.groupRequest as any).setGroupMemberProps(user.userId, groupId, {
                    managerNotes: noteValue
                });
                deps.handleGroupMemberProps(args);
            },
            logPrefix: 'Setting note for',
            successMessage: 'Saved notes for {count} group members',
            errorMessage: 'Failed to set group member note for',
            skipSelf: false,
            onComplete: callbacks?.onComplete
        });
    }

    /**
     * @param roleIds
     * @param callbacks
     */
    async function groupMembersRemoveRoles(
        roleIds: Iterable<unknown> | null | undefined,
        callbacks: { onComplete?: () => void } = {}
    ) {
        const rolesToRemoveSet = new Set(roleIds);
        await runBatchOperation({
            action: async (user: { roleIds: any; userId: any }, groupId: any) => {
                const currentRoles = new Set(user.roleIds || []);
                const rolesToRemoveForUser: unknown[] = [];
                rolesToRemoveSet.forEach((roleId) => {
                    if (currentRoles.has(roleId)) {
                        rolesToRemoveForUser.push(roleId);
                    }
                });
                if (!rolesToRemoveForUser.length) return;
                for (const roleId of rolesToRemoveForUser) {
                    const args = await (deps.groupRequest as any).removeGroupMemberRole({
                        groupId,
                        userId: user.userId,
                        roleId
                    });
                    deps.handleGroupMemberRoleChange(args);
                }
            },
            logPrefix: 'Removing roles from',
            successMessage: 'Roles removed',
            errorMessage: 'Failed to remove group member roles',
            onComplete: callbacks?.onComplete
        });
    }

    /**
     * @param roleIds
     * @param callbacks
     */
    async function groupMembersAddRoles(
        roleIds: Iterable<unknown> | null | undefined,
        callbacks: { onComplete?: () => void } = {}
    ) {
        const rolesToAddSet = new Set(roleIds);
        await runBatchOperation({
            action: async (user: { roleIds: any; userId: any }, groupId: any) => {
                const currentRoles = new Set(user.roleIds || []);
                const rolesToAddForUser: unknown[] = [];
                rolesToAddSet.forEach((roleId) => {
                    if (!currentRoles.has(roleId)) {
                        rolesToAddForUser.push(roleId);
                    }
                });
                if (!rolesToAddForUser.length) return;
                for (const roleId of rolesToAddForUser) {
                    const args = await (deps.groupRequest as any).addGroupMemberRole({
                        groupId,
                        userId: user.userId,
                        roleId
                    });
                    deps.handleGroupMemberRoleChange(args);
                }
            },
            logPrefix: 'Adding roles to',
            successMessage: 'Added group member roles',
            errorMessage: 'Failed to add group member roles',
            onComplete: callbacks?.onComplete
        });
    }

    /**
     * @param callbacks
     */
    async function groupMembersDeleteSentInvite(callbacks: { onComplete?: () => void } = {}) {
        await runBatchOperation({
            action: (
                user: {
                    userId: any;
                },
                groupId: any
            ) =>
                (deps.groupRequest as any).deleteSentGroupInvite({
                    groupId,
                    userId: user.userId
                }),
            logPrefix: 'Deleting group invite',
            successMessage: 'Deleted {count} group invites',
            errorMessage: 'Failed to delete group invites',
            onComplete: callbacks?.onComplete
        });
    }

    /**
     * @param callbacks
     */
    async function groupMembersAcceptInviteRequest(callbacks: { onComplete?: () => void } = {}) {
        await runBatchOperation({
            action: (
                user: {
                    userId: any;
                },
                groupId: any
            ) =>
                (deps.groupRequest as any).acceptGroupInviteRequest({
                    groupId,
                    userId: user.userId
                }),
            logPrefix: 'Accepting group join request from',
            successMessage: 'Accepted {count} group join requests',
            errorMessage: 'Failed to accept group join requests',
            onComplete: callbacks?.onComplete
        });
    }

    /**
     * @param callbacks
     */
    async function groupMembersRejectInviteRequest(callbacks: { onComplete?: () => void } = {}) {
        await runBatchOperation({
            action: (
                user: {
                    userId: any;
                },
                groupId: any
            ) =>
                (deps.groupRequest as any).rejectGroupInviteRequest({
                    groupId,
                    userId: user.userId
                }),
            logPrefix: 'Rejecting group join request from',
            successMessage: 'Rejected {count} group join requests',
            errorMessage: 'Failed to reject group join requests',
            onComplete: callbacks?.onComplete
        });
    }

    /**
     * @param callbacks
     */
    async function groupMembersBlockJoinRequest(callbacks: { onComplete?: () => void } = {}) {
        await runBatchOperation({
            action: (
                user: {
                    userId: any;
                },
                groupId: any
            ) =>
                (deps.groupRequest as any).blockGroupInviteRequest({
                    groupId,
                    userId: user.userId
                }),
            logPrefix: 'Blocking group join request from',
            successMessage: 'Blocked {count} group join requests',
            errorMessage: 'Failed to block group join requests',
            onComplete: callbacks?.onComplete
        });
    }

    /**
     * @param callbacks
     */
    async function groupMembersDeleteBlockedRequest(callbacks: { onComplete?: () => void } = {}) {
        await runBatchOperation({
            action: (
                user: {
                    userId: any;
                },
                groupId: any
            ) =>
                (deps.groupRequest as any).deleteBlockedGroupRequest({
                    groupId,
                    userId: user.userId
                }),
            logPrefix: 'Deleting blocked group request for',
            successMessage: 'Deleted {count} blocked group requests',
            errorMessage: 'Failed to delete blocked group requests',
            onComplete: callbacks?.onComplete
        });
    }

    return {
        progressCurrent,
        progressTotal,
        groupMembersBan,
        groupMembersUnban,
        groupMembersKick,
        groupMembersSaveNote,
        groupMembersRemoveRoles,
        groupMembersAddRoles,
        groupMembersDeleteSentInvite,
        groupMembersAcceptInviteRequest,
        groupMembersRejectInviteRequest,
        groupMembersBlockJoinRequest,
        groupMembersDeleteBlockedRequest
    };
}
