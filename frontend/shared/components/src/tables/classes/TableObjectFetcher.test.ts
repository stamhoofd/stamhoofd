import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ObjectFetcher } from './ObjectFetcher';
import { TableObjectFetcher } from './TableObjectFetcher';

type Item = { id: string };

/**
 * Fetches only finish when released, and reject as soon as their signal is aborted.
 */
function controllableFetcher() {
    const fetchSignals: AbortSignal[] = [];
    const countSignals: AbortSignal[] = [];
    const pendingFetches: ((results: Item[]) => void)[] = [];

    const untilAborted = (signal: AbortSignal) => new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason as Error));
    });

    const objectFetcher: ObjectFetcher<Item> = {
        fetch: async (_data, options) => {
            const signal = options!.signal!;
            fetchSignals.push(signal);
            return Promise.race([
                untilAborted(signal),
                new Promise<{ results: Item[] }>((resolve) => {
                    pendingFetches.push(results => resolve({ results }));
                }),
            ]);
        },
        fetchCount: async (_data, options) => {
            countSignals.push(options!.signal!);
            return untilAborted(options!.signal!);
        },
    };

    return { objectFetcher, fetchSignals, countSignals, pendingFetches };
}

async function flush() {
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe('TableObjectFetcher', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('a reset aborts the running fetch and counts, without errors or retries', async () => {
        const errorSpy = vi.spyOn(console, 'error');
        const { objectFetcher, fetchSignals, countSignals, pendingFetches } = controllableFetcher();
        const fetcher = new TableObjectFetcher<Item>({ objectFetcher });

        fetcher.setVisible(0, 9);
        fetcher.reset(true, true);

        expect(fetchSignals).toHaveLength(1);
        expect(countSignals).toHaveLength(1);
        const firstSignals = [...fetchSignals, ...countSignals];
        expect(firstSignals.some(s => s.aborted)).toBe(false);

        fetcher.setSearchQuery('abc');
        fetcher.delayFetchUntil = null;
        const fetching = fetcher.fetchIfNeeded();
        await flush();

        expect(firstSignals.every(s => s.aborted)).toBe(true);
        expect(fetchSignals).toHaveLength(2);
        expect(fetchSignals[1].aborted).toBe(false);
        expect(fetcher.errorState).toBeNull();
        expect(errorSpy).not.toHaveBeenCalled();

        pendingFetches[1]([{ id: 'a' }]);
        await fetching;

        expect(fetcher.objects.map(o => o.id)).toEqual(['a']);
        fetcher.destroy();
    });

    test('destroy aborts the running fetch', async () => {
        const errorSpy = vi.spyOn(console, 'error');
        const { objectFetcher, fetchSignals } = controllableFetcher();
        const fetcher = new TableObjectFetcher<Item>({ objectFetcher });

        fetcher.setVisible(0, 9);
        fetcher.reset(true, true);
        fetcher.destroy();
        await flush();

        expect(fetchSignals).toHaveLength(1);
        expect(fetchSignals[0].aborted).toBe(true);
        expect(errorSpy).not.toHaveBeenCalled();
    });
});
