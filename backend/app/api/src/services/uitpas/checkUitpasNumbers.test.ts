import { STExpect } from '@stamhoofd/test-utils';
import { checkUitpasNumbers } from './checkUitpasNumbers.js';
import { PassholderEndpoints } from './PassholderEndpoints.js';

/**
 * Exercises tariff validation with a valid UiTPAS number. Only the passholder
 * lookup is mocked, so no UiTPAS service is contacted and the token is a placeholder;
 * number validation and aggregation of field-specific errors run normally.
 */
describe('checkUitpasNumbers', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * Each non-active status must reject with a tariff error attached to the first
     * input's field. Checking the aggregate's error entry verifies that callers can
     * associate the failure with the submitted number, not just catch a rejection.
     */
    it.each(['NONE', 'EXPIRED', 'UNKNOWN'] as const)('rejects a %s social tariff', async (status) => {
        const uitpasNumber = '0900000031618';
        vi.spyOn(PassholderEndpoints.prototype, 'getPassByUitpasNumber').mockResolvedValue({
            uitpasNumber,
            socialTariff: { status },
        });

        await expect(checkUitpasNumbers('test-token', [uitpasNumber])).rejects.toMatchObject({
            errors: [STExpect.simpleError({ code: 'non_active_social_tariff', field: 'uitpasNumbers.0' })],
        });
    });

    /**
     * Positive control: an active tariff completes without a result or validation
     * error, so rejecting every passholder response cannot satisfy this suite.
     */
    it('accepts an ACTIVE social tariff', async () => {
        const uitpasNumber = '0900000031618';
        vi.spyOn(PassholderEndpoints.prototype, 'getPassByUitpasNumber').mockResolvedValue({
            uitpasNumber,
            socialTariff: { status: 'ACTIVE' },
        });

        await expect(checkUitpasNumbers('test-token', [uitpasNumber])).resolves.toBeUndefined();
    });
});
