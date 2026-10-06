import { LimitedFilteredRequest } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import type { ObjectFetcher } from './ObjectFetcher';
import { fetchAll } from './ObjectFetcher';

function pagedFetcher(pages: number[][]): ObjectFetcher<number> {
    return {
        fetch: async (data) => {
            const index = data.pageFilter ? (data.pageFilter as { page: number }).page : 0;
            const next = index + 1 < pages.length
                ? new LimitedFilteredRequest({ filter: data.filter, pageFilter: { page: index + 1 }, limit: data.limit })
                : undefined;
            return Promise.resolve({ results: pages[index], next });
        },
        fetchCount: async () => Promise.resolve(pages.flat().length),
    };
}

describe('fetchAll', () => {
    test('passes each page to onResultsReceived once and returns all results', async () => {
        const received: number[][] = [];

        const results = await fetchAll(new LimitedFilteredRequest({ limit: 2 }), pagedFetcher([[1, 2], [3, 4], [5]]), {
            onResultsReceived: (page) => {
                received.push([...page]);
            },
        });

        expect(received).toEqual([[1, 2], [3, 4], [5]]);
        expect(results).toEqual([1, 2, 3, 4, 5]);
    });

    describe('countAfterFirstPage', () => {
        test('skips the count and progress for a single page', async () => {
            let counts = 0;
            const progress: [number, number][] = [];

            await fetchAll(new LimitedFilteredRequest({ limit: 2 }), pagedFetcher([[1, 2]]), {
                countAfterFirstPage: async () => {
                    counts++;
                    return Promise.resolve(2);
                },
                onProgress: (count, total) => {
                    progress.push([count, total]);
                },
            });

            expect(counts).toBe(0);
            expect(progress).toEqual([]);
        });

        test('counts once when more pages follow and reports progress from then on', async () => {
            let counts = 0;
            const progress: [number, number][] = [];

            await fetchAll(new LimitedFilteredRequest({ limit: 2 }), pagedFetcher([[1, 2], [3, 4], [5]]), {
                countAfterFirstPage: async () => {
                    counts++;
                    // Lower than the actual number of results, as if results were added while fetching
                    return Promise.resolve(4);
                },
                onProgress: (count, total) => {
                    progress.push([count, total]);
                },
            });

            expect(counts).toBe(1);
            expect(progress.at(-1)).toEqual([5, 5]);
        });

        test('does not wait for the count before fetching the next page', async () => {
            const progress: [number, number][] = [];

            const results = await fetchAll(new LimitedFilteredRequest({ limit: 2 }), pagedFetcher([[1, 2], [3]]), {
                countAfterFirstPage: async () => new Promise<number>(() => {}),
                onProgress: (count, total) => {
                    progress.push([count, total]);
                },
            });

            expect(results).toEqual([1, 2, 3]);
            expect(progress).toEqual([]);
        });

        test('reports progress as soon as the count is known', async () => {
            const progress: [number, number][] = [];
            let releaseSecondPage!: () => void;
            const secondPageReleased = new Promise<void>((resolve) => {
                releaseSecondPage = resolve;
            });

            const fetcher = pagedFetcher([[1, 2], [3]]);
            const fetching = fetchAll(new LimitedFilteredRequest({ limit: 2 }), {
                ...fetcher,
                fetch: async (data) => {
                    if (data.pageFilter) {
                        await secondPageReleased;
                    }
                    return fetcher.fetch(data);
                },
            }, {
                countAfterFirstPage: async () => Promise.resolve(3),
                onProgress: (count, total) => {
                    progress.push([count, total]);
                },
            });

            await expect.poll(() => progress).toEqual([[2, 3]]);
            releaseSecondPage();
            await fetching;
            expect(progress).toEqual([[2, 3], [3, 3]]);
        });

        test('continues without progress when the count fails', async () => {
            const progress: [number, number][] = [];

            const results = await fetchAll(new LimitedFilteredRequest({ limit: 2 }), pagedFetcher([[1, 2], [3]]), {
                countAfterFirstPage: async () => Promise.reject(new Error('Count failed')),
                onProgress: (count, total) => {
                    progress.push([count, total]);
                },
            });

            expect(results).toEqual([1, 2, 3]);
            expect(progress).toEqual([]);
        });

        test('reports no progress when the count is null', async () => {
            const progress: [number, number][] = [];

            await fetchAll(new LimitedFilteredRequest({ limit: 2 }), pagedFetcher([[1, 2], [3]]), {
                countAfterFirstPage: async () => Promise.resolve(null),
                onProgress: (count, total) => {
                    progress.push([count, total]);
                },
            });

            expect(progress).toEqual([]);
        });
    });
});
