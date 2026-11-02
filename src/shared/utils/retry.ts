export async function executeWithBackoff(fn: any, options = {}) {
    const { maxRetries = 5, baseDelay = 1000, shouldRetry = () => true }: any = options;

    async function attempt(remaining: number) {
        try {
            return await fn();
        } catch (err) {
            if (remaining <= 0 || !shouldRetry(err)) {
                throw err;
            }
            const delay = baseDelay * Math.pow(2, ((options as any).maxRetries || maxRetries) - remaining);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return attempt(remaining - 1);
        }
    }

    return attempt(maxRetries);
}
