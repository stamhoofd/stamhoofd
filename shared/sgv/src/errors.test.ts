import { ObjectData } from '@simonbackx/simple-encoding';
import { SGVErrorsDecoder } from './errors.js';

describe('@stamhoofd/sgv errors', () => {
    it('decodes fouten arrays', () => {
        const errors = decode({
            fouten: [
                {
                    beschrijving: 'Straat is verplicht',
                    veld: 'adressen[0].straat',
                },
            ],
        });

        expect(errors.errors).toHaveLength(1);
        expect(errors.errors[0].message).toBe('Straat is verplicht');
        expect(errors.errors[0].field).toBe('adressen[0].straat');
    });

    it('decodes msg responses', () => {
        const errors = decode({ msg: 'Niet toegelaten' });

        expect(errors.errors).toHaveLength(1);
        expect(errors.errors[0].message).toBe('Niet toegelaten');
    });

    it('decodes title and description responses', () => {
        const errors = decode({
            titel: 'Validatiefout',
            beschrijving: 'Huisnummer ontbreekt',
        });

        expect(errors.errors).toHaveLength(1);
        expect(errors.errors[0].message).toBe(
            'Validatiefout: Huisnummer ontbreekt',
        );
    });

    it('decodes boodschap responses', () => {
        const errors = decode({ boodschap: 'Interne fout' });

        expect(errors.errors).toHaveLength(1);
        expect(errors.errors[0].message).toBe('Interne fout');
    });

    it('falls back for unknown JSON responses', () => {
        const errors = decode({ unexpected: true });

        expect(errors.errors).toHaveLength(1);
        expect(errors.errors[0].message).toBe('{"unexpected":true}');
        expect(errors.errors[0].human).toContain(
            'Foutmelding van de groepsadministratie',
        );
    });
});

function decode(data: Record<string, unknown>) {
    return new SGVErrorsDecoder().decode(new ObjectData(data, { version: 0 }));
}
