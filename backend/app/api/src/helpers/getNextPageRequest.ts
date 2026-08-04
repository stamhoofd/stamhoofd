import type { SQLSortDefinitions } from '@stamhoofd/sql';
import { getSortFilter, LimitedFilteredRequest } from '@stamhoofd/structures';

/**
 * The request that reads the page after this one, or undefined when this was the last page.
 *
 * Pages are walked with a cursor built from the last object of the page instead of an offset, so a page
 * is never skipped or read twice while the list changes underneath. A cursor that doesn't move past the
 * one it came from would read the same page forever, so it ends the list instead.
 */
export function getNextPageRequest<T>(objects: T[], requestQuery: LimitedFilteredRequest, sorters: SQLSortDefinitions<T>): LimitedFilteredRequest | undefined {
    if (objects.length < requestQuery.limit) {
        return undefined;
    }

    const nextFilter = getSortFilter(objects[objects.length - 1], sorters, requestQuery.sort);

    if (JSON.stringify(nextFilter) === JSON.stringify(requestQuery.pageFilter)) {
        console.error('Found infinite loading loop for', requestQuery);
        return undefined;
    }

    return new LimitedFilteredRequest({ ...requestQuery, pageFilter: nextFilter });
}
