import { describe, expect, test } from 'vitest';

import { containsText, readInlineLabelledValue, readLabelledValue, readValueOnNextLine } from '../src/readPdfText.js';

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
        expect(readInlineLabelledValue([header], ['Datum'])).toBe('02/11/2026 Betreft : JANSSENS JAN - 05/04/2006 1 / 1');
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
        expect(readValueOnNextLine(['Finaliteit van het uittreksel', 'Model 596.2'], ['Finaliteit van het uittreksel'])).toBe('Model 596.2');
    });

    test('reads a wording that does print the value behind the label', () => {
        expect(readValueOnNextLine(['Finaliteit: Model 596.2'], ['Finaliteit'])).toBe('Model 596.2');
    });

    test('is null when the label is the last line', () => {
        expect(readValueOnNextLine(['Finaliteit'], ['Finaliteit'])).toBeNull();
    });
});

describe('containsText', () => {
    test('finds a marker printed inside a longer line', () => {
        expect(containsText(['Dit is een BLANCO STRAFREGISTER.'], ['BLANCO STRAFREGISTER'])).toBe(true);
    });

    test('ignores case, accents and how the words are spaced', () => {
        expect(containsText(['blanco   strafrégister'], ['BLANCO STRAFREGISTER'])).toBe(true);
    });

    test('is false when no line carries a marker', () => {
        expect(containsText(['Geen vermelding'], ['BLANCO STRAFREGISTER'])).toBe(false);
    });
});
