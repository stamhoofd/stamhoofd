import type { Country } from '@stamhoofd/types/Country';

export class ViesApiStatic {
    private async request(method: 'POST', url: string, content: unknown) {
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
        const { data, response } = await this.request('POST', 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number', {
            countryCode: country,
            vatNumber: vatNumber.substring(2),
        });

        if (typeof data !== 'object' || data === null || !('valid' in data) || typeof data.valid !== 'boolean') {
            console.error('VIES error', response.status, response.statusText, data);
            throw new Error('Invalid response from VIES');
        }

        return data.valid;
    }
}

export const ViesApi = new ViesApiStatic();
