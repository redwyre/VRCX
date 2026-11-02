import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useFavoriteStore } from './favorite';

export const useSearchIndexStore = defineStore('SearchIndex', () => {
    const favoriteStore = useFavoriteStore();

    const friends = new Map();
    const avatars = new Map();
    const worlds = new Map();
    const groups = new Map();
    const favAvatars = new Map();
    const favWorlds = new Map();

    const version = ref(0);

    /**
     * Sync a friend context into the search index.
     * Extracts only the fields needed for searching.
     *
     * @param {object} ctx - Friend context from friendStore.friends
     */
    function syncFriend(ctx: object) {
        if (!ctx || !(ctx as any).id) return;
        const entry = {
    id: (ctx as any).id,
    name: (ctx as any).name || '',
    memo: (ctx as any).ref?.$memo || '',
    note: (ctx as any).ref?.note || '',
    imageUrl: (ctx as any).ref?.currentAvatarThumbnailImageUrl || ''
};
        const existing = friends.get((ctx as any).id);
        if (
            existing &&
            existing.name === entry.name &&
            existing.memo === entry.memo &&
            existing.note === entry.note &&
            existing.imageUrl === entry.imageUrl
        ) {
            return;
        }
        friends.set((ctx as any).id, entry);
        version.value++;
    }

    /**
     * @param {string} id
     */
    function removeFriend(id: string) {
        if (friends.delete(id)) {
            version.value++;
        }
    }

    function clearFriends() {
        if (friends.size > 0) {
            friends.clear();
            version.value++;
        }
    }

    /**
     * @param {object} ref - Avatar data object
     */
    function upsertAvatar(ref: object) {
        if (!ref || !(ref as any).id) return;
        const entry = {
    id: (ref as any).id,
    name: (ref as any).name || '',
    authorId: (ref as any).authorId || '',
    imageUrl: (ref as any).thumbnailImageUrl || (ref as any).imageUrl || ''
};
        const existing = avatars.get((ref as any).id);
        if (
            existing &&
            existing.name === entry.name &&
            existing.authorId === entry.authorId &&
            existing.imageUrl === entry.imageUrl
        ) {
            return;
        }
        avatars.set((ref as any).id, entry);
        version.value++;
    }

    /**
     * @param {string} id
     */
    function removeAvatar(id: string) {
        if (avatars.delete(id)) {
            version.value++;
        }
    }

    function clearAvatars() {
        if (avatars.size > 0) {
            avatars.clear();
            version.value++;
        }
    }

    /**
     * @param {object} ref - World data object
     */
    function upsertWorld(ref: object) {
        if (!ref || !(ref as any).id) return;
        const entry = {
    id: (ref as any).id,
    name: (ref as any).name || '',
    authorId: (ref as any).authorId || '',
    imageUrl: (ref as any).thumbnailImageUrl || (ref as any).imageUrl || ''
};
        const existing = worlds.get((ref as any).id);
        if (
            existing &&
            existing.name === entry.name &&
            existing.authorId === entry.authorId &&
            existing.imageUrl === entry.imageUrl
        ) {
            return;
        }
        worlds.set((ref as any).id, entry);
        version.value++;
    }

    /**
     * @param {string} id
     */
    function removeWorld(id: string) {
        if (worlds.delete(id)) {
            version.value++;
        }
    }

    function clearWorlds() {
        if (worlds.size > 0) {
            worlds.clear();
            version.value++;
        }
    }

    /**
     * @param {object} ref - Group data object
     */
    function upsertGroup(ref: object) {
        if (!ref || !(ref as any).id) return;
        const entry = {
    id: (ref as any).id,
    name: (ref as any).name || '',
    ownerId: (ref as any).ownerId || '',
    imageUrl: (ref as any).iconUrl || (ref as any).bannerUrl || ''
};
        const existing = groups.get((ref as any).id);
        if (
            existing &&
            existing.name === entry.name &&
            existing.ownerId === entry.ownerId &&
            existing.imageUrl === entry.imageUrl
        ) {
            return;
        }
        groups.set((ref as any).id, entry);
        version.value++;
    }

    /**
     * @param {string} id
     */
    function removeGroup(id: string) {
        if (groups.delete(id)) {
            version.value++;
        }
    }

    function clearGroups() {
        if (groups.size > 0) {
            groups.clear();
            version.value++;
        }
    }

    function rebuildFavoritesFromStore() {
        const newFavAvatars = new Map();
        for (const ctx of favoriteStore.favoriteAvatars) {
            if (!(ctx as any)?.ref?.name) continue;
            newFavAvatars.set((ctx as any).ref.id, {
    id: (ctx as any).ref.id,
    name: (ctx as any).ref.name,
    imageUrl: (ctx as any).ref.thumbnailImageUrl || (ctx as any).ref.imageUrl || ''
});
        }
        for (const group of Object.values(favoriteStore.localAvatarFavorites)) {
            for (const ref of group as any) {
                if (!ref?.name || newFavAvatars.has(ref.id)) continue;
                newFavAvatars.set(ref.id, {
                    id: ref.id,
                    name: ref.name,
                    imageUrl: ref.thumbnailImageUrl || ref.imageUrl || ''
                });
            }
        }

        const newFavWorlds = new Map();
        for (const ctx of favoriteStore.favoriteWorlds) {
            if (!(ctx as any)?.ref?.name) continue;
            newFavWorlds.set((ctx as any).ref.id, {
    id: (ctx as any).ref.id,
    name: (ctx as any).ref.name,
    imageUrl: (ctx as any).ref.thumbnailImageUrl || (ctx as any).ref.imageUrl || ''
});
        }
        for (const group of Object.values(favoriteStore.localWorldFavorites)) {
            for (const ref of group as any) {
                if (!ref?.name || newFavWorlds.has(ref.id)) continue;
                newFavWorlds.set(ref.id, {
                    id: ref.id,
                    name: ref.name,
                    imageUrl: ref.thumbnailImageUrl || ref.imageUrl || ''
                });
            }
        }

        let changed = false;
        if (favAvatars.size !== newFavAvatars.size) {
            changed = true;
        } else {
            for (const [id, entry] of newFavAvatars) {
                const existing = favAvatars.get(id);
                if (!existing || existing.name !== entry.name || existing.imageUrl !== entry.imageUrl) {
                    changed = true;
                    break;
                }
            }
        }
        if (favWorlds.size !== newFavWorlds.size) {
            changed = true;
        } else if (!changed) {
            for (const [id, entry] of newFavWorlds) {
                const existing = favWorlds.get(id);
                if (!existing || existing.name !== entry.name || existing.imageUrl !== entry.imageUrl) {
                    changed = true;
                    break;
                }
            }
        }

        if (changed) {
            favAvatars.clear();
            for (const [id, entry] of newFavAvatars) {
                favAvatars.set(id, entry);
            }
            favWorlds.clear();
            for (const [id, entry] of newFavWorlds) {
                favWorlds.set(id, entry);
            }
            version.value++;
        }
    }

    watch(
        [() => favoriteStore.localAvatarFavorites, () => favoriteStore.localWorldFavorites],
        rebuildFavoritesFromStore,
        { deep: true, immediate: true }
    );

    function clearFavorites() {
        if (favAvatars.size > 0 || favWorlds.size > 0) {
            favAvatars.clear();
            favWorlds.clear();
            version.value++;
        }
    }

    /**
     * Build a snapshot from the internal index maps.
     * Used by quickSearch to send data to the Worker.
     *
     * @returns {object} Plain object arrays ready for postMessage.
     */
    function getSnapshot() {
        return {
            friends: Array.from(friends.values()),
            avatars: Array.from(avatars.values()),
            worlds: Array.from(worlds.values()),
            groups: Array.from(groups.values()),
            favAvatars: Array.from(favAvatars.values()),
            favWorlds: Array.from(favWorlds.values())
        };
    }

    return {
        version,

        syncFriend,
        removeFriend,
        clearFriends,

        upsertAvatar,
        removeAvatar,
        clearAvatars,

        upsertWorld,
        removeWorld,
        clearWorlds,

        upsertGroup,
        removeGroup,
        clearGroups,
        rebuildFavoritesFromStore,
        clearFavorites,

        getSnapshot
    };
});
