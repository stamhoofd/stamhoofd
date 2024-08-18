import { EncodableObject } from "@simonbackx/simple-encoding";
import { LimitedFilteredRequest, PaginatedResponse } from "@stamhoofd/structures";

export function fetchToAsyncIterator<T extends EncodableObject>(
    initialFilter: LimitedFilteredRequest, 
    loader: {
        fetch(request: LimitedFilteredRequest): Promise<PaginatedResponse<T, LimitedFilteredRequest>>
    }
): AsyncIterable<T> {
    return {
        [Symbol.asyncIterator]: function () {
            let request: LimitedFilteredRequest|null = initialFilter

            return {
                async next(): Promise<IteratorResult<T, undefined>> {
                    if (!request) {
                        return {
                            done: true,
                            value: undefined
                        }
                    }

                    const response = await loader.fetch(request);
                    request = response.next ?? null;
                    
                    return {
                        done: false,
                        value: response.results
                    }
                }
            }
        }
    }
}
