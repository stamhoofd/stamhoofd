import { Country } from '@stamhoofd/types/Country';
import nock from 'nock';
import { ViesApi } from './ViesApi.js';

const VIES_HOST = 'https://ec.europa.eu';
const VIES_PATH = '/taxation_customs/vies/rest-api/check-vat-number';

describe('ViesApi', () => {
    test.each([
        [Country.Belgium, 'BE0411905847', '0411905847'],
        [Country.Netherlands, 'NL301828519B01', '301828519B01'],
    ])('sends %s VAT numbers without the country prefix', async (country, VATNumber, requestVATNumber) => {
        let requestBody: unknown;
        nock(VIES_HOST)
            .post(VIES_PATH, (body) => {
                requestBody = body;
                return true;
            })
            .reply(200, { valid: true });

        await expect(ViesApi.checkVATNumber(country, VATNumber)).resolves.toBe(true);
        expect(requestBody).toEqual({
            countryCode: country,
            vatNumber: requestVATNumber,
        });
    });

    test('returns an invalid result', async () => {
        nock(VIES_HOST).post(VIES_PATH).reply(200, { valid: false });

        await expect(ViesApi.checkVATNumber(Country.Belgium, 'BE0411905847')).resolves.toBe(false);
    });

    test.each([
        { somethingElse: true },
        '"plain string"',
    ])('rejects an invalid response body', async (response) => {
        nock(VIES_HOST).post(VIES_PATH).reply(200, response);

        await expect(ViesApi.checkVATNumber(Country.Belgium, 'BE0411905847')).rejects.toThrow('Invalid response from VIES');
    });

    test('rejects an unsuccessful response', async () => {
        nock(VIES_HOST).post(VIES_PATH).reply(500, { message: 'Internal Server Error' });

        await expect(ViesApi.checkVATNumber(Country.Belgium, 'BE0411905847')).rejects.toThrow('VIES request failed with status 500');
    });
});
