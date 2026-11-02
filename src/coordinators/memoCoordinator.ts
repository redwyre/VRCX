import { useFriendStore, useUserStore } from '../stores';
import { database } from '../services/database';
import { syncFriendSearchIndex } from './searchIndexCoordinator';

/**
 * @returns {Promise<void>}
 */
async function migrateMemos() {
    const json = JSON.parse(await (VRCXStorage as any).GetAll());
    for (const line in json) {
        if (line.substring(0, 8) === 'memo_usr') {
            const userId = line.substring(5);
            const memo = json[line];
            if (memo) {
                await saveUserMemo(userId, memo);
                (VRCXStorage as any).Remove(`memo_${userId}`);
            }
        }
    }
}

/**
 * @param {string} userId
 * @param {string} memo
 */
function applyUserMemo(userId: string, memo: string) {
    const userStore = useUserStore();
    const friendStore = useFriendStore();
    const text = String(memo || '');
    const ref = userStore.cachedUsers.get(userId);
    if (ref) {
        ref.$memo = text;
    }
    const ctx = friendStore.friends.get(userId);
    if (ctx) {
        ctx.$nickName = text ? text.split('\n')[0] : '';
        syncFriendSearchIndex(ctx);
    }
}

/**
 * @param {string} userId
 * @returns
 */
async function getUserMemo(userId: string) {
    try {
        const row = await database.getUserMemo(userId);
        applyUserMemo(userId, (row as any).memo);
        return row;
    } catch (err) {
        console.error(err);
        return {
            userId: '',
            editedAt: '',
            memo: ''
        };
    }
}

/**
 * @param {string} id
 * @param {string} memo
 */
async function saveUserMemo(id: string, memo: string) {
    const userStore = useUserStore();
    if (memo) {
        await database.setUserMemo({
            userId: id,
            editedAt: new Date().toJSON(),
            memo
        });
    } else {
        await database.deleteUserMemo(id);
    }
    applyUserMemo(id, memo);
    if (userStore.userDialog.id === id) {
        userStore.setUserDialogMemo(memo);
    }
}

/**
 * @returns {Promise<void>}
 */
async function getAllUserMemos() {
    const memos = await database.getAllUserMemos();
    memos.forEach((memo) => {
        applyUserMemo(memo.userId, memo.memo);
    });
}

/**
 * @param {string} worldId
 * @returns
 */
async function getWorldMemo(worldId: string) {
    try {
        return await database.getWorldMemo(worldId);
    } catch (err) {
        console.error(err);
        return {
            worldId: '',
            editedAt: '',
            memo: ''
        };
    }
}

// async function getAvatarMemo(avatarId) {
//     try {
//         return await database.getAvatarMemoDB(avatarId);
//     } catch (err) {
//         console.error(err);
//         return {
//             avatarId: '',
//             editedAt: '',
//             memo: ''
//         };
//     }
// }

export {
    migrateMemos,
    getUserMemo,
    saveUserMemo,
    getAllUserMemos,
    getWorldMemo
    // getAvatarMemo
};
