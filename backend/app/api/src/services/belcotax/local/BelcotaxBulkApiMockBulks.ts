import { randomBytes } from 'node:crypto';

import type { BelcotaxMockApiRequest, BelcotaxMockApiRoute } from './BelcotaxMockApi.js';
import { belcotaxProblem } from './BelcotaxMockApi.js';

/**
 * What the mock answers to a submission
 */
export enum BelcotaxMockOutcome {
    Accepted = 'accepted',
    /**
     * Refused right away by `/bulks/submit` (HTTP 400), without a bulk id
     */
    FormatErrors = 'format-errors',
    /**
     * Received, then rejected by the business rules
     */
    BusinessErrors = 'business-errors',
}

/**
 * Without an override, a child with one of these first names chooses the outcome, so it can be chosen from the
 * dashboard in the local environment and in e2e tests
 */
export const belcotaxMockFirstNames = {
    [BelcotaxMockOutcome.FormatErrors]: 'Formaatfout',
    [BelcotaxMockOutcome.BusinessErrors]: 'Geweigerd',
};

type Line = Record<string, unknown> & { k?: string; $s?: string };

type Issue = Record<string, unknown>;

type MockBulk = {
    id: string;
    companyNumber: string;
    requestDateTime: string;
    /**
     * Answers of `/validations/last` with inProgress before the result
     */
    inProgressPolls: number;
    rejected: boolean;
    issues: Issue[];
    count: number;
};

const feedback = (issues: Issue[]) => ({
    type: 'urn:problem-type:belcotax:feedback',
    title: 'Bulk feedback',
    status: 400,
    detail: 'Fouten opgetreden bij het valideren van de verzending',
    issues,
});

/**
 * Submitting, validations and feedback of the bulk API, with the shapes of feedback-example_with_format_errors_nl.json
 * and feedback-example_with_business_errors_nl.json in https://financien.belgium.be/sites/default/files/downloads/ExamplesBelcotax2026.zip
 */
export class BelcotaxMockBulks {
    static bulks = new Map<string, MockBulk>();

    /**
     * Overrides the outcome the content chooses (tests)
     */
    static outcome: BelcotaxMockOutcome | null = null;

    static inProgressPolls = 1;

    /**
     * Content of every file that was submitted, also the refused ones
     */
    static files: string[] = [];

    static reset() {
        this.bulks.clear();
        this.files = [];
        this.outcome = null;
        this.inProgressPolls = 1;
    }

    static routes: BelcotaxMockApiRoute[] = [
        {
            method: 'POST',
            path: /^\/bulks\/submit$/,
            handle: (request) => BelcotaxMockBulks.submit(request),
        },
        {
            method: 'GET',
            path: /^\/bulks\/([^/]+)\/validations\/last$/,
            handle: (request) => BelcotaxMockBulks.validation(request),
        },
        {
            method: 'GET',
            path: /^\/bulks\/([^/]+)\/validations\/last\/feedback$/,
            handle: (request) => BelcotaxMockBulks.feedback(request),
        },
    ];

    private static submit(request: BelcotaxMockApiRequest): [number, unknown] {
        const content = readMultipartField(request.body, request.contentType, 'content');
        if (content === null) {
            return [
                400,
                belcotaxProblem(400, 'badRequest', 'Bad Request', 'The field content is missing'),
            ];
        }

        this.files.push(content);

        const lines: Line[] = [];
        const formatIssues: Issue[] = [];
        content
            .split('\n')
            .filter((l) => l.trim())
            .forEach((text, index) => {
                try {
                    lines.push(JSON.parse(text) as Line);
                } catch {
                    lines.push({});
                    formatIssues.push(
                        formatIssue(index + 1, 'Ongeldig formaat : ' + text.substring(0, 20)),
                    );
                }
            });

        const outcome = this.outcome ?? this.chooseOutcome(lines);
        if (outcome === BelcotaxMockOutcome.FormatErrors) {
            formatIssues.push(...this.formatIssues(lines));
        }
        if (formatIssues.length) {
            return [400, feedback(formatIssues)];
        }

        const bulk: MockBulk = {
            id: randomBytes(6).toString('base64url'),
            companyNumber: request.companyNumber,
            requestDateTime: new Date().toISOString(),
            inProgressPolls: this.inProgressPolls,
            rejected: outcome === BelcotaxMockOutcome.BusinessErrors,
            issues:
                outcome === BelcotaxMockOutcome.BusinessErrors ? this.businessIssues(lines) : [],
            count: lines.length,
        };
        this.bulks.set(bulk.id, bulk);
        return [200, { id: bulk.id, count: bulk.count }];
    }

    private static getBulk(request: BelcotaxMockApiRequest): MockBulk | [number, unknown] {
        const bulk = this.bulks.get(decodeURIComponent(request.match[1]));
        if (!bulk || bulk.companyNumber !== request.companyNumber) {
            return [
                404,
                belcotaxProblem(404, 'resourceNotFound', 'Resource Not Found', 'Bulk not found'),
            ];
        }
        return bulk;
    }

