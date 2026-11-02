class InteropApi {
    constructor() {
        return new Proxy(this, {
            get(target, prop) {
                if (WINDOWS) {
                    return undefined;
                }
                // If the property is not a method of InteropApi,
                // treat it as a .NET class name
                if (typeof prop === 'string' && !(target as any)[prop]) {
                    return new Proxy(
                        {},
                        {
                            get(_, methodName) {
                                // Return a method that calls the .NET method dynamically
                                return async (...args: any[]) => {
                                    return await target.callMethod(prop, methodName, ...args);
                                };
                            }
                        }
                    );
                }
                return (target as any)[prop];
            }
        });
    }

    async callMethod(className: string, methodName: string | symbol, ...args: any[]) {
        return window.interopApi.callDotNetMethod(className, methodName, args).then((result) => {
            return result;
        });
    }
}

export default new InteropApi();
