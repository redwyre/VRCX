import dotnet from 'node-api-dotnet/net10.0';

class InteropApi {
    constructor() {
        // Cache for .NET objects, might be problematic if we require a new instance every time
        /** @type {Record<string, object>} */
        this.createdObjects = {};
    }

    /**
     * @param {string} className
     */
    getDotNetObject(className) {
        if (!this.createdObjects[className]) {
            console.log(`Creating new instance of ${className}`);
            // @ts-ignore
            this.createdObjects[className] = new dotnet.VRCX[className]();
        }
        return this.createdObjects[className];
    }

    /**
     * @param {string} className
     * @param {string} methodName
     * @param {any} args
     */
    callMethod(className, methodName, args) {
        try {
            const obj = this.getDotNetObject(className);
            if (typeof obj[methodName] !== 'function') {
                throw new Error(`Method ${methodName} does not exist on class ${className}`);
            }
            return obj[methodName](...args);
        } catch (e) {
            console.error('Error calling .NET method', `${className}.${methodName}`, e);
            throw e;
        }
    }
}

export default InteropApi;
