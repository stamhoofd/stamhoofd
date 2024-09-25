import { IPaginatedResponse, LimitedFilteredRequest } from '@stamhoofd/structures';

export function fetchToAsyncIterator<T>(
    initialFilter: LimitedFilteredRequest,
    loader: {
        fetch(request: LimitedFilteredRequest): Promise<IPaginatedResponse<T, LimitedFilteredRequest>>;
    },
): AsyncIterable<T> {
    return {
        [Symbol.asyncIterator]: function () {
            let request: LimitedFilteredRequest | null = initialFilter;

            return {
                async next(): Promise<IteratorResult<T, undefined>> {
                    if (!request) {
                        return {
                            done: true,
                            value: undefined,
                        };
                    }

                    const response = await loader.fetch(request);
                    request = response.next ?? null;

                    return {
                        done: false,
                        value: response.results,
                    };
                },
            };
        },
    };
}