    private static validation(request: BelcotaxMockApiRequest): [number, unknown] {
        const bulk = this.getBulk(request);
        if (Array.isArray(bulk)) {
            return bulk;
        }
        let status = bulk.rejected ? 'rejected' : 'accepted';
        if (bulk.inProgressPolls > 0) {
            bulk.inProgressPolls -= 1;
            status = 'inProgress';
        }
        return [200, { id: bulk.id + '-1', requestDateTime: bulk.requestDateTime, status }];
    }

    private static feedback(request: BelcotaxMockApiRequest): [number, unknown] {
        const bulk = this.getBulk(request);
        if (Array.isArray(bulk)) {
            return bulk;
        }
        if (bulk.inProgressPolls > 0) {
            return [
                400,
                belcotaxProblem(400, 'badRequest', 'Bad Request', 'The bulk is not validated yet'),
            ];
        }
        if (!bulk.rejected) {
            return [200, { id: bulk.id, status: 'accepted', count: bulk.count }];
        }
        return [200, feedback(bulk.issues)];
    }

    private static fichesWithChild(lines: Line[]) {
        const people = new Map(
            lines
                .map((line, index) => ({ line, number: index + 1 }))
                .filter(({ line }) => line.$s?.startsWith('urn:r:d:p:'))
                .map((person) => [person.line.k, person]),
        );
        return lines
            .map((line, index) => ({ line, number: index + 1 }))
            .filter(({ line }) => line.$s?.startsWith('urn:f:d:'))
            .map((fiche) => ({ fiche, child: people.get(fiche.line['childRef'] as string) }));
    }

    private static firstName(line: Line | undefined) {
        const names = line?.['fn'];
        return Array.isArray(names) ? String(names[0]) : '';
    }

    private static chooseOutcome(lines: Line[]): BelcotaxMockOutcome {
        const names = this.fichesWithChild(lines).map(({ child }) => this.firstName(child?.line));
        for (const outcome of [
            BelcotaxMockOutcome.FormatErrors,
            BelcotaxMockOutcome.BusinessErrors,
        ] as const) {
            if (names.includes(belcotaxMockFirstNames[outcome])) {
                return outcome;
            }
        }
        return BelcotaxMockOutcome.Accepted;
    }

    /**
     * FOD only reports a line number for format errors, no key
     */
    private static formatIssues(lines: Line[]): Issue[] {
        const fiches = this.fichesWithChild(lines);
        const marked = fiches.filter(
            ({ child }) =>
                this.firstName(child?.line) ===
                belcotaxMockFirstNames[BelcotaxMockOutcome.FormatErrors],
        );
        return (marked.length ? marked : fiches.slice(0, 1)).map(({ fiche }) =>
            formatIssue(
                fiche.number,
                'Ongeldig formaat : ' + JSON.stringify(fiche.line['2031'] ?? ''),
            ),
        );
    }

    private static businessIssues(lines: Line[]): Issue[] {
        const fiches = this.fichesWithChild(lines);
        const marked = this.outcome
            ? fiches
            : fiches.filter(
                  ({ child }) =>
                      this.firstName(child?.line) ===
                      belcotaxMockFirstNames[BelcotaxMockOutcome.BusinessErrors],
              );
        return marked.map(({ fiche }) => ({
            type: 'urn:problem-type:belcotax:issue:uNDEFINED:checkNumberOfDays86',
            title: 'checkNumberOfDays86',
            detail: 'Het aantal dagen is groter dan het aantal dagen tussen begin- en einddatum (periode 1).',
            inputs: [
                { in: 'body', name: '/$/4101/0/2110' },
                { in: 'body', name: '/$/4101/0/2055' },
                { in: 'body', name: '/$/4101/0/2056' },
            ],
            key: fiche.line.k,
            line: fiche.number,
        }));
    }
}

function formatIssue(line: number, detail: string): Issue {
    return {
        type: 'urn:problem-type:belcotax:issue:invalidFormat:invalidFormat',
        title: 'InvalidFormat',
        detail,
        in: 'body',
        name: '/$/2031',
        line,
    };
}

/**
 * Enough of multipart/form-data for the text file we send ourselves
 */
function readMultipartField(
    body: string,
    contentType: string | undefined,
    name: string,
): string | null {
    const boundary = /boundary="?([^";]+)"?/i.exec(contentType ?? '')?.[1];
    if (!boundary) {
        return null;
    }
    for (const part of body.split('--' + boundary)) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
            continue;
        }
        const headers = part.substring(0, headerEnd);
        if (headers.toLowerCase().includes(`name="${name.toLowerCase()}"`)) {
            return part.substring(headerEnd + 4).replace(/\r\n$/, '');
        }
    }
    return null;
}
