import { DataValidator } from '@stamhoofd/utility';
import { Country } from '../addresses/CountryDecoder.js';
import { StamhoofdFilter } from './StamhoofdFilter.js';

export type ParsePhoneNumber = (search: string, country: Country) => { isValid: () => boolean; formatInternational: () => string };

export class SearchFilterFactory {
    static getIntegerFilter(search: string): StamhoofdFilter | null {
        const parsedInt = Number.parseInt(search);

        if (!Number.isNaN(parsedInt) && !(search.length > 1 && search[0] === '0')) {
            return {
                $eq: parsedInt,
            };
        }

        return null;
    }

    static getEmailFilter(search: string): StamhoofdFilter | null {
        if (search.includes('@')) {
            const isCompleteAddress = DataValidator.isEmailValid(search);
            return {
                [(isCompleteAddress ? '$eq' : '$contains')]: search,
            };
        }

        return null;
    }

    static getPhoneFilter(search: string, parsePhoneNumber: ParsePhoneNumber): StamhoofdFilter | null {
        if (search.match(/^\+?[0-9\s-]+$/)) {
            try {
                // todo: how to determine country?
                const phoneNumber = parsePhoneNumber(search, Country.Belgium);

                if (phoneNumber && phoneNumber.isValid()) {
                    const formatted = phoneNumber.formatInternational();
                    return {
                        $eq: formatted,
                    };
                }
            }
            catch (e) {
                console.error('Failed to parse phone number', search, e);
            }
        }

        return null;
    }
}
