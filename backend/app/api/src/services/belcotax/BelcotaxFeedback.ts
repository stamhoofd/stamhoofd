import { BelcotaxSubmissionIssue } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';

import { BelcotaxJsonlService } from './BelcotaxJsonlService.js';

/**
 * `Feedback` of the bulk API (schemas/openapi.yml, v1.1.1): returned with HTTP 400 for
 * format errors on submit, and with HTTP 200 by `/validations/last/feedback` for business errors.
 */
export const belcotaxFeedbackType = 'urn:problem-type:belcotax:feedback';

export type BelcotaxValidationStatus = 'accepted' | 'rejected' | 'inProgress';

/**
 * The OpenAPI says `accepted | rejected | inProgress`, the PDF IN PROGRESS / ACCEPTED / REJECTED
 */
export function parseValidationStatus(json: unknown): BelcotaxValidationStatus | null {
    const status = (json as { status?: unknown } | null)?.status;
    if (typeof status !== 'string') {
        return null;
    }
    switch (status.replace(/[\s_-]+/g, '').toLowerCase()) {
        case 'accepted':
            return 'accepted';
        case 'rejected':
            return 'rejected';
        case 'inprogress':
            return 'inProgress';
    }
    return null;
}

export function isBelcotaxFeedback(json: unknown): json is { issues?: unknown } {
    return (json as { type?: unknown } | null)?.type === belcotaxFeedbackType;
}

/**
 * Maps every issue to the document it is about: by the key, or by the line for format errors, which have no key.
 * Business errors come with the key of the fiche, sometimes with a leading space. Shapes taken from FOD's
 * example files: https://financien.belgium.be/sites/default/files/downloads/ExamplesBelcotax2026.zip
 */
export function mapBelcotaxFeedbackIssues(
    json: unknown,
    submission: { lineKeys: string[]; descriptions: Map<string, string> },
): BelcotaxSubmissionIssue[] {
    const issues = (json as { issues?: unknown } | null)?.issues;
    if (!Array.isArray(issues)) {
        return [];
    }

    return issues.map((value: unknown) => {
        const issue = (value ?? {}) as Record<string, unknown>;
        const key = typeof issue.key === 'string' && issue.key.trim() ? issue.key.trim() : null;
        const line = Number.isInteger(issue.line) ? (issue.line as number) : null;
        const lineKey = line !== null ? (submission.lineKeys[line - 1] ?? null) : null;

        const candidate = BelcotaxJsonlService.documentIdFromKey(key ?? lineKey ?? '');
        const documentId = candidate && submission.descriptions.has(candidate) ? candidate : null;

        const type = typeof issue.type === 'string' ? issue.type : '';
        const title = typeof issue.title === 'string' ? issue.title : '';
        const detail = typeof issue.detail === 'string' ? issue.detail : '';

        return BelcotaxSubmissionIssue.create({
            documentId,
            documentDescription: documentId
                ? (submission.descriptions.get(documentId) ?? null)
                : null,
            key: key ?? lineKey,
            line,
            code: title || type.split(':').pop() || '',
            message: detail || title || type,
        });
    });
}
