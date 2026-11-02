// requires binding of LogWatcher

class GameLogService {
    parseRawGameLog(dt: string, type: string, args: any) {
        var gameLog = {
            dt,
            type
        };

        switch (type) {
            case 'location':
                (gameLog as any).location = args[0];
                (gameLog as any).worldName = args[1];
                break;

            case 'location-destination':
                (gameLog as any).location = args[0];
                break;

            case 'player-joined':
                (gameLog as any).displayName = args[0];
                (gameLog as any).userId = args[1];
                break;

            case 'player-left':
                (gameLog as any).displayName = args[0];
                (gameLog as any).userId = args[1];
                break;

            case 'notification':
                (gameLog as any).json = args[0];
                break;

            case 'portal-spawn':
                break;

            case 'event':
                (gameLog as any).event = args[0];
                break;

            case 'video-play':
                (gameLog as any).videoUrl = args[0];
                (gameLog as any).displayName = args[1];
                break;

            case 'resource-load-string':
            case 'resource-load-image':
                (gameLog as any).resourceUrl = args[0];
                break;

            case 'video-sync':
                (gameLog as any).timestamp = args[0];
                break;

            case 'vrcx':
            case 'nowplaying':
                (gameLog as any).data = args[0];
                break;

            case 'api-request':
                (gameLog as any).url = args[0];
                break;

            case 'avatar-change':
                (gameLog as any).displayName = args[0];
                (gameLog as any).avatarName = args[1];
                break;

            case 'photon-id':
                (gameLog as any).displayName = args[0];
                (gameLog as any).photonId = args[1];
                break;

            case 'screenshot':
                (gameLog as any).screenshotPath = args[0];
                break;

            case 'vrc-quit':
                break;

            case 'openvr-init':
                break;

            case 'desktop-mode':
                break;

            case 'udon-exception':
                (gameLog as any).data = args[0];
                break;

            case 'sticker-spawn':
                (gameLog as any).userId = args[0];
                (gameLog as any).displayName = args[1];
                (gameLog as any).inventoryId = args[2];
                break;

            default:
                break;
        }

        return gameLog;
    }

    async getAll() {
        var gameLogs = [];
        var done = false;
        while (!done) {
            var rawGameLogs = await (LogWatcher as any).Get();
            // eslint-disable-next-line no-unused-vars
            for (var [fileName, dt, type, ...args] of rawGameLogs) {
                var gameLog = this.parseRawGameLog(dt, type, args);
                gameLogs.push(gameLog);
            }
            if (rawGameLogs.length === 0) {
                done = true;
            }
        }
        return gameLogs;
    }

    async setDateTill(dateTill: string) {
        await (LogWatcher as any).SetDateTill(dateTill);
    }

    async reset() {
        await (LogWatcher as any).Reset();
    }
}

var self = new GameLogService();
window.gameLogService = self;

export { self as default, GameLogService as LogWatcherService };
