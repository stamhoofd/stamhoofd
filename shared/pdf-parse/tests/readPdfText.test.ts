import { describe, expect, test } from 'vitest';

import { extractPdfLines } from '../src/extractPdfLines.js';
import { parsePrintedDate, readInlineLabelledValue, readLabelledValue, readMarkerDate, readValueOnNextLine } from '../src/readPdfText.js';
import { createTestPdf } from './helpers/createTestPdf.js';

describe('readLabelledValue', () => {
    test('reads the value printed behind a label', () => {
        expect(readLabelledValue(['Naam: De Letter', 'Geboortedatum: 01/02/1990'], ['Naam'])).toBe('De Letter');
    });

    test('tries every accepted spelling', () => {
        expect(readLabelledValue(['Voornamen: Jan Peter'], ['Voorna(a)m(en)', 'Voornaam', 'Voornamen'])).toBe('Jan Peter');
    });

    test('ignores the case of the label', () => {
        expect(readLabelledValue(['NAAM : De Letter'], ['Naam'])).toBe('De Letter');
    });

    test('is null when the label is only part of another one', () => {
        expect(readLabelledValue(['Plaats van geboorte: Gent'], ['Geboorte'])).toBeNull();
    });

    test('is null when the label is printed without a value', () => {
        expect(readLabelledValue(['Naam:'], ['Naam'])).toBeNull();
    });

    test('is null when no line carries the label', () => {
        expect(readLabelledValue(['Geboortedatum: 01/02/1990'], ['Naam'])).toBeNull();
    });
});

describe('readInlineLabelledValue', () => {
    // The header of a real extract prints a reference, a date and a subject on one line
    const header = 'Ref. doc : 20261102-5351 - Datum : 02/11/2026 Betreft : JANSSENS JAN - 05/04/2006 1 / 1';

    test('reads a label that sits inside a longer line', () => {
        expect(readInlineLabelledValue([header], ['Datum'])).toBe('02/11/2026');
    });

    test('ends the value where the next field of the line begins', () => {
        expect(readInlineLabelledValue([header], ['Ref. doc'])).toBe('20261102-5351');
    });

    test('reads the last field of a line up to its end', () => {
        expect(readInlineLabelledValue([header], ['Betreft'])).toBe('JANSSENS JAN - 05/04/2006 1 / 1');
    });

    test('does not cut a value off at the colon of a url', () => {
        expect(readInlineLabelledValue(['Inlichtingen : https://justice.belgium.be'], ['Inlichtingen'])).toBe('https://justice.belgium.be');
    });

    test('reads a label that does start its line', () => {
        expect(readInlineLabelledValue(['Datum: 15/10/2026'], ['Datum'])).toBe('15/10/2026');
    });

    test('is null when the label is only the tail of a longer word', () => {
        expect(readInlineLabelledValue(['Geboortedatum : 05/04/2006'], ['Datum'])).toBeNull();
    });

    test('is null when no line carries the label', () => {
        expect(readInlineLabelledValue(['Naam : JANSSENS'], ['Datum'])).toBeNull();
    });
});

describe('readValueOnNextLine', () => {
    test('reads the value printed on the line below the label', () => {
        expect(readValueOnNextLine(['Finaliteit van het uittreksel :', 'Model 596.2'], ['Finaliteit van het uittreksel'])).toBe('Model 596.2');
    });

    test('reads a wording that does print the value behind the label', () => {
        expect(readValueOnNextLine(['Finaliteit: Model 596.2'], ['Finaliteit'])).toBe('Model 596.2');
    });

    test('is null when the label is the last line', () => {
        expect(readValueOnNextLine(['Finaliteit :'], ['Finaliteit'])).toBeNull();
    });

    test('is null when the label is printed without its colon', () => {
        expect(readValueOnNextLine(['Finaliteit', 'Model 596.2'], ['Finaliteit'])).toBeNull();
    });

    test('is null when the label is only the start of a longer word', () => {
        expect(readValueOnNextLine(['Finaliteitscode : 12'], ['Finaliteit'])).toBeNull();
    });

    test('reads the line below the label rather than a line that merely starts with it', () => {
        expect(readValueOnNextLine(['Finaliteitscode : 12', 'Finaliteit :', 'Model 596.2'], ['Finaliteit'])).toBe('Model 596.2');
    });
});

