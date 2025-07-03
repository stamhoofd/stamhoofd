import { STExpect } from '@stamhoofd/test-utils';
import { UitpasNumberValidator } from './UitpasNumberValidator';

describe.skip('UitpasNumberValidator', () => {
    it('should validate a correct Uitpas number with kansentarief', async () => {
        const validNumber = '0900000067513';
        await expect(UitpasNumberValidator.checkUitpasNumber(validNumber)).resolves.toBeUndefined();
    });

    it('should throw an error for an invalid Uitpas number', async () => {
        const invalidNumber = '1234567890123';
        await expect(UitpasNumberValidator.checkUitpasNumber(invalidNumber)).rejects.toThrow(
            STExpect.simpleError({ code: 'error_retrieving_pass_by_uitpas_number' }),
        );
    });

    it('should throw an error for a Uitpas number with kansentarief expired', async () => {
        const expiredNumber = '0900000058918';
        await expect(UitpasNumberValidator.checkUitpasNumber(expiredNumber)).rejects.toThrow(
            STExpect.simpleError({ code: 'non_active_social_tariff' }),
        );
    });
});
