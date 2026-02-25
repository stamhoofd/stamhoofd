import { STExpect } from '@stamhoofd/test-utils';
import { UitpasService } from './UitpasService.js';

describe.skip('UitpasService', () => {
    it('should validate a correct Uitpas number with kansentarief', async () => {
        const validNumbers = ['0900000067513'];
        await expect(UitpasService.checkUitpasNumbers(validNumbers)).resolves.toBeUndefined();
    });

    it('should throw an error for an invalid Uitpas number', async () => {
        const invalidNumbers = ['1234567890123'];
        await expect(UitpasService.checkUitpasNumbers(invalidNumbers)).rejects.toThrow(
            STExpect.simpleError({ code: 'unsuccessful_but_expected_response_retrieving_pass_by_uitpas_number' }),
        );
    });

    it('should throw an error for a Uitpas number with kansentarief expired', async () => {
        const expiredNumbers = ['0900000058918'];
        await expect(UitpasService.checkUitpasNumbers(expiredNumbers)).rejects.toThrow(
            STExpect.simpleError({ code: 'uitpas_number_issue' }),
        );
    });
});
