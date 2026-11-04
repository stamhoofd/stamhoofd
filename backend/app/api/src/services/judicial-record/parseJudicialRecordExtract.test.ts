import { blankExtractLines } from '../../../tests/helpers/JudicialRecordExtract.js';
import { JudicialRecordLayoutError, parseJudicialRecordExtract } from './parseJudicialRecordExtract.js';

describe('parseJudicialRecordExtract', () => {
    it('reads every field of a blank extract', () => {
        const parsed = parseJudicialRecordExtract(blankExtractLines());

        expect(parsed.lastName).toBe('JANSSENS');
        expect(parsed.firstName).toBe('Jan');
        expect(parsed.birthDay).toEqual(new Date(Date.UTC(2006, 3, 5)));
        expect(parsed.issuedAt).toEqual(new Date(Date.UTC(2026, 9, 15)));
        expect(parsed.purpose).toBe('596.2 - model bestemd voor de contacten met minderjarigen');
        expect(parsed.isBlank).toBe(true);
    });

    it('reads the date from the header, not from the birth date in it', () => {
        const parsed = parseJudicialRecordExtract(blankExtractLines());

        // The header prints both dates: "Datum : 15/10/2026 Betreft : JANSSENS JAN - 05/04/2006"
        expect(parsed.issuedAt).toEqual(new Date(Date.UTC(2026, 9, 15)));
    });

    it('reads the date of the document, not the date next to the blank marker', () => {
        const parsed = parseJudicialRecordExtract(blankExtractLines({ blankMarker: 'BLANCO STRAFREGISTER (01/01/2020)' }));

        expect(parsed.issuedAt).toEqual(new Date(Date.UTC(2026, 9, 15)));
    });

    it('reads the purpose from the line below its label', () => {
        const parsed = parseJudicialRecordExtract(blankExtractLines({ purposeValue: 'model 596.1 - andere finaliteit' }));

        expect(parsed.purpose).toBe('model 596.1 - andere finaliteit');
    });

    it('accepts an alternative spelling of a label', () => {
        const parsed = parseJudicialRecordExtract(blankExtractLines({ lastName: 'Familienaam: JANSSENS' }));

        expect(parsed.lastName).toBe('JANSSENS');
    });

    it('is not blank when the marker is missing', () => {
        const parsed = parseJudicialRecordExtract(blankExtractLines({ blankMarker: 'Antecedenten: veroordeeld op 01/02/2020' }));

        expect(parsed.isBlank).toBe(false);
        // the other fields still resolve, so the individual checks decide what happens
        expect(parsed.lastName).toBe('JANSSENS');
    });

    it('does not read the birth date as the document date', () => {
        const parsed = parseJudicialRecordExtract(blankExtractLines({ documentDate: null }));

        expect(parsed.issuedAt).toBeNull();
        expect(parsed.birthDay).toEqual(new Date(Date.UTC(2006, 3, 5)));
    });

    it('returns null for a field that is missing', () => {
        const parsed = parseJudicialRecordExtract(blankExtractLines({ firstName: null }));

        expect(parsed.firstName).toBeNull();
        expect(parsed.lastName).toBe('JANSSENS');
    });

    it('returns null for a date that does not exist', () => {
        const parsed = parseJudicialRecordExtract(blankExtractLines({ birthDate: 'Geboortedatum: 31/02/2006' }));

        expect(parsed.birthDay).toBeNull();
    });

    it('fails with UNRECOGNISED_LAYOUT when no mandatory field resolves', () => {
        expect(() => parseJudicialRecordExtract(['EXTRAIT DU CASIER JUDICIAIRE', 'Nom: JANSSENS', 'Prénom: Jan']))
            .toThrow(JudicialRecordLayoutError);
    });
});
