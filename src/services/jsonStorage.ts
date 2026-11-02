let VRCXStorage: { GetArray?: (key: any) => Promise<any[]>; SetArray?: (key: any, value: any) => void; GetObject?: (key: any) => Promise<any>; SetObject?: (key: any, value: any) => void } = {};

export default class {
    constructor(_VRCXStorage: any) {
        VRCXStorage = _VRCXStorage;
        this.init();
    }

    init() {
        VRCXStorage.GetArray = async function (key: any) {
            try {
                var array = JSON.parse(await (this as any).Get(key));
                if (Array.isArray(array)) {
                    return array;
                }
            } catch (err) {
                console.error(err);
            }
            return [];
        };

        VRCXStorage.SetArray = function (key: any, value: any) {
            (this as any).Set(key, JSON.stringify(value));
        };

        VRCXStorage.GetObject = async function (key: any) {
            try {
                var object = JSON.parse(await (this as any).Get(key));
                if (object === Object(object)) {
                    return object;
                }
            } catch (err) {
                console.error(err);
            }
            return {};
        };

        VRCXStorage.SetObject = function (key: any, value: any) {
            (this as any).Set(key, JSON.stringify(value));
        };
    }
}
