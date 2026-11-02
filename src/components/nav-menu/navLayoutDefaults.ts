import { LocaleMessage, RemoveIndexSignature } from '@intlify/core-base';
import { ComposerTranslation, VueMessageType, LocaleMessageValue } from 'vue-i18n';
import { DASHBOARD_NAV_KEY_PREFIX } from '../../shared/constants';

export function createBaseDefaultNavLayout(t: ComposerTranslation<{ [x: string]: LocaleMessage<VueMessageType>; }, string, RemoveIndexSignature<{ [x: string]: LocaleMessageValue<VueMessageType>; }>, never, never, never>) {
    return [
        { type: 'item', key: 'feed' },
        { type: 'item', key: 'friends-locations' },
        { type: 'item', key: 'game-log' },
        { type: 'item', key: 'player-list' },
        { type: 'item', key: 'search' },
        {
            type: 'folder',
            id: 'default-folder-favorites',
            nameKey: 'nav_tooltip.favorites',
            name: t('nav_tooltip.favorites'),
            icon: 'ri-star-line',
            items: ['favorite-friends', 'favorite-worlds', 'favorite-avatars']
        },
        {
            type: 'folder',
            id: 'default-folder-social',
            nameKey: 'nav_tooltip.social',
            name: t('nav_tooltip.social'),
            icon: 'ri-group-line',
            items: ['friend-log', 'friend-list', 'moderation']
        },
        { type: 'item', key: 'notification' },
        { type: 'item', key: 'my-avatars' },
        {
            type: 'folder',
            id: 'default-folder-charts',
            nameKey: 'nav_tooltip.charts',
            name: t('nav_tooltip.charts'),
            icon: 'ri-pie-chart-line',
            items: ['charts-instance', 'charts-mutual', 'charts-hot-worlds']
        },
        { type: 'item', key: 'tools' },
        { type: 'item', key: 'direct-access' }
    ];
}

export function insertDashboardEntries(layout: ({ type: string; key: string; id?: undefined; nameKey?: undefined; name?: undefined; icon?: undefined; items?: undefined; } | { type: string; id: string; nameKey: string; name: any; icon: string; items: string[]; key?: undefined; })[], dashboardDefinitions: { key: string; icon: any; tooltip: any; labelKey: any; routeName: string; routeParams: { id: any; }; isDashboard: boolean; }[]) {
    const nextLayout = Array.isArray(layout) ? [...layout] : [];
    const dashboardEntries = (dashboardDefinitions || []).map((def: { key: any; }) => ({
        type: 'item',
        key: def.key
    }));

    if (!dashboardEntries.length) {
        return nextLayout;
    }

    const directAccessIdx = nextLayout.findIndex((entry) => entry.type === 'item' && entry.key === 'direct-access');

    if (directAccessIdx !== -1) {
        nextLayout.splice(directAccessIdx, 0, ...dashboardEntries);
    } else {
        nextLayout.push(...dashboardEntries);
    }

    return nextLayout;
}

export function isDashboardNavKey(key: any) {
    return String(key || '').startsWith(DASHBOARD_NAV_KEY_PREFIX);
}
