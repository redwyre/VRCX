import { computed, Ref } from 'vue';

export function useActivityStats(activityData: Ref<{ time: number; }[], { time: number; }[] | { time: number; }[]> | Ref<null, null>) {
    const totalOnlineTime = computed(() => {
        return activityData.value?.reduce((acc, item: { time: any; }) => acc + item.time, 0);
    });

    return {
        totalOnlineTime
    };
}
