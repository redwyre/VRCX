import sqliteService from '../sqlite';

const friendFavorites = {
    addFriendToLocalFavorites(userId: string, groupName: string) {
        sqliteService.executeNonQuery(
            'INSERT OR REPLACE INTO favorite_friend (user_id, group_name, created_at) VALUES (@user_id, @group_name, @created_at)',




            {
                '@user_id': userId,
                '@group_name': groupName,
                '@created_at': new Date().toJSON()
            }
        );
    },

    removeFriendFromLocalFavorites(userId: string, groupName: string) {
        sqliteService.executeNonQuery(
            `DELETE FROM favorite_friend WHERE user_id = @user_id AND group_name = @group_name`,




            {
                '@user_id': userId,
                '@group_name': groupName
            }
        );
    },

    renameFriendFavoriteGroup(newGroupName: string, groupName: string) {
        sqliteService.executeNonQuery(
            `UPDATE favorite_friend SET group_name = @new_group_name WHERE group_name = @group_name`,




            {
                '@new_group_name': newGroupName,
                '@group_name': groupName
            }
        );
    },

    deleteFriendFavoriteGroup(groupName: string) {




        sqliteService.executeNonQuery(`DELETE FROM favorite_friend WHERE group_name = @group_name`, {
            '@group_name': groupName
        });
    },

    async getFriendFavorites() {
        const data: { created_at: any; userId: any; groupName: any; }[] = [];
        await sqliteService.execute((dbRow: any) => {
            const row = {
                created_at: dbRow[1],
                userId: dbRow[2],
                groupName: dbRow[3]
            };
            data.push(row);
        }, 'SELECT * FROM favorite_friend');
        return data;
    }
};

export { friendFavorites };
