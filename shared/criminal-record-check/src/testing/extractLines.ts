/**
 * The lines of a blank model 596.2 extract, in the order they are printed. Overrides replace or
 * remove (null) a line, so a test only states what it changes.
 */
export function blankExtractLines(overrides: Partial<Record<keyof typeof defaultLines, string | null>> = {}): string[] {
    return Object.keys(defaultLines)
        .map(key => (key in overrides ? overrides[key as keyof typeof defaultLines] : defaultLines[key as keyof typeof defaultLines]))
        .filter((line): line is string => line !== null && line !== undefined);
}

const defaultLines = {
    title: 'UITTREKSEL UIT HET STRAFREGISTER',
    lastName: 'Naam: JANSSENS',
    firstName: 'Voorna(a)m(en): Jan',
    birthDate: 'Geboortedatum: 05/04/2006',
    birthPlace: 'Geboorteplaats: Gent',
    nationality: 'Nationaliteit: Belg',
    address: 'Woonplaats: Kerkstraat 1, 9000 Gent',
    documentDate: 'Datum: 15/10/2026',
    purposeLabel: 'Finaliteit van het uittreksel',
    purposeValue: 'Artikel 596, tweede lid - model 596.2 - activiteiten met minderjarigen',
    blankMarker: 'BLANCO STRAFREGISTER',
} as const;
