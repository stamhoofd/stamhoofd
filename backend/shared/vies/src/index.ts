import { ViesCachedResult } from '@stamhoofd/models/models/ViesCachedResult.js';
import { Country } from '@stamhoofd/types/Country';

const CacheMonths = 6;

export class ViesServiceStatic {
    async request(method: 'POST', url: string, content: unknown) {
        const json = JSON.stringify(content);

        console.log('[VIES REQUEST]', method, url, '\n [VIES REQUEST] ', json);

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: json,
            signal: AbortSignal.timeout(5_000),
        });

        if (!response.ok) {
            throw new Error(`VIES request failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log('[VIES RESPONSE]', method, url, '\n[VIES RESPONSE]', JSON.stringify(data));
        return {
            data,
            response,
        };
    }

    async checkVATNumber(country: Country, vatNumber: string): Promise<boolean> {
        const cleanedVATNumber = vatNumber.replace(/[^a-z0-9]+/gi, '').toUpperCase();
        const cached = await ViesCachedResult.getByID(cleanedVATNumber);

        const freshAfter = new Date();
        freshAfter.setMonth(freshAfter.getMonth() - CacheMonths);

        if (cached && cached.checkedAt >= freshAfter) {
            return cached.result;
        }

        let result: boolean;
        try {
            const { data, response } = await this.request('POST', 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number', {
                countryCode: country,
                vatNumber: cleanedVATNumber.substring(2),
            });

            if (typeof data !== 'object' || data === null || !('valid' in data) || typeof data.valid !== 'boolean') {
                console.error('VIES error', response.status, response.statusText, data);
                throw new Error('Invalid response from VIES');
            }

            result = data.valid;
        }
        catch (error) {
            console.error('VIES error', error);
            if (cached) {
                return cached.result;
            }
            throw error;
        }

        await ViesCachedResult.saveResult(cleanedVATNumber, result, new Date());
        return result;
    }
}

export const ViesService = new ViesServiceStatic();
