import type { Decoder } from '@simonbackx/simple-encoding';
import type { ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';

/** Error payload shape returned by SGV for validation and business-rule failures. */
export type SGVErrorResponse = {
    fouten: Array<{
        beschrijving: string;
        veld?: string;
    }>;
};

/** Creates a minimal SGV-compatible error payload for tests and the mock backend. */
export function createSGVErrorResponse(
    beschrijving: string,
    veld?: string,
): SGVErrorResponse {
    return {
        fouten: [
            {
                beschrijving,
                ...(veld ? { veld } : {}),
            },
        ],
    };
}

/** Converts one SGV error object into Stamhoofd's SimpleError format. */
export class SGVErrorDecoder implements Decoder<SimpleError> {
    decode(data: ObjectData): SimpleError {
        return new SimpleError({
            code: 'SGVError',
            message: data.field('beschrijving').string,
            field: data.optionalField('veld')?.string,
        });
    }
}

/**
 * Decodes the different error envelopes SGV uses into SimpleErrors.
 * SGV is not consistent across endpoints, so this also handles legacy message fields and keeps the raw payload as fallback.
 */
export class SGVErrorsDecoder implements Decoder<SimpleErrors> {
    decode(data: ObjectData): SimpleErrors {
        const fouten = data.optionalField('fouten');
        if (fouten) {
            const errors = fouten.array(new SGVErrorDecoder());
            if (errors.length > 0) {
                return new SimpleErrors(...errors);
            }
        }

        const msg = data.optionalField('msg')?.string;
        if (msg) {
            return new SimpleErrors(
                new SimpleError({ code: 'SGVError', message: msg }),
            );
        }

        const title
            = data.optionalField('titel')?.string
                ?? data.optionalField('boodschap')?.string;
        if (title) {
            const description = data.optionalField('beschrijving')?.string;
            return new SimpleErrors(
                new SimpleError({
                    code: 'SGVError',
                    message: title + (description ? `: ${description}` : ''),
                }),
            );
        }

        let message = 'Onbekende foutmelding van de groepsadministratie';
        try {
            message = JSON.stringify(data.data);
        } catch {
            message = `${data.data}`;
        }

        return new SimpleErrors(
            new SimpleError({
                code: 'unknown_SGVError',
                message,
                human: `Foutmelding van de groepsadministratie. Kijk na of er niets vreemd is aan de gegevens van dit lid, zoals een adres zonder huisnummer, foutieve postcode, rare straat en huisnummer volgorde, postcode of gemeente ingevuld bij straatnaam, onjuiste schrijfwijze straat, ... en probeer opnieuw. Foutmelding groepsadministratie: ${message}`,
            }),
        );
    }
}
