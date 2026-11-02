import sqliteService from '../sqlite';

const tableAlter = {
    async upgradeDatabaseVersion() {
        await (this as any).initTables();
        await (this as any).cleanLegendFromFriendLog(); // fix friendLog spammed with crap
 await (this as any).fixGameLogTraveling(); // fix bug with gameLog location being set as traveling
 await (this as any).fixNegativeGPS(); // fix GPS being a negative value due to VRCX bug with traveling
 await (this as any).fixBrokenLeaveEntries(); // fix user instance timer being higher than current user location timer
 await (this as any).fixBrokenGroupInvites(); // fix notification v2 in wrong table
 await (this as any).fixBrokenNotifications(); // fix notifications being null
 await (this as any).fixBrokenGroupChange(); // fix spam group left & name change
 await (this as any).fixCancelFriendRequestTypo(); // fix CancelFriendRequst typo
 await (this as any).fixBrokenGameLogDisplayNames(); // fix gameLog display names "DisplayName (userId)"
 // fix gameLog display names "DisplayName (userId)"
        await this.updateTableForGroupNames();
        await this.addFriendLogFriendNumber();
        await this.updateTableForAvatarHistory();
        await this.addPerformanceIndexes(); // 16
        await this.addFeedBioLinks(); // 18
    },

    async updateTableForGroupNames() {
        var tables: any = [];
        await sqliteService.execute((dbRow: any) => {
            tables.push(dbRow[0]);
        }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_feed_gps' OR name LIKE '%_feed_online_offline' OR name = 'gamelog_location'`);
        for (var tableName of tables) {
            try {
                await sqliteService.executeNonQuery(`ALTER TABLE ${tableName} ADD group_name TEXT DEFAULT ''`);
            } catch (e) {
                const msg = (e as any).toString();
                if (msg.indexOf('duplicate column name') === -1) {
                    console.error(msg);
                }
            }
        }
        // Fix gamelog_location column typo
        try {
            await sqliteService.executeNonQuery(`ALTER TABLE gamelog_location DROP COLUMN groupName`);
        } catch (e) {
            const msg = (e as any).toString();
            if (msg.indexOf('no such column') === -1) {
                console.error(msg);
            }
        }
    },

    async addFriendLogFriendNumber() {
        var tables: any = [];
        await sqliteService.execute((dbRow: any) => {
            tables.push(dbRow[0]);
        }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_friend_log_current' OR name LIKE '%_friend_log_history'`);
        for (var tableName of tables) {
            try {
                await sqliteService.executeNonQuery(`ALTER TABLE ${tableName} ADD friend_number INTEGER DEFAULT 0`);
            } catch (e) {
                const msg = (e as any).toString();
                if (msg.indexOf('duplicate column name') === -1) {
                    console.error(msg);
                }
            }
        }
    },

    async updateTableForAvatarHistory() {
        var tables: any = [];
        await sqliteService.execute((dbRow: any) => {
            tables.push(dbRow[0]);
        }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_avatar_history'`);
        for (var tableName of tables) {
            try {
                await sqliteService.executeNonQuery(`ALTER TABLE ${tableName} ADD time INTEGER DEFAULT 0`);
            } catch (e) {
                const msg = (e as any).toString();
                if (msg.indexOf('duplicate column name') === -1) {
                    console.error(msg);
                }
            }
        }
    },

    async addPerformanceIndexes() {
        // per-user friend_log_history: covers getFriendLogHistoryForUserId
        var tables: any = [];
        await sqliteService.execute((dbRow: any) => {
            tables.push(dbRow[0]);
        }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_friend_log_history'`);
        for (var tableName of tables) {
            try {
                await sqliteService.executeNonQuery(
                    `CREATE INDEX IF NOT EXISTS ${tableName}_user_id_idx ON ${tableName} (user_id)`
                );
            } catch (e) {
                console.error(e);
            }
        }
    },

    async addFeedBioLinks() {
        var tables: any = [];
        await sqliteService.execute((dbRow: any) => {
            tables.push(dbRow[0]);
        }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_feed_bio'`);
        for (var tableName of tables) {
            for (var column of ['bio_links', 'previous_bio_links']) {
                try {
                    await sqliteService.executeNonQuery(`ALTER TABLE ${tableName} ADD ${column} TEXT DEFAULT '[]'`);
                } catch (e) {
                    const msg = (e as any).toString();
                    if (msg.indexOf('duplicate column name') === -1) {
                        console.error(msg);
                    }
                }
            }
        }
    }
};

export { tableAlter };
