import { mapBelcotaxFeedbackIssues, parseValidationStatus } from './BelcotaxFeedback.js';

const documentId = '04807bd8-492a-4782-82cc-9804ee6502cd';
const otherId = '08c97002-85cf-4e24-9486-a54023917bc8';

describe('BelcotaxFeedback', () => {
    test('reads the status of the OpenAPI and of the PDF', () => {
        expect(parseValidationStatus({ status: 'inProgress' })).toBe('inProgress');
        expect(parseValidationStatus({ status: 'IN PROGRESS' })).toBe('inProgress');
        expect(parseValidationStatus({ status: 'ACCEPTED' })).toBe('accepted');
        expect(parseValidationStatus({ status: 'rejected' })).toBe('rejected');
        expect(parseValidationStatus({ status: 'something else' })).toBeNull();
        expect(parseValidationStatus(null)).toBeNull();
    });

    test('maps issues to documents by key, by line and to the whole file otherwise', () => {
        const lineKeys = [
            'STA-contact-t',
            'STA-org-o',
            `STA-2026-${documentId}-b`,
            `STA-2026-${documentId}-c`,
            `STA-2026-${documentId}`,
            `STA-2026-${otherId}`,
        ];
        const descriptions = new Map([
            [documentId, 'Noah Claes, Kamp 2026'],
            [otherId, 'Lena Claes, Kamp 2026'],
        ]);

        const issues = mapBelcotaxFeedbackIssues(
            {
                type: 'urn:problem-type:belcotax:feedback',
                issues: [
                    // Business error of https://financien.belgium.be/sites/default/files/downloads/ExamplesBelcotax2026.zip, with the leading space of the PDF
                    {
                        type: 'urn:problem-type:belcotax:issue:uNDEFINED:existCbeInSitran',
                        title: 'existCbeInSitran',
                        detail: 'Het KBO-nummer moet bestaan.',
                        key: ` STA-2026-${otherId}`,
                        line: 6,
                    },
                    // Format error: a line, no key
                    {
                        type: 'urn:problem-type:belcotax:issue:invalidFormat:invalidFormat',
                        title: 'InvalidFormat',
                        detail: 'Ongeldig formaat : 100.0',
                        in: 'body',
                        name: '/$/2076',
                        line: 4,
                    },
                    // A resource
                    {
                        type: 'urn:problem-type:belcotax:issue:uNDEFINED:validCbe',
                        title: 'validCbe',
                        detail: 'Het KBO-nummer moet geldig zijn.',
                        key: 'STA-org-o',
                        line: 2,
                    },
                    // Not one of ours
                    {
                        type: 'urn:problem-type:belcotax:issue:uNDEFINED:x',
                        key: '2026-' + 'a'.repeat(8),
                    },
                ],
            },
            { lineKeys, descriptions },
        );

        expect(issues.map((i) => i.encode({ version: 0 }))).toEqual([
            {
                documentId: otherId,
                documentDescription: 'Lena Claes, Kamp 2026',
                key: `STA-2026-${otherId}`,
                line: 6,
                code: 'existCbeInSitran',
                message: 'Het KBO-nummer moet bestaan.',
            },
            {
                documentId,
                documentDescription: 'Noah Claes, Kamp 2026',
                key: `STA-2026-${documentId}-c`,
                line: 4,
                code: 'InvalidFormat',
                message: 'Ongeldig formaat : 100.0',
            },
            {
                documentId: null,
                documentDescription: null,
                key: 'STA-org-o',
                line: 2,
                code: 'validCbe',
                message: 'Het KBO-nummer moet geldig zijn.',
            },
            {
                documentId: null,
                documentDescription: null,
                key: '2026-aaaaaaaa',
                line: null,
                code: 'x',
                message: 'urn:problem-type:belcotax:issue:uNDEFINED:x',
            },
        ]);
    });
});
