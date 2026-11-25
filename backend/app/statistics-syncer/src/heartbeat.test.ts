import { runCronJobs, waitForCrons } from '@stamhoofd/crons';
import { TestUtils } from '@stamhoofd/test-utils';
import { statisticsCronOptions } from './crons.js';
import { getStatisticsConnection } from './database.js';

it('attempts one heartbeat after a completed cycle, never after a failure or a gated tick', async () => {
    const url = 'https://example.invalid/secret-monitor-token';
    TestUtils.setEnvironment('STATISTICS_SYNC_HEARTBEAT_URL', url);
    const request = vi.fn().mockRejectedValue(new Error(url));
    vi.stubGlobal('fetch', request);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tick = async () => {
        await runCronJobs(statisticsCronOptions);
        await waitForCrons();
    };
    try {
        vi.spyOn(getStatisticsConnection(), 'select').mockRejectedValueOnce(
            new Error('sync failed'),
        );
        await tick();
        expect(request).not.toHaveBeenCalled();
        expect(errors).toHaveBeenCalled();
        errors.mockClear();

        await tick();
        expect(request).toHaveBeenCalledOnce();
        expect(request.mock.calls[0][0]).toBe(url);
        expect(warning).toHaveBeenCalled();
        expect(warning.mock.calls.flat().map(String).join(' ')).not.toContain(
            'secret-monitor-token',
        );
        expect(errors).not.toHaveBeenCalled();

        // A failed delivery did not make the completed business cycle eligible to run again.
        await tick();
        expect(request).toHaveBeenCalledOnce();
    } finally {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    }
}, 20000);
