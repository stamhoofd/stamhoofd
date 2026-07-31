import type { StamhoofdFilter } from '@stamhoofd/structures';
import { LimitedFilteredRequest } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { MAX_BREAKDOWN_OBJECTS, streamForBreakdown } from './streamForBreakdown.js';

describe('streamForBreakdown', () => {
    /**
     * Hands out pages of numbers, the way an endpoint hands out pages of objects: where to continue is
     * carried by the request itself, so a page is only skipped or read twice when the caller loses it.
     */
    const createFetcher = (totalObjects: number) => {
        const requests: LimitedFilteredRequest[] = [];

        const fetch = (request: LimitedFilteredRequest) => {
            requests.push(request);

            const start = (request.pageFilter as { id: { $gt: number } } | null)?.id.$gt ?? 0;
            const results = Array.from({ length: Math.min(request.limit, Math.max(0, totalObjects - start)) }, (_, index) => start + index);
            const end = start + results.length;

            return Promise.resolve({
                results,
                next: end < totalObjects
                    ? new LimitedFilteredRequest({
                            filter: request.filter,
                            search: request.search,
                            sort: request.sort,
                            limit: request.limit,
                            pageFilter: { id: { $gt: end } },
                        })
                    : undefined,
            });
        };

        return { fetch, requests };
    };

    const stream = async (totalObjects: number, selection: { filter?: StamhoofdFilter; search?: string | null } = {}) => {
        const { fetch, requests } = createFetcher(totalObjects);
        const handled: number[] = [];
        const countRequests: { filter: StamhoofdFilter; search: string | null }[] = [];

        await streamForBreakdown<number>({
            userId: uuidv4(),
            filter: selection.filter ?? null,
            search: selection.search ?? null,
            count: (request) => {
                countRequests.push({ filter: request.filter, search: request.search });
                return Promise.resolve(totalObjects);
            },
            fetch,
            handle: (results) => {
                handled.push(...results);
            },
        });

        return { handled, requests, countRequests };
    };

    test('every object is handed over once, page by page', async () => {
        const { handled, requests } = await stream(250);

        // No object is read twice or skipped, whatever the pages look like
        expect(handled).toEqual(Array.from({ length: 250 }, (_, index) => index));

        // Read in pages, sorted so the pages line up
        expect(requests.length).toBeGreaterThan(1);
        expect(requests[0].sort.map(s => s.key)).toEqual(['id']);
    });

    test('the selection is read exactly as it was asked for', async () => {
        const filter = { status: 'Succeeded' };
        const { requests, countRequests } = await stream(250, { filter, search: 'Peeters' });

        // Every page reads the same selection, so a page never holds objects the breakdown did not count
        for (const request of requests) {
            expect(request.filter).toEqual(filter);
            expect(request.search).toBe('Peeters');
        }

        expect(countRequests).toEqual([{ filter, search: 'Peeters' }]);
    });

    test('an empty selection hands over nothing', async () => {
        const { handled } = await stream(0);
        expect(handled).toHaveLength(0);
    });

    test('a selection that is too large to break down asks the user to narrow it down', async () => {
        await expect(stream(MAX_BREAKDOWN_OBJECTS + 1)).rejects.toThrow('Too many objects to break down');
    });

    test('a selection that is too large is refused before it is read', async () => {
        const { fetch, requests } = createFetcher(MAX_BREAKDOWN_OBJECTS + 1);

        await expect(streamForBreakdown<number>({
            userId: uuidv4(),
            filter: null,
            search: null,
            count: () => Promise.resolve(MAX_BREAKDOWN_OBJECTS + 1),
            fetch,
            handle: () => {},
        })).rejects.toThrow('Too many objects to break down');

        expect(requests).toHaveLength(0);
    });
});
