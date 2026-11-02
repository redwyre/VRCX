function readPerformanceMemory() {

    const memory = (window?.performance as any)?.memory;
    if (!memory) return null;
    const { usedJSHeapSize, jsHeapSizeLimit } = memory;
    if (typeof usedJSHeapSize !== 'number' || typeof jsHeapSizeLimit !== 'number') {
        return null;
    }
    return { usedJSHeapSize, jsHeapSizeLimit };
}

export function startRendererMemoryThresholdReport(
    Sentry: any,
    { intervalMs = 10_000, thresholdRatio = 0.8, cooldownMs = 5 * 60_000 } = {}
) {
    const initial = readPerformanceMemory();
    if (!initial) return null;

    if (!Sentry?.withScope) return null;

    let lastSent = 0;

    return setInterval(() => {
        const m = readPerformanceMemory();
        if (!m) return;

        const ratio = m.usedJSHeapSize / m.jsHeapSizeLimit;
        if (!Number.isFinite(ratio) || ratio < thresholdRatio) return;

        const now = Date.now();
        if (now - lastSent < cooldownMs) return;
        lastSent = now;

        Sentry.withScope((scope: { setLevel: (arg0: string) => void; setTag: (arg0: string, arg1: string) => void; setContext: (arg0: string, arg1: { usedMB: number; limitMB: number; ratio: number; }) => void; }) => {
            scope.setLevel('warning');
            scope.setTag('reason', 'high-js-heap');
            scope.setContext('memory', {
                usedMB: m.usedJSHeapSize / 1024 / 1024,
                limitMB: m.jsHeapSizeLimit / 1024 / 1024,
                ratio
            });
            Sentry.captureMessage('Memory usage critical: nearing JS heap limit');
        });
    }, intervalMs);
}
