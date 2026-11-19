import { Country } from '@stamhoofd/types/Country';
import type { BelcotaxExportInput, FiscalDocumentContext } from './BelcotaxJsonlService.js';
import { BelcotaxJsonlService } from './BelcotaxJsonlService.js';

const address = {
    street: 'Kerkstraat',
    number: '1',
    postalCode: '9000',
    city: 'Gent',
    country: Country.Belgium,
};

function createContext(overrides: Partial<FiscalDocumentContext> = {}): FiscalDocumentContext {
    return {
        debtor: {
            firstName: 'An',
            lastName: 'Claes',
            nationalRegisterNumber: '85.07.30-033.28',
            address,
        },
        member: {
            firstName: 'Noah',
            lastName: 'Claes',
            nationalRegisterNumber: '18.05.05-123.72',
            birthDay: new Date(2018, 4, 5),
            address,
        },
        registration: {
            startDate: new Date(2026, 6, 1),
            endDate: new Date(2026, 6, 5),
            price: 75_0000,
            days: null,
        },
        certification: {
            type: 'authorities',
            name: 'Stad Gent',
            companyNumber: '0207.451.227',
            address,
        },
        ...overrides,
    };
}

function createInput(overrides: Partial<BelcotaxExportInput> = {}): BelcotaxExportInput {
    return {
        year: 2026,
        templateId: 'template-1',
        organiser: {
            id: 'company-1',
            name: 'Jeugdhuis De Kelder vzw',
            companyNumber: '0123.456.789',
            address,
        },
        contact: { name: 'Els Wouters', phone: '0470 12 34 56', email: 'els@dekelder.be' },
        documents: [{ id: 'document-1', context: createContext() }],
        deletedDocumentIds: [],
        ...overrides,
    };
}

function parseLines(jsonl: string) {
    return jsonl
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Record<string, any>);
}

