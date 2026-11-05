import { readJudicialRecordExtract } from './JudicialRecordExtract.js';

/**
 * The layout of a real extract: the date sits in the header next to the reference and the subject
 * rather than on a line of its own, the purpose is printed below its label, and the blank marker
 * carries its own date.
 */
const EXTRACT_LINES = [
    'Ref. doc : 20261102-5351 - Datum : 02/11/2026 Betreft : JANSSENS JAN - 05/04/2006 1 / 1',
    'UITTREKSEL UIT HET STRAFREGISTER',
    'Naam : JANSSENS',
    'Voornaam : JAN PIETER',
    'Geboortedatum : 05/04/2006',
    'Finaliteit van het uittreksel :',
    '596.2 - model bestemd voor de contacten met minderjarigen',
    'BLANCO STRAFREGISTER (02/11/2026)',
];

describe('readJudicialRecordExtract', () => {
    test('reads every field of an extract', () => {
        expect(readJudicialRecordExtract(EXTRACT_LINES)).toEqual({
            firstName: 'JAN PIETER',
            lastName: 'JANSSENS',
            birthDay: new Date('2006-04-05T00:00:00.000Z'),
            documentDate: new Date('2026-11-02T00:00:00.000Z'),
            purpose: '596.2 - model bestemd voor de contacten met minderjarigen',
            blankSince: new Date('2026-11-02T00:00:00.000Z'),
        });
    });

    test('reads the date of the document rather than the other dates around it', () => {
        // The header holds a birth date too, and the blank marker a third date
        expect(readJudicialRecordExtract(EXTRACT_LINES).documentDate).toEqual(new Date('2026-11-02T00:00:00.000Z'));
    });

    test('does not read the birth date as the date of the document', () => {
        const lines = EXTRACT_LINES.filter(line => !line.startsWith('Ref. doc'));

        expect(readJudicialRecordExtract(lines).documentDate).toBeNull();
    });

    test('leaves out a marker that is only mentioned', () => {
        const lines = EXTRACT_LINES.map(line => line.startsWith('BLANCO') ? 'Dit is geen BLANCO STRAFREGISTER (02/11/2026)' : line);

        expect(readJudicialRecordExtract(lines).blankSince).toBeNull();
    });

    test('leaves a field that does not resolve null', () => {
        const extract = readJudicialRecordExtract(['UITTREKSEL UIT HET STRAFREGISTER']);

        expect(extract).toEqual({
            firstName: null,
            lastName: null,
            birthDay: null,
            documentDate: null,
            purpose: null,
            blankSince: null,
        });
    });
});
