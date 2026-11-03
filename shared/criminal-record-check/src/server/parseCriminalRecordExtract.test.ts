import { blankExtractLines } from '../testing/extractLines.js';
import { CriminalRecordParseErrorCode } from './CriminalRecordParseError.js';
import { parseCriminalRecordExtract } from './parseCriminalRecordExtract.js';

describe('parseCriminalRecordExtract', () => {
    it('reads every field of a blank extract', () => {
        const parsed = parseCriminalRecordExtract(blankExtractLines());

        expect(parsed.lastName).toBe('JANSSENS');
        expect(parsed.firstName).toBe('Jan');
        expect(parsed.birthDay).toEqual(new Date(Date.UTC(2006, 3, 5)));
        expect(parsed.issuedAt).toEqual(new Date(Date.UTC(2026, 9, 15)));
        expect(parsed.purpose).toBe('Artikel 596, tweede lid - model 596.2 - activiteiten met minderjarigen');
        expect(parsed.isBlank).toBe(true);
    });

    it('reads the purpose from the line below its label', () => {
        const parsed = parseCriminalRecordExtract(blankExtractLines({ purposeValue: 'model 596.1 - andere finaliteit' }));

        expect(parsed.purpose).toBe('model 596.1 - andere finaliteit');
    });

    it('accepts an alternative spelling of a label', () => {
        const parsed = parseCriminalRecordExtract(blankExtractLines({ lastName: 'Familienaam: JANSSENS' }));

        expect(parsed.lastName).toBe('JANSSENS');
    });

    it('is not blank when the marker is missing', () => {
        const parsed = parseCriminalRecordExtract(blankExtractLines({ blankMarker: 'Antecedenten: veroordeeld op 01/02/2020' }));

        expect(parsed.isBlank).toBe(false);
        // the other fields still resolve, so the individual checks decide what happens
        expect(parsed.lastName).toBe('JANSSENS');
    });

    it('does not read the birth date as the document date', () => {
        const parsed = parseCriminalRecordExtract(blankExtractLines({ documentDate: null }));

        expect(parsed.issuedAt).toBeNull();
        expect(parsed.birthDay).toEqual(new Date(Date.UTC(2006, 3, 5)));
    });

    it('returns null for a field that is missing', () => {
        const parsed = parseCriminalRecordExtract(blankExtractLines({ firstName: null }));

        expect(parsed.firstName).toBeNull();
        expect(parsed.lastName).toBe('JANSSENS');
    });

    it('returns null for a date that does not exist', () => {
        const parsed = parseCriminalRecordExtract(blankExtractLines({ birthDate: 'Geboortedatum: 31/02/2006' }));

        expect(parsed.birthDay).toBeNull();
    });

    it('fails with UNRECOGNISED_LAYOUT when no mandatory field resolves', () => {
        expect(() => parseCriminalRecordExtract(['EXTRAIT DU CASIER JUDICIAIRE', 'Nom: JANSSENS', 'Prénom: Jan']))
            .toThrow(expect.objectContaining({ code: CriminalRecordParseErrorCode.UnrecognisedLayout }));
    });
});