describe('BelcotaxJsonlService', () => {
    test('A complete document becomes a fiche with its own debtor and child', () => {
        const result = BelcotaxJsonlService.build(createInput());

        expect(result.issues).toEqual([]);
        expect(result.includedDocumentIds).toEqual(['document-1']);

        const lines = parseLines(result.jsonl);
        const fiche = lines.find((line) => line['k'] === 'STA-2026-document-1')!;
        expect(fiche).toEqual({
            $s: 'urn:f:d:2026:86:2:nl',
            k: 'STA-2026-document-1',
            d: 'STA-org-company-1',
            b: 'STA-2026-document-1-b',
            childRef: 'STA-2026-document-1-c',
            c: 'STA-contact-template-1',
            '4101': [{ 2055: '2026-07-01', 2056: '2026-07-05', 2110: 5, 2060: 75 }],
            '2031': '2',
            certRef: 'STA-cert-template-1',
        });

        const organiser = lines.find((line) => line['k'] === 'STA-org-company-1')!;
        expect(organiser['i']).toEqual({ cbein: '0123456789' });
        expect(organiser['a']).toEqual({ l: '150', s: 'Kerkstraat', n: '1', p: '9000', c: 'Gent' });

        const contact = lines.find((line) => line['k'] === 'STA-contact-template-1')!;
        expect(contact).toMatchObject({
            fn: ['Els'],
            ln: ['Wouters'],
            e: 'els@dekelder.be',
            p: { m: '+32470123456' },
        });

        const child = lines.find((line) => line['k'] === 'STA-2026-document-1-c')!;
        expect(child).toMatchObject({ i: { ssin: '18050512372' }, bd: '2018-05-05' });
    });

    test('Prices are converted from 4 decimal places to euros', () => {
        const result = BelcotaxJsonlService.build(
            createInput({
                documents: [
                    {
                        id: 'document-1',
                        context: createContext({
                            registration: {
                                startDate: new Date(2026, 6, 1),
                                endDate: new Date(2026, 6, 3),
                                price: 100_0000,
                            },
                        }),
                    },
                ],
            }),
        );

        expect(result.issues).toEqual([]);
        const fiche = parseLines(result.jsonl).find((line) => line['k'] === 'STA-2026-document-1')!;
        expect(fiche['4101']).toEqual([
            { 2055: '2026-07-01', 2056: '2026-07-03', 2110: 3, 2060: 100 },
        ]);
    });

    test('Shared resources are written once for multiple documents', () => {
        const result = BelcotaxJsonlService.build(
            createInput({
                documents: [
                    { id: 'document-1', context: createContext() },
                    { id: 'document-2', context: createContext() },
                ],
            }),
        );

        const keys = parseLines(result.jsonl).map((line) => line['k']);
        expect(keys.filter((key) => key === 'STA-cert-template-1')).toHaveLength(1);
        expect(keys.filter((key) => key === 'STA-org-company-1')).toHaveLength(1);
        expect(result.includedDocumentIds).toEqual(['document-1', 'document-2']);
    });

    test('Names with quotes and backslashes stay valid JSON', () => {
        const result = BelcotaxJsonlService.build(
            createInput({
                documents: [
                    {
                        id: 'document-1',
                        context: createContext({
                            member: {
                                firstName: 'Noah "Nono"',
                                lastName: "D'Hondt \\ Claes",
                                nationalRegisterNumber: '18050512372',
                                address,
                            },
                        }),
                    },
                ],
            }),
        );

        const child = parseLines(result.jsonl).find(
            (line) => line['k'] === 'STA-2026-document-1-c',
        )!;
        expect(child['fn']).toEqual(['Noah "Nono"']);
        expect(child['ln']).toEqual(["D'Hondt \\ Claes"]);
    });

    test('A feitelijke vereniging without a company number blocks the whole export', () => {
        const result = BelcotaxJsonlService.build(
            createInput({
                organiser: {
                    id: 'company-1',
                    name: 'Chiro Sint-Jan',
                    companyNumber: null,
                    address,
                },
            }),
        );

        expect(result.issues).toContainEqual({
            documentId: null,
            message: expect.stringContaining('geen ondernemingsnummer'),
        });
    });

    test('A certification exception has no certifying authority', () => {
        const result = BelcotaxJsonlService.build(
            createInput({
                documents: [
                    {
                        id: 'document-1',
                        context: createContext({ certification: { type: 'exception' } }),
                    },
                ],
            }),
        );

        expect(result.issues).toEqual([]);
        const lines = parseLines(result.jsonl);
        const fiche = lines.find((line) => line['k'] === 'STA-2026-document-1')!;
        expect(fiche['2031']).toBe('0');
        expect(fiche['certRef']).toBeUndefined();
        expect(lines.some((line) => line['k'] === 'STA-cert-template-1')).toBe(false);
    });

    test('Addresses use the NIS country code, an unknown country leaves the address out', () => {
        const result = BelcotaxJsonlService.build(
            createInput({
                documents: [
                    {
                        id: 'document-1',
                        context: createContext({
                            debtor: {
                                firstName: 'An',
                                lastName: 'Claes',
                                nationalRegisterNumber: '85073003328',
                                address: { ...address, country: Country.Portugal },
                            },
                            member: {
                                firstName: 'Noah',
                                lastName: 'Claes',
                                nationalRegisterNumber: '18050512372',
                                address: { ...address, country: Country.Other },
                            },
                        }),
                    },
                ],
            }),
        );

        const lines = parseLines(result.jsonl);
        expect(lines.find((line) => line['k'] === 'STA-2026-document-1-b')!['a']).toMatchObject({
            l: '123',
        });
        expect(lines.find((line) => line['k'] === 'STA-2026-document-1-c')!['a']).toBeUndefined();
    });

    test('A rijksregisternummer with a wrong check digit is reported instead of sent', () => {
        const result = BelcotaxJsonlService.build(
            createInput({
                documents: [
                    {
                        id: 'document-1',
                        context: createContext({
                            member: {
                                firstName: 'Noah',
                                lastName: 'Claes',
                                // 18050512372 is the valid number, Belcotax would refuse the whole file for this one
                                nationalRegisterNumber: '18.05.05-123.45',
                                birthDay: new Date(2018, 4, 5),
                                address,
                            },
                        }),
                    },
                ],
            }),
        );

        expect(result.issues).toEqual([
            {
                documentId: 'document-1',
                message: 'Het rijksregisternummer van het kind is ongeldig.',
            },
        ]);
        expect(result.includedDocumentIds).toEqual([]);
        expect(result.jsonl).not.toContain('18050512345');
    });

    test('A rijksregisternummer of someone born before 2000 is accepted', () => {
        const result = BelcotaxJsonlService.build(createInput());

        expect(result.issues).toEqual([]);
        expect(
            parseLines(result.jsonl).find((line) => line['k'] === 'STA-2026-document-1-b'),
        ).toMatchObject({ i: { ssin: '85073003328' } });
    });

    test('Every key has the STA prefix, so other software of the sender cannot overwrite it', () => {
        const result = BelcotaxJsonlService.build(
            createInput({ deletedDocumentIds: ['document-9'] }),
        );

        const keys = parseLines(result.jsonl).map((line) => line['k'] as string);
        expect(keys.length).toBeGreaterThan(0);
        expect(keys.every((key) => key.startsWith('STA-'))).toBe(true);
    });

    test('Deleted documents become delete lines with the same key', () => {
        const result = BelcotaxJsonlService.build(
            createInput({ deletedDocumentIds: ['document-9'] }),
        );

        expect(parseLines(result.jsonl)).toContainEqual({
            $s: 'urn:f:x:1',
            k: 'STA-2026-document-9',
        });
    });

    describe('Documents that Belcotax would reject are left out', () => {
        const cases: [string, Partial<FiscalDocumentContext>][] = [
            [
                'debtor without national register number or address',
                { debtor: { firstName: 'An', lastName: 'Claes' } },
            ],
            [
                'child without national register number and birth day',
                { member: { firstName: 'Noah', lastName: 'Claes', address } },
            ],
            [
                'same national register number for debtor and child',
                {
                    member: {
                        firstName: 'Noah',
                        lastName: 'Claes',
                        nationalRegisterNumber: '85073003328',
                        birthDay: new Date(2018, 4, 5),
                        address,
                    },
                },
            ],
            [
                'more days than the period',
                {
                    registration: {
                        startDate: new Date(2026, 6, 1),
                        endDate: new Date(2026, 6, 5),
                        price: 75_0000,
                        days: 6,
                    },
                },
            ],
            [
                'end date before start date',
                {
                    registration: {
                        startDate: new Date(2026, 6, 5),
                        endDate: new Date(2026, 6, 1),
                        price: 75_0000,
                    },
                },
            ],
            [
                'no paid amount',
                {
                    registration: {
                        startDate: new Date(2026, 6, 1),
                        endDate: new Date(2026, 6, 5),
                        price: 0,
                    },
                },
            ],
            ['no certification type', { certification: { type: null } }],
        ];

        test.each(cases)('%s', (_, overrides) => {
            const result = BelcotaxJsonlService.build(
                createInput({
                    documents: [
                        { id: 'document-1', context: createContext(overrides) },
                        { id: 'document-2', context: createContext() },
                    ],
                }),
            );

            expect(result.includedDocumentIds).toEqual(['document-2']);
            expect(result.issues.length).toBeGreaterThan(0);
            expect(result.issues.every((issue) => issue.documentId === 'document-1')).toBe(true);
            expect(
                parseLines(result.jsonl).some((line) => line['k'] === 'STA-2026-document-1'),
            ).toBe(false);
        });
    });

    test('An organiser without a complete address blocks the whole export', () => {
        const result = BelcotaxJsonlService.build(
            createInput({
                organiser: {
                    id: 'company-1',
                    name: 'Jeugdhuis De Kelder vzw',
                    companyNumber: '0123456789',
                    address: null,
                },
            }),
        );

        expect(result.issues).toContainEqual({ documentId: null, message: expect.any(String) });
    });

    test('Unsupported income years are refused', () => {
        expect(BelcotaxJsonlService.isSupportedYear(2025)).toBe(false);
        expect(() => BelcotaxJsonlService.build(createInput({ year: 2025 }))).toThrow();
    });
});