describe('readMarkerDate', () => {
    // A real extract prints its verdict as a heading of its own, with the date beside it
    const blanco = 'BLANCO STRAFREGISTER (05/10/2026)';

    test('reads the date printed next to a marker', () => {
        expect(readMarkerDate([blanco], ['BLANCO STRAFREGISTER'])).toEqual(new Date(Date.UTC(2026, 9, 5)));
    });

    test('reads the date without parentheses around it', () => {
        expect(readMarkerDate(['BLANCO STRAFREGISTER 05/10/2026'], ['BLANCO STRAFREGISTER'])).toEqual(new Date(Date.UTC(2026, 9, 5)));
    });

    test('reads a marker printed with a colon in front of the date', () => {
        expect(readMarkerDate(['BLANCO STRAFREGISTER : 5-10-2026'], ['BLANCO STRAFREGISTER'])).toEqual(new Date(Date.UTC(2026, 9, 5)));
    });

    test('ignores case and how the words are spaced', () => {
        expect(readMarkerDate(['blanco   strafregister (05.10.2026)'], ['BLANCO STRAFREGISTER'])).toEqual(new Date(Date.UTC(2026, 9, 5)));
    });

    test('tries every accepted spelling', () => {
        expect(readMarkerDate(['CASIER VIERGE (05/10/2026)'], ['BLANCO STRAFREGISTER', 'CASIER VIERGE'])).toEqual(new Date(Date.UTC(2026, 9, 5)));
    });

    test('is null when the marker is printed inside a sentence about it', () => {
        expect(readMarkerDate(['Dit is een BLANCO STRAFREGISTER (05/10/2026)'], ['BLANCO STRAFREGISTER'])).toBeNull();
    });

    test('is null when something other than the date follows the marker', () => {
        expect(readMarkerDate(['BLANCO STRAFREGISTER (05/10/2026) - zie keerzijde'], ['BLANCO STRAFREGISTER'])).toBeNull();
    });

    test('is null when the marker stands without a date', () => {
        expect(readMarkerDate(['BLANCO STRAFREGISTER'], ['BLANCO STRAFREGISTER'])).toBeNull();
    });

    test('is null when the date is printed on the line below the marker', () => {
        expect(readMarkerDate(['BLANCO STRAFREGISTER', '(05/10/2026)'], ['BLANCO STRAFREGISTER'])).toBeNull();
    });

    test('is null when the date next to the marker is not a date', () => {
        expect(readMarkerDate(['BLANCO STRAFREGISTER (31/02/2026)'], ['BLANCO STRAFREGISTER'])).toBeNull();
    });

    test('is null when no line carries the marker', () => {
        expect(readMarkerDate(['GERECHTELIJKE ANTECEDENTEN :'], ['BLANCO STRAFREGISTER'])).toBeNull();
    });
});

describe('parsePrintedDate', () => {
    test('reads a printed date day first', () => {
        expect(parsePrintedDate('05/10/2026')).toEqual(new Date(Date.UTC(2026, 9, 5)));
    });

    test('reads a day and a month written without a leading zero', () => {
        expect(parsePrintedDate('5/1/2026')).toEqual(new Date(Date.UTC(2026, 0, 5)));
    });

    test('reads a date separated by dashes or dots', () => {
        expect(parsePrintedDate('05-10-2026')).toEqual(new Date(Date.UTC(2026, 9, 5)));
        expect(parsePrintedDate('05.10.2026')).toEqual(new Date(Date.UTC(2026, 9, 5)));
    });

    test('is null for a day the month does not have', () => {
        expect(parsePrintedDate('31/02/2026')).toBeNull();
    });

    test('is null for a month that does not exist', () => {
        expect(parsePrintedDate('05/13/2026')).toBeNull();
    });

    test('is null for a value that is not a date', () => {
        expect(parsePrintedDate('JANSSENS')).toBeNull();
    });

    test('takes the null a reader hands back, so reading a date is one call', () => {
        expect(parsePrintedDate(readInlineLabelledValue(['Naam : JANSSENS'], ['Datum']))).toBeNull();
    });

    test('is null for a date with more around it', () => {
        expect(parsePrintedDate('op 05/10/2026 opgemaakt')).toBeNull();
    });
});

