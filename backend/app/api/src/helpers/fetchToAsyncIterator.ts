import { IPaginatedResponse, LimitedFilteredRequest } from '@stamhoofd/structures';
import { FileSignService } from '../services/FileSignService.js';

export function fetchToAsyncIterator<T>(
    initialFilter: LimitedFilteredRequest,
    loader: {
        fetch(request: LimitedFilteredRequest): Promise<IPaginatedResponse<T, LimitedFilteredRequest>>;
    },
    options?: {
        signFiles?: boolean;
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
                    if (options?.signFiles) {
                        await FileSignService.fillSignedUrlsForStruct(response.results);
                    }
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
