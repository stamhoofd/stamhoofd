/**
 * The lines of a blank model 596.2 extract of FOD Justitie, in the order they are printed.
 * Overrides replace or remove (null) a line, so a test only states what it changes.
 */
export function blankExtractLines(overrides: Partial<Record<keyof typeof defaultLines, string | null>> = {}): string[] {
    return Object.keys(defaultLines)
        .map(key => (key in overrides ? overrides[key as keyof typeof defaultLines] : defaultLines[key as keyof typeof defaultLines]))
        .filter((line): line is string => line !== null && line !== undefined);
}

const defaultLines = {
    /** The real extract prints its date in this header, next to the reference and the subject. */
    documentDate: 'Ref. doc : 20261015-1234 - Datum : 15/10/2026 Betreft : JANSSENS JAN - 05/04/2006 1 / 1',
    title: 'Uittreksel uit het strafregister',
    lastName: 'Naam : JANSSENS',
    firstName: 'Voorna(a)m(en) : Jan',
    birthDate: 'Geboortedatum : 05/04/2006',
    birthPlace: 'Geboorteplaats : GENT (België)',
    nationality: 'Nationaliteit : BELGIE',
    address: 'Woonplaats : Kerkstraat 1, 9000 Gent, BELGIE',
    purposeLabel: 'Finaliteit van het uittreksel :',
    purposeValue: '596.2 - model bestemd voor de contacten met minderjarigen',
    blankMarker: 'BLANCO STRAFREGISTER (15/10/2026)',
} as const;
