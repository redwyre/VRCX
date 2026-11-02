export function isDetailDataFiltered(detailData: any[] | null | undefined, isSoloInstanceVisible: boolean, isNoFriendInstanceVisible: boolean) {
    if (!detailData) return false;

    if (!isSoloInstanceVisible && detailData.length <= 1) {
        return true;
    }

    if (!isNoFriendInstanceVisible && detailData.length > 1 && !detailData.some((item: { isFriend: any; }) => item.isFriend)) {
        return true;
    }

    return false;
}

export function findMatchingDetailData(activityItem: { location: any; joinTime?: any; } | null, activityDetailData: any, currentUser: { id: any; } | null) {
    if (!activityItem || !currentUser) return null;

    return activityDetailData.find((arr: any) => {
        const sameLocation = arr[0]?.location === activityItem.location;
        const sameJoinTime = arr
            .find((item: { user_id: any; }) => item.user_id === currentUser.id)
            ?.joinTime.isSame(activityItem.joinTime);
        return sameLocation && sameJoinTime;
    });
}

export function generateYAxisLabel(worldName: string | any[], isFiltered: boolean, maxLength = 20) {
    const truncatedName = worldName.length > maxLength ? `${worldName.slice(0, maxLength)}...` : worldName;
    return isFiltered ? `{filtered|${truncatedName}}` : `{normal|${truncatedName}}`;
}

export function formatWorldName(worldName: string | any[], maxLength = 20) {
    return worldName.length > maxLength ? `${worldName.slice(0, maxLength)}...` : worldName;
}

export function useChartHelpers() {
    return {
        isDetailDataFiltered,
        findMatchingDetailData,
        generateYAxisLabel,
        formatWorldName
    };
}
