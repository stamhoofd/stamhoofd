import { SimpleError } from '@simonbackx/simple-errors';
import { LimitedFilteredRequest } from '@stamhoofd/structures';

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
}
