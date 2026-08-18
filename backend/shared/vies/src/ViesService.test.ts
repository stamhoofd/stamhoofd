import { ViesCachedResult } from '@stamhoofd/models/models/ViesCachedResult.js';
import { Country } from '@stamhoofd/types/Country';
import nock from 'nock';
import { ViesService } from './index.js';

const VIES_HOST = 'https://ec.europa.eu';
const VIES_PATH = '/taxation_customs/vies/rest-api/check-vat-number';
const VAT_NUMBER = 'BE0411905847';
const NOW = new Date('2026-08-18T12:00:00.000Z');

describe('ViesService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function mockVies(response: unknown, statusCode = 200) {
        return nock(VIES_HOST).post(VIES_PATH).reply(statusCode, response as nock.Body);
    }

    async function cache(result: boolean, checkedAt: Date) {
        await ViesCachedResult.saveResult(VAT_NUMBER, result, checkedAt);
    }

    test.each([true, false])('returns a fresh cached %s result without contacting VIES', async (result) => {
        await cache(result, new Date('2026-02-18T12:00:00.000Z'));
        const scope = mockVies({ valid: !result });

        await expect(ViesService.checkVATNumber(Country.Belgium, VAT_NUMBER)).resolves.toBe(result);
        expect(scope.isDone()).toBe(false);
    });

    test.each([true, false])('stores a successful %s result with the cleaned VAT number', async (result) => {
        mockVies({ valid: result });

        await expect(ViesService.checkVATNumber(Country.Belgium, 'BE 0411.905.847')).resolves.toBe(result);

        const cached = await ViesCachedResult.getByID(VAT_NUMBER);
        expect(cached).toMatchObject({
            VATNumber: VAT_NUMBER,
            result,
            checkedAt: NOW,
        });
    });

    test('refreshes a result older than six months', async () => {
        await cache(true, new Date('2026-02-17T12:00:00.000Z'));
        const scope = mockVies({ valid: false });

        await expect(ViesService.checkVATNumber(Country.Belgium, VAT_NUMBER)).resolves.toBe(false);
        expect(scope.isDone()).toBe(true);
        expect(await ViesCachedResult.getByID(VAT_NUMBER)).toMatchObject({
            result: false,
            checkedAt: NOW,
        });
    });

    test.each([true, false])('falls back to a stale cached %s result when VIES is unavailable', async (result) => {
        const checkedAt = new Date('2026-02-17T12:00:00.000Z');
        await cache(result, checkedAt);
        mockVies({ message: 'Internal Server Error' }, 500);

        await expect(ViesService.checkVATNumber(Country.Belgium, VAT_NUMBER)).resolves.toBe(result);
        expect(await ViesCachedResult.getByID(VAT_NUMBER)).toMatchObject({
            result,
            checkedAt,
        });
    });

    test('throws when VIES is unavailable and no cached result exists', async () => {
        mockVies({ message: 'Internal Server Error' }, 500);

        await expect(ViesService.checkVATNumber(Country.Belgium, VAT_NUMBER)).rejects.toThrow('VIES request failed with status 500');
    });

    test('sends the country and VAT number without its country prefix', async () => {
        let requestBody: unknown;
        nock(VIES_HOST)
            .post(VIES_PATH, (body) => {
                requestBody = body;
                return true;
            })
            .reply(200, { valid: true });

        await ViesService.checkVATNumber(Country.Belgium, VAT_NUMBER);

        expect(requestBody).toEqual({
            countryCode: Country.Belgium,
            vatNumber: '0411905847',
        });
    });
});
