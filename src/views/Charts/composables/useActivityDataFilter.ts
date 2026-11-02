import { computed, Ref } from 'vue';

export function useActivityDataFilter(
    activityDetailData: Ref<any[], any[]>,
    isDetailVisible: Ref<boolean, boolean>,
    isSoloInstanceVisible: Ref<boolean, boolean>,
    isNoFriendInstanceVisible: Ref<boolean, boolean>
) {
    const filteredActivityDetailData = computed(() => {
        if (!isDetailVisible.value) {
            return [];
        }
        let result = [...activityDetailData.value];
        if (!isSoloInstanceVisible.value) {
            result = result.filter((arr) => arr.length > 1);
        }
        if (!isNoFriendInstanceVisible.value) {
            result = result.filter((arr) => {
                // solo instance
                if (arr.length === 1) {
                    return true;
                }
                return arr.some((item: { isFriend: any; }) => item.isFriend);
            });
        }
        return result;
    });

    return {
        filteredActivityDetailData
    };
}
