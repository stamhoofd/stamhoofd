import type { ParsePhoneNumber } from './SearchFilterFactory.js';
import { SearchFilterFactory } from './SearchFilterFactory.js';
import type { StamhoofdFilter } from '@stamhoofd/filters/StamhoofdFilter';

export function getOrderSearchFilter(search: string | null, parsePhoneNumber: ParsePhoneNumber): StamhoofdFilter | null {
    if (search === null || search === undefined || search === '') {
        return null;
    }

    // Only digits: '100%', '12 34' or '+32 478 12 34 56' are no order number
    const numberFilter = /^\d+$/.test(search) ? SearchFilterFactory.getIntegerFilter(search) : null;

    if (numberFilter) {
        return {
            number: numberFilter,
        };
    }

    const emailFilter = SearchFilterFactory.getEmailFilter(search);

    if (emailFilter) {
        return {
            email: emailFilter,
        };
    }

    const phoneFilter = SearchFilterFactory.getPhoneFilter(search, parsePhoneNumber);

    if (phoneFilter) {
        return {
            phone: phoneFilter,
        };
    }

    return {
        name: {
            $contains: search,
        },
    };
}
