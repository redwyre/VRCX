import { dbVars } from '../database';

import sqliteService from '../sqlite';

function parseBioLinks(value: string) {
    try {
        const links = JSON.parse(value);
        return Array.isArray(links) ? links : [];
    } catch {
        return [];
    }
}

function parseRow(dbRow: any) {
    return {
        userId: dbRow[0],
        bio: dbRow[1],
        bioLinks: parseBioLinks(dbRow[2]),
        updatedAt: dbRow[3]
    };
}

const userProfile = {
    async getUserProfile(userId: any) {
        let row = null;
        await sqliteService.execute(
            (dbRow: any) => {
                row = parseRow(dbRow);
            },
            `SELECT user_id, bio, bio_links, updated_at FROM ${dbVars.userPrefix}_user_profile WHERE user_id = @user_id`,




            {
                '@user_id': userId
            }
        );
        return row;
    },

    async getAllUserProfiles() {
        const data: { userId: any; bio: any; bioLinks: any[]; updatedAt: any; }[] = [];
        await sqliteService.execute((dbRow: any) => {
            data.push(parseRow(dbRow));
        }, `SELECT user_id, bio, bio_links, updated_at FROM ${dbVars.userPrefix}_user_profile`);
        return data;
    },

    setUserProfile(profile: { id: any; bio: any; bioLinks: any; displayName?: any; }) {
        sqliteService.executeNonQuery(
            `INSERT OR REPLACE INTO ${dbVars.userPrefix}_user_profile (user_id, bio, bio_links, updated_at) VALUES (@user_id, @bio, @bio_links, @updated_at)`,




            {
                '@user_id': profile.id,
                '@bio': profile.bio,
                '@bio_links': JSON.stringify(profile.bioLinks),
                '@updated_at': new Date().toJSON()
            }
        );
    },

    deleteUserProfile(userId: any) {




        sqliteService.executeNonQuery(`DELETE FROM ${dbVars.userPrefix}_user_profile WHERE user_id = @user_id`, {
            '@user_id': userId
        });
    }
};

export { userProfile, parseBioLinks };
