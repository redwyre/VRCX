import sqliteService from '../sqlite';

const tableFixes = {
    async cleanLegendFromFriendLog() {
        var tables: any = [];
        await sqliteService.execute((dbRow: any) => {
            tables.push(dbRow[0]);
        }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_friend_log_history'`);
        for (var tableName of tables) {
            await sqliteService.executeNonQuery(
                `DELETE FROM ${tableName}
                WHERE type = 'TrustLevel' AND created_at > '2022-05-04T01:00:00.000Z'
                AND ((trust_level = 'Veteran User' AND previous_trust_level = 'Trusted User') OR (trust_level = 'Trusted User' AND previous_trust_level = 'Veteran User'))`
            );
        }
    },

    async fixGameLogTraveling() {
        var travelingList: { rowId: any; created_at: any; type: any; displayName: any; location: any; userId: any; time: any; }[] = [];
        await sqliteService.execute((dbRow: any) => {
            var row = {
                rowId: dbRow[0],
                created_at: dbRow[1],
                type: dbRow[2],
                displayName: dbRow[3],
                location: dbRow[4],
                userId: dbRow[5],
                time: dbRow[6]
            };
            travelingList.unshift(row);
        }, "SELECT * FROM gamelog_join_leave WHERE type = 'OnPlayerLeft' AND location = 'traveling'");
        for (const travelingEntry of travelingList) {
            await sqliteService.execute(
                async (dbRow: any) => {
                    var onPlayingJoin = {
                        rowId: dbRow[0],
                        created_at: dbRow[1],
                        type: dbRow[2],
                        displayName: dbRow[3],
                        location: dbRow[4],
                        userId: dbRow[5],
                        time: dbRow[6]
                    };
                    await sqliteService.executeNonQuery(
                        `UPDATE gamelog_join_leave SET location = @location WHERE id = @rowId`,




                        {
                            '@rowId': travelingEntry.rowId,
                            '@location': onPlayingJoin.location
                        }
                    );
                },
                "SELECT * FROM gamelog_join_leave WHERE type = 'OnPlayerJoined' AND display_name = @displayName AND created_at <= @created_at ORDER BY created_at DESC LIMIT 1",




                {
                    '@displayName': travelingEntry.displayName,
                    '@created_at': travelingEntry.created_at
                }
            );
        }
    },

    async fixNegativeGPS() {
        var gpsTables: any = [];
        await sqliteService.execute((dbRow: any) => {
            gpsTables.push(dbRow[0]);
        }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_gps'`);
        for (const tableName of gpsTables) {
            await sqliteService.executeNonQuery(`UPDATE ${tableName} SET time = 0 WHERE time < 0`);
        }
    },

    async getBrokenLeaveEntries() {
        var instances = await (this as any).getGameLogInstancesTime();
        var badEntries: any = [];
        await sqliteService.execute((dbRow: any) => {
            if (typeof dbRow[1] === 'number') {
                var ref = instances.get(dbRow[0]);
                if (typeof ref !== 'undefined' && dbRow[1] > ref) {
                    badEntries.push(dbRow[2]);
                }
            }
        }, `SELECT location, time, id FROM gamelog_join_leave WHERE type = 'OnPlayerLeft' AND time > 0`);
        return badEntries;
    },

    async fixBrokenLeaveEntries() {
        var badEntries = await this.getBrokenLeaveEntries();
        var badEntriesList = '';
        var count = badEntries.length;
        badEntries.forEach((entry: string) => {
            count--;
            if (count === 0) {
                badEntriesList = badEntriesList.concat(entry);
            } else {
                badEntriesList = badEntriesList.concat(`${entry}, `);
            }
        });

        await sqliteService.executeNonQuery(`UPDATE gamelog_join_leave SET time = 0 WHERE id IN (${badEntriesList})`);
    },

    async fixBrokenGroupInvites() {
        var notificationTables: any = [];
        await sqliteService.execute((dbRow: any) => {
            notificationTables.push(dbRow[0]);
        }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_notifications'`);
        for (const tableName of notificationTables) {
            await sqliteService.executeNonQuery(`DELETE FROM ${tableName} WHERE type LIKE '%.%'`);
        }
    },

    async fixBrokenNotifications() {
        var tables: any = [];
        await sqliteService.execute((dbRow: any) => {
            tables.push(dbRow[0]);
        }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_notifications'`);
        for (var tableName of tables) {
            await sqliteService.executeNonQuery(
                `DELETE FROM ${tableName} WHERE (created_at is null or created_at = '')`
            );
        }
    },

    async fixBrokenGroupChange() {
        var tables: any = [];
        await sqliteService.execute((dbRow: any) => {
            tables.push(dbRow[0]);
        }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_notifications'`);
        for (var tableName of tables) {
            await sqliteService.executeNonQuery(
                `DELETE FROM ${tableName} WHERE type = 'groupChange' AND created_at < '2024-04-23T03:00:00.000Z'`
            );
        }
    },

    async fixCancelFriendRequestTypo() {
        var tables: any = [];
        await sqliteService.execute((dbRow: any) => {
            tables.push(dbRow[0]);
        }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_friend_log_history'`);
        for (var tableName of tables) {
            await sqliteService.executeNonQuery(
                `UPDATE ${tableName} SET type = 'CancelFriendRequest' WHERE type = 'CancelFriendRequst'`
            );
        }
    },

    async getBrokenGameLogDisplayNames() {
        var badEntries: { id: any; displayName: any; createdAt: any; type: any; }[] = [];
        await sqliteService.execute((dbRow: any) => {
            badEntries.push({
                id: dbRow[0],
                displayName: dbRow[1],
                createdAt: dbRow[2],
                type: dbRow[3]
            });
        }, "SELECT id, display_name, created_at, type FROM gamelog_join_leave WHERE display_name LIKE '% (%'");
        return badEntries;
    },

    async fixBrokenGameLogDisplayNames() {
        var badEntries = await this.getBrokenGameLogDisplayNames();
        for (const entry of badEntries) {
            var newDisplayName = entry.displayName.split(' (')[0];
            var existingEntry = false;
            await sqliteService.execute(
                () => {
                    existingEntry = true;
                },
                `SELECT 1 FROM gamelog_join_leave
                WHERE created_at = @created_at AND type = @type AND display_name = @display_name
                LIMIT 1`,




                {
                    '@created_at': entry.createdAt,
                    '@type': entry.type,
                    '@display_name': newDisplayName
                }
            );

            if (existingEntry) {




                await sqliteService.executeNonQuery(`DELETE FROM gamelog_join_leave WHERE id = @id`, {
                    '@id': entry.id
                });
                continue;
            }
            await sqliteService.executeNonQuery(
                `UPDATE gamelog_join_leave SET display_name = @new_display_name WHERE id = @id`,




                {
                    '@new_display_name': newDisplayName,
                    '@id': entry.id
                }
            );
        }
    }
};

export { tableFixes };
