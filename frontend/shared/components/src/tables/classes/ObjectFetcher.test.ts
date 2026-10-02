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
});
