// requires binding of WebApi

class WebApiService {
    clearCookies() {
        return (WebApi as any).ClearCookies();
    }

    getCookies() {
        return (WebApi as any).GetCookies();
    }

    setCookies(cookie: any) {
        return (WebApi as any).SetCookies(cookie);
    }

    /**
     * @param {import('@/types/vrcx').WebApiOptions} options
     * @returns {Promise<{ status: number; data?: string }>}
     */




    async execute(options: import('@/types/vrcx').WebApiOptions) {
        if (!options) {
            throw new Error('options is required');
        }
        if (LINUX) {
            const requestJson = JSON.stringify(options);
            var json = await (WebApi as any).ExecuteJson(requestJson);
            var data = JSON.parse(json);
            if (data.status === -1) {
                throw new Error(data.message);
            }
            return {
                status: data.status,
                data: data.message
            };
        }

        var item = await (WebApi as any).Execute(options);
        if (item.Item1 === -1) {
            throw item.Item2;
        }
        return {
            status: item.Item1,
            data: item.Item2
        };
    }
}

var self = new WebApiService();
window.webApiService = self;

export { self as default, WebApiService };
