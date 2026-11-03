import type * as EChartsModule from 'echarts';

let echarts: typeof EChartsModule | PromiseLike<typeof EChartsModule> | null = null;

// lazy load echarts
function loadEcharts() {
    if (echarts) {
        return Promise.resolve(echarts);
    }
    return import('echarts').then((module) => {
        echarts = module;
        return echarts;
    });
}
export { loadEcharts };
