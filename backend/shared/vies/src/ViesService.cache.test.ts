import { ViesCachedResult } from '@stamhoofd/models/models/ViesCachedResult.js';
import { STExpect } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import nock from 'nock';
import { ViesService } from './ViesService.js';

const VIES_HOST = 'https://ec.europa.eu';
const VIES_PATH = '/taxation_customs/vies/rest-api/check-vat-number';
const VAT_NUMBER = 'BE0411905847';
const NOW = new Date('2026-08-18T12:00:00.000Z');

describe('ViesService cache', () => {
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

    test('returns a fresh cached valid result without contacting VIES', async () => {
        await cache(true, new Date('2026-02-18T12:00:00.000Z'));
        const scope = mockVies({ valid: false });

        await expect(ViesService.checkVATNumber(Country.Belgium, VAT_NUMBER)).resolves.toBe(VAT_NUMBER);
        expect(scope.isDone()).toBe(false);
    });

    test('returns a fresh cached invalid result without contacting VIES', async () => {
        await cache(false, new Date('2026-02-18T12:00:00.000Z'));
        const scope = mockVies({ valid: true });

        await expect(ViesService.checkVATNumber(Country.Belgium, VAT_NUMBER)).rejects.toThrow(
            STExpect.simpleError({ code: 'invalid_field', field: 'VATNumber' }),
        );
        expect(scope.isDone()).toBe(false);
    });

    test('stores a successful valid API result with the cleaned VAT number', async () => {
        mockVies({ valid: true });

        await expect(ViesService.checkVATNumber(Country.Belgium, 'BE 0411.905.847')).resolves.toBe(VAT_NUMBER);

        const cached = await ViesCachedResult.getByID(VAT_NUMBER);
        expect(cached).toMatchObject({
            VATNumber: VAT_NUMBER,
            result: true,
            checkedAt: NOW,
        });
    });

    test('stores a successful invalid API result with the cleaned VAT number', async () => {
        mockVies({ valid: false });

        await expect(ViesService.checkVATNumber(Country.Belgium, 'BE 0411.905.847')).rejects.toThrow(
            STExpect.simpleError({ code: 'invalid_field', field: 'VATNumber' }),
        );

        const cached = await ViesCachedResult.getByID(VAT_NUMBER);
        expect(cached).toMatchObject({
            VATNumber: VAT_NUMBER,
            result: false,
            checkedAt: NOW,
        });
    });

    test('refreshes a result older than six months', async () => {
        await cache(true, new Date('2026-02-17T12:00:00.000Z'));
        const scope = mockVies({ valid: false });

        await expect(ViesService.checkVATNumber(Country.Belgium, VAT_NUMBER)).rejects.toThrow(
            STExpect.simpleError({ code: 'invalid_field', field: 'VATNumber' }),
        );
        expect(scope.isDone()).toBe(true);
        expect(await ViesCachedResult.getByID(VAT_NUMBER)).toMatchObject({
            result: false,
            checkedAt: NOW,
        });
    });

    test('falls back to a stale cached valid result when VIES is unavailable', async () => {
        const checkedAt = new Date('2026-02-17T12:00:00.000Z');
        await cache(true, checkedAt);
        mockVies({ message: 'Internal Server Error' }, 500);

        await expect(ViesService.checkVATNumber(Country.Belgium, VAT_NUMBER)).resolves.toBe(VAT_NUMBER);
        expect(await ViesCachedResult.getByID(VAT_NUMBER)).toMatchObject({
            result: true,
            checkedAt,
        });
    });

    test('falls back to a stale cached invalid result when VIES is unavailable', async () => {
        const checkedAt = new Date('2026-02-17T12:00:00.000Z');
        await cache(false, checkedAt);
        mockVies({ message: 'Internal Server Error' }, 500);

        await expect(ViesService.checkVATNumber(Country.Belgium, VAT_NUMBER)).rejects.toThrow(
            STExpect.simpleError({ code: 'invalid_field', field: 'VATNumber' }),
        );
        expect(await ViesCachedResult.getByID(VAT_NUMBER)).toMatchObject({
            result: false,
            checkedAt,
        });
    });

    test('throws when VIES is unavailable and no cached result exists', async () => {
        mockVies({ message: 'Internal Server Error' }, 500);

        await expect(ViesService.checkVATNumber(Country.Belgium, VAT_NUMBER)).rejects.toThrow(
            STExpect.simpleError({ code: 'service_unavailable', field: 'VATNumber' }),
        );
    });

    describe('checkCompanyNumber', () => {
        test('throws when VIES is unavailable and no cached result exists', async () => {
            mockVies({ message: 'Internal Server Error' }, 500);

            await expect(ViesService.checkCompanyNumber(Country.Belgium, '0411905847')).rejects.toThrow(
                STExpect.simpleError({ code: 'service_unavailable', field: 'VATNumber' }),
            );
        });

        test('falls back to a stale cached valid result when VIES is unavailable', async () => {
            await cache(true, new Date('2026-02-17T12:00:00.000Z'));
            mockVies({ message: 'Internal Server Error' }, 500);

            await expect(ViesService.checkCompanyNumber(Country.Belgium, '0411905847')).resolves.toEqual({
                companyNumber: '0411905847',
                VATNumber: VAT_NUMBER,
            });
        });

        test('falls back to a stale cached invalid result when VIES is unavailable', async () => {
            await cache(false, new Date('2026-02-17T12:00:00.000Z'));
            mockVies({ message: 'Internal Server Error' }, 500);

            await expect(ViesService.checkCompanyNumber(Country.Belgium, '0411905847')).resolves.toEqual({
                companyNumber: '0411905847',
                VATNumber: null,
            });
        });
    });
});
