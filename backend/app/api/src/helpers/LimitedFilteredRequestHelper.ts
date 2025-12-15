import { SimpleError } from '@simonbackx/simple-errors';
import { SQLSortDefinitions } from '@stamhoofd/sql';
import { getSortFilter, LimitedFilteredRequest } from '@stamhoofd/structures';

export class LimitedFilteredRequestHelper {
    static throwIfInvalidLimit({ request, maxLimit }: { request: LimitedFilteredRequest; maxLimit: number }) {
        const requestLimit = request.limit;

        if (requestLimit > maxLimit) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be more than ' + maxLimit,
            });
        }

        if (requestLimit < 1) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be less than 1',
            });
        }
    }

    static fixInfiniteLoadingLoop<T>({ request, results, sorters }: { request: LimitedFilteredRequest; results: T[]; sorters: SQLSortDefinitions<T> }): LimitedFilteredRequest | undefined {
        let next: LimitedFilteredRequest | undefined;

        if (results.length >= request.limit) {
            const lastObject = results[results.length - 1];
            const nextFilter = getSortFilter(lastObject, sorters, request.sort);

            next = new LimitedFilteredRequest({
                filter: request.filter,
                pageFilter: nextFilter,
                sort: request.sort,
                limit: request.limit,
                search: request.search,
            });

            if (JSON.stringify(nextFilter) === JSON.stringify(request.pageFilter)) {
                console.error('Found infinite loading loop for', request);
                next = undefined;
            }
        }

        return next;
    }

    static fixInfiniteLoadingLoopWithTransform<R, T>({ request, results, sorters, transformer }: { request: LimitedFilteredRequest; results: R[]; sorters: SQLSortDefinitions<T>; transformer: (r: R) => T }): LimitedFilteredRequest | undefined {
        let next: LimitedFilteredRequest | undefined;

        if (results.length >= request.limit) {
            const lastObject = transformer(results[results.length - 1]);
            const nextFilter = getSortFilter(lastObject, sorters, request.sort);

            next = new LimitedFilteredRequest({
                filter: request.filter,
                pageFilter: nextFilter,
                sort: request.sort,
                limit: request.limit,
                search: request.search,
            });

            if (JSON.stringify(nextFilter) === JSON.stringify(request.pageFilter)) {
                console.error('Found infinite loading loop for', request);
                next = undefined;
            }
        }

        return next;
    }
}
