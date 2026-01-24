import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { DataValidator } from '@stamhoofd/utility';
import { PassholderEndpoints } from './PassholderEndpoints.js';

export function throwIfInvalidUitpasNumber(uitpasNumber: string) {
    if (!DataValidator.isUitpasNumberValid(uitpasNumber)) {
        throw new SimpleError({
            statusCode: 400,
            code: 'invalid_uitpas_number',
            message: `Invalid UiTPAS number: ${uitpasNumber}`,
            human: $t(
                `Het opgegeven UiTPAS-nummer is ongeldig. Controleer het nummer en probeer het opnieuw.`,
            ),
        });
    }
}

/**
 * Checks multiple uitpas numbers
 * If any of the uitpas numbers is invalid, it will throw a SimpleErrors instance with all errors.
 * The field of the error will be the index of the uitpas number in the array.
 * @param uitpasNumbers The uitpas numbers to check
 */
export async function checkUitpasNumbers(access_token: string, uitpasNumbers: string[]) {
    const passholderEndpoints = new PassholderEndpoints(access_token);

    const simpleErrors = new SimpleErrors();
    for (let i = 0; i < uitpasNumbers.length; i++) {
        const uitpasNumber = uitpasNumbers[i];
        try {
            throwIfInvalidUitpasNumber(uitpasNumber);
            const result = await passholderEndpoints.getPassByUitpasNumber(uitpasNumber);
            if (result.socialTariff.status !== 'ACTIVE') {
                new SimpleError({
                    code: 'non_active_social_tariff',
                    message: `UiTPAS social tariff is not ACTIVE but ${result.socialTariff.status}`,
                    human: $t(
                        `Het opgegeven UiTPAS-nummer heeft geen actief kansentarief. Neem contact op met de UiTPAS-organisatie voor meer informatie.`,
                    ),
                });
            }
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace(i.toString());
                e.addNamespace('uitpasNumbers');
                simpleErrors.addError(e);
            }
            else {
                throw e;
            }
        }
    }
    if (simpleErrors.errors.length > 0) {
        throw simpleErrors;
    }
}