describe('accented labels, values and markers', () => {
    // A French or German extract prints e, a, c and u with their accents, in a label and in a value
    test('reads a value behind an accented label', () => {
        expect(readLabelledValue(['Prénom : JEAN'], ['Prénom'])).toBe('JEAN');
        expect(readLabelledValue(['Lieu de naissance : LIÈGE'], ['Lieu de naissance'])).toBe('LIÈGE');
        expect(readLabelledValue(['Behörde : BRÜSSEL'], ['Behörde'])).toBe('BRÜSSEL');
    });

    test('hands back a value with its accents unchanged', () => {
        expect(readLabelledValue(['Naam : HÉLÈNE DE CRAËNE'], ['Naam'])).toBe('HÉLÈNE DE CRAËNE');
        expect(readInlineLabelledValue(['Betreft : FRANÇOIS MÜLLER - 05/04/2006'], ['Betreft'])).toBe('FRANÇOIS MÜLLER - 05/04/2006');
    });

    test('ignores the case of an accented label, in both directions', () => {
        expect(readLabelledValue(['PRÉNOM : JEAN'], ['prénom'])).toBe('JEAN');
        expect(readLabelledValue(['prénom : JEAN'], ['PRÉNOM'])).toBe('JEAN');
        expect(readLabelledValue(['BEHÖRDE : BRÜSSEL'], ['behörde'])).toBe('BRÜSSEL');
    });

    test('ends an accented inline value where the next accented label begins', () => {
        const header = 'Réf. doc : 20261102-5351 - Daté : 02/11/2026 Betreft : FRANÇOIS';

        expect(readInlineLabelledValue([header], ['Réf. doc'])).toBe('20261102-5351');
        expect(readInlineLabelledValue([header], ['Daté'])).toBe('02/11/2026');
    });

    test('reads the line below an accented label', () => {
        expect(readValueOnNextLine(['Finalité de l\'extrait :', 'Modèle 596.2'], ['Finalité de l\'extrait'])).toBe('Modèle 596.2');
    });

    test('reads a marker date behind an accented marker', () => {
        expect(readMarkerDate(['NÉANT (05/10/2026)'], ['NÉANT'])).toEqual(new Date(Date.UTC(2026, 9, 5)));
        expect(readMarkerDate(['OHNE EINTRÄGE (05/10/2026)'], ['ohne einträge'])).toEqual(new Date(Date.UTC(2026, 9, 5)));
        expect(readMarkerDate(['casier judiciaire vierge (05/10/2026)'], ['CASIER JUDICIAIRE VIERGE'])).toEqual(new Date(Date.UTC(2026, 9, 5)));
    });

    // A spelling that differs in its accents is another spelling, so it belongs in the list
    test('matches neither a label nor a marker whose accents differ from the printed ones', () => {
        expect(readLabelledValue(['Prenom : JEAN'], ['Prénom'])).toBeNull();
        expect(readLabelledValue(['Prénom : JEAN'], ['Prenom'])).toBeNull();
        expect(readMarkerDate(['NEANT (05/10/2026)'], ['NÉANT'])).toBeNull();
        expect(readMarkerDate(['NÉANT (05/10/2026)'], ['NEANT'])).toBeNull();
    });

    test('takes both spellings from the list', () => {
        expect(readLabelledValue(['Prenom : JEAN'], ['Prénom', 'Prenom'])).toBe('JEAN');
        expect(readMarkerDate(['NEANT (05/10/2026)'], ['NÉANT', 'NEANT'])).toEqual(new Date(Date.UTC(2026, 9, 5)));
    });
});

describe('reading a marker date out of a pdf', () => {
    // How a real extract prints it: the marker and the date are two items on one baseline
    const blancoAt = (markerY: number, dateY: number) => createTestPdf([
        { text: 'Enige vervalsing van dit document vormt een wanbedrijf.', y: markerY + 40 },
        { text: 'BLANCO STRAFREGISTER', x: 125, y: markerY },
        { text: '(05/10/2026)', x: 390, y: dateY },
    ]);

    test('reads the date beside a marker the pdf draws as a separate item', async () => {
        const lines = await extractPdfLines(blancoAt(400, 400));

        expect(readMarkerDate(lines, ['BLANCO STRAFREGISTER'])).toEqual(new Date(Date.UTC(2026, 9, 5)));
    });

    test('is null when the pdf prints the date below the marker instead of beside it', async () => {
        const lines = await extractPdfLines(blancoAt(400, 380));

        expect(readMarkerDate(lines, ['BLANCO STRAFREGISTER'])).toBeNull();
    });

    test('reads accented fields out of a pdf with their accents intact', async () => {
        const lines = await extractPdfLines(createTestPdf([
            { text: 'Prénom : HÉLÈNE', y: 800 },
            { text: 'Naam : FRANÇOIS MÜLLER', y: 780 },
            { text: 'Lieu de naissance : LIÈGE', y: 760 },
            { text: 'NÉANT (05/10/2026)', y: 740 },
        ]));

        expect(readLabelledValue(lines, ['Prénom'])).toBe('HÉLÈNE');
        expect(readLabelledValue(lines, ['Naam'])).toBe('FRANÇOIS MÜLLER');
        expect(readLabelledValue(lines, ['Lieu de naissance'])).toBe('LIÈGE');
        expect(readMarkerDate(lines, ['NÉANT'])).toEqual(new Date(Date.UTC(2026, 9, 5)));
    });
});
