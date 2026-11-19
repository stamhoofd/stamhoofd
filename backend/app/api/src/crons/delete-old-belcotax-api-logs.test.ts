import { BelcotaxApiLog, BelcotaxApiLogAction } from '@stamhoofd/models';
import { deleteOldBelcotaxApiLogs } from './delete-old-belcotax-api-logs.js';

describe('Cron.deleteOldBelcotaxApiLogs', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    async function createLog(createdAt: Date) {
        const log = new BelcotaxApiLog();
        log.action = BelcotaxApiLogAction.TokenRefresh;
        log.url = 'https://fediamapi-a.minfin.be/sso/oauth2/access_token';
        log.success = true;
        log.createdAt = createdAt;
        await log.save();
        return log;
    }

    test('keeps the log for 12 months', async () => {
        const now = new Date(2027, 2, 10, 4, 30);
        const old = await createLog(new Date(2026, 2, 9));
        const recent = await createLog(new Date(2026, 2, 11));

        vi.useFakeTimers({ now, toFake: ['Date'] });
        await deleteOldBelcotaxApiLogs();

        expect(await BelcotaxApiLog.getByID(old.id)).toBeUndefined();
        expect(await BelcotaxApiLog.getByID(recent.id)).toBeDefined();
    });
});
