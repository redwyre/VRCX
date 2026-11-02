import { ref } from 'vue';

export function useIntersectionObserver() {
    const intersectionObservers = ref([]);

    // intersection observer - start
    function clearIntersectionObservers() {
        intersectionObservers.value.forEach((observer) => {
            if (observer) {
                (observer as any).disconnect();
            }
        });
        intersectionObservers.value = [];
    }

    function handleIntersectionObserver(activityDetailChartRef: any) {
        clearIntersectionObservers();

        activityDetailChartRef.value?.forEach((child: any, index: any) => {
            const observer = new IntersectionObserver((entries) =>
                handleIntersection(index, entries, activityDetailChartRef)
            );
            observer.observe(child.$el);




            intersectionObservers.value[index] = observer;
        });
    }
    function handleIntersection(index: any, entries: any, activityDetailChartRef: any) {
        if (!entries) {
            console.error('handleIntersection failed');
            return;
        }
        entries.forEach((entry: any) => {
            if (entry.isIntersecting && activityDetailChartRef.value[index]) {
                activityDetailChartRef.value[index].initEcharts();
                (intersectionObservers.value[index] as any).unobserve(entry.target);
            }
        });
    }
    // intersection observer - end

    return {
        handleIntersectionObserver
    };
}
