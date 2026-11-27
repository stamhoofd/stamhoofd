import { Platform } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { TestUtils } from '@stamhoofd/test-utils';
import { SettlementSyncRunner } from '../helpers/SettlementSyncRunner.js';
import { syncSettlements } from './settlement-sync.js';

const empty = { feeMonths: 0, failedFeeMonths: 0, synced: 0, skipped: 0, failed: 0 };
const url = 'https://example.invalid/nightly';
const request = vi.fn();
beforeEach(() => {
    TestUtils.setEnvironment('SETTLEMENT_SYNC_HEARTBEAT_URL', url);
    TestUtils.setEnvironment('environment', 'production');
    vi.stubGlobal(
        'fetch',
        request.mockReset().mockResolvedValue(new Response(null, { status: 204 })),
    );
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

it('signals a clean empty production run in the Brussels window; failed delivery does not repeat it', async () => {
    const run = vi.spyOn(SettlementSyncRunner.prototype, 'run').mockResolvedValue(empty);
    vi.setSystemTime(new Date('2026-07-01T04:00Z')); // 06:00 Brussels
    await syncSettlements();
    vi.setSystemTime(new Date('2026-07-02T03:00Z'));
    TestUtils.setEnvironment('environment', 'staging');
    await syncSettlements();
    expect(run).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    TestUtils.setEnvironment('environment', 'production');
    request.mockRejectedValueOnce(new Error('offline'));
    await syncSettlements();
    await syncSettlements();
    expect(run).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledExactlyOnceWith(url, expect.anything());
});

it.each(['failed', 'failedFeeMonths'] as const)(
    'keeps a resolved partial run done for today without signaling %s',
    async (field) => {
        vi.setSystemTime(new Date(field === 'failed' ? '2026-01-01T04:00Z' : '2026-01-02T04:00Z'));
        const run = vi
            .spyOn(SettlementSyncRunner.prototype, 'run')
            .mockResolvedValue({ ...empty, synced: 1, [field]: 1 });
        const report = vi.spyOn(Platform, 'getShared');
        await syncSettlements();
        await syncSettlements();
        expect(report).toHaveBeenCalled();
        expect(run).toHaveBeenCalledOnce();
        expect(request).not.toHaveBeenCalled();
    },
);

it('retries thrown failures and an abort during follow-up reporting inside the window', async () => {
    vi.setSystemTime(new Date('2026-01-03T04:00Z'));
    const run = vi
        .spyOn(SettlementSyncRunner.prototype, 'run')
        .mockRejectedValueOnce(new Error('interrupted'))
        .mockResolvedValue(empty);
    await expect(syncSettlements()).rejects.toThrow('interrupted');
    const platform = await Platform.getShared();
    vi.spyOn(Platform, 'getShared').mockImplementationOnce(async () => {
        QueueHandler.abort('settlement-sync', new Error('shutdown'));
        return platform;
    });
    await expect(syncSettlements()).rejects.toThrow('shutdown');
    expect(request).not.toHaveBeenCalled();
    await syncSettlements();
    expect(run).toHaveBeenCalledTimes(3);
    expect(request).toHaveBeenCalledOnce();
});
