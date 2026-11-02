export function useGroupModerationSelection(groupMemberModeration: any) {
    /**
     * @param {string} userId
     * @param {object} user
     */
    function setSelectedUsers(userId: string, user: object) {
        if (!user) return;
        groupMemberModeration.selectedUsers[userId] = user;
        groupMemberModeration.selectedUsersArray = Object.values(groupMemberModeration.selectedUsers);
    }

    /**
     * @param {string | null} userId
     * @param {boolean} isAll
     */
    function deselectedUsers(userId: string | null, isAll: boolean = false) {
        if (isAll) {
            for (const id in groupMemberModeration.selectedUsers) {
                if (Object.prototype.hasOwnProperty.call(groupMemberModeration.selectedUsers, id)) {
                    delete groupMemberModeration.selectedUsers[id];
                }
            }
        } else {




            if (Object.prototype.hasOwnProperty.call(groupMemberModeration.selectedUsers, userId)) {




                delete groupMemberModeration.selectedUsers[userId];
            }
        }
        groupMemberModeration.selectedUsersArray = Object.values(groupMemberModeration.selectedUsers);
    }

    /**
     * @param {object} row
     */
    function onSelectionChange(row: object) {
        if ((row as any).$selected && !groupMemberModeration.selectedUsers[(row as any).userId]) {
            setSelectedUsers((row as any).userId, row);
        } else if (!(row as any).$selected && groupMemberModeration.selectedUsers[(row as any).userId]) {
            deselectedUsers((row as any).userId);
        }
    }

    /**
     * Deselect a user across all tables.
     *
     * @param {string} [userId] - If omitted, deselects all rows in all tables
     */
    function deselectInTables(userId?: string) {
        const allTables = [
            groupMemberModeration.tables.members,
            groupMemberModeration.tables.bans,
            groupMemberModeration.tables.invites,
            groupMemberModeration.tables.joinRequests,
            groupMemberModeration.tables.blocked
        ];
        for (const table of allTables) {
            if (!table?.data) continue;
            if (userId) {
                const row = table.data.find((item: any) => item.userId === userId);
                if (row) {
                    row.$selected = false;
                }
            } else {
                table.data.forEach((row: any) => {
                    if (row.$selected) {
                        row.$selected = false;
                    }
                });
            }
        }
    }

    /**
     * @param {object} user
     */
    function deleteSelectedUser(user: object) {
        deselectedUsers((user as any).userId);
        deselectInTables((user as any).userId);
    }

    function clearAllSelected() {
        deselectedUsers(null, true);
        deselectInTables();
    }

    /**
     * Select all rows in a given table data array.
     *
     * @param {Array} tableData
     */
    function selectAll(tableData: Array<any>) {
        tableData.forEach((row) => {
            row.$selected = true;
            setSelectedUsers(row.userId, row);
        });
    }

    return {
        setSelectedUsers,
        deselectedUsers,
        onSelectionChange,
        deselectInTables,
        deleteSelectedUser,
        clearAllSelected,
        selectAll
    };
}
