import { ParsePhoneNumber, SearchFilterFactory } from './SearchFilterFactory';
import { StamhoofdFilter } from './StamhoofdFilter';

export function getOrderSearchFilter(search: string | null, parsePhoneNumber: ParsePhoneNumber): StamhoofdFilter | null {
    if (search === null || search === undefined) {
        return null;
    }

    const numberFilter = SearchFilterFactory.getIntegerFilter(search);

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
