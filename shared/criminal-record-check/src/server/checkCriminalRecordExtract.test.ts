import { CriminalRecordCheck, CriminalRecordCheckExplanation, CriminalRecordCheckResult, CriminalRecordCheckStatus, CriminalRecordStatus } from '@stamhoofd/structures';
import { createTestPdf } from '../testing/createTestPdf.js';
import { blankExtractLines } from '../testing/extractLines.js';
import { checkCriminalRecordExtract, checkCriminalRecordExtractContent } from './checkCriminalRecordExtract.js';

const member = {
    firstName: 'Jan',
    lastName: 'Janssens',
    birthDay: new Date(Date.UTC(2006, 3, 5)),
};

/** The extract was issued on 15/10/2026 */
const deliveredAt = new Date(Date.UTC(2026, 9, 20, 10, 0));

const signatureVerified = CriminalRecordCheckResult.create({
    check: CriminalRecordCheck.Authentic,
    status: CriminalRecordCheckStatus.Passed,
    explanation: CriminalRecordCheckExplanation.SignedByJustice,
});

function extractPdf(overrides: Parameters<typeof blankExtractLines>[0] = {}): Uint8Array {
    return createTestPdf(blankExtractLines(overrides).map((text, index) => ({ text, y: 800 - index * 20 })));
}

function statusOf(response: { checks: CriminalRecordCheckResult[] }, check: CriminalRecordCheck) {
    return response.checks.find(c => c.check === check)!;
}

describe('checkCriminalRecordExtract', () => {
    it('approves a blank extract that passes every check', async () => {
        const response = await checkCriminalRecordExtractContent({ data: extractPdf(), member, deliveredAt, authentic: signatureVerified });

        expect(response.status).toBe(CriminalRecordStatus.Approved);
        expect(response.checks.map(c => c.status)).toEqual(Array(5).fill(CriminalRecordCheckStatus.Passed));
    });

    it('sends an extract that is not blank to a reviewer, without rejecting it', async () => {
        const response = await checkCriminalRecordExtractContent({
            data: extractPdf({ blankMarker: 'Antecedenten: veroordeeld op 01/02/2020' }),
            member,
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(response.status).toBe(CriminalRecordStatus.UnderReview);
        expect(statusOf(response, CriminalRecordCheck.Blank).explanation).toBe(CriminalRecordCheckExplanation.IsNotBlank);
    });

    it('never shows the blank check to the member', async () => {
        const response = await checkCriminalRecordExtractContent({
            data: extractPdf({ blankMarker: null }),
            member,
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(response.getMemberVisibleChecks().map(c => c.check)).toEqual([
            CriminalRecordCheck.Authentic,
            CriminalRecordCheck.Identity,
            CriminalRecordCheck.Model,
            CriminalRecordCheck.Age,
        ]);
    });

    it('rejects an extract of someone else', async () => {
        const response = await checkCriminalRecordExtractContent({
            data: extractPdf({ lastName: 'Naam: PEETERS' }),
            member,
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(response.status).toBe(CriminalRecordStatus.AutomaticallyRejected);
        expect(statusOf(response, CriminalRecordCheck.Identity).explanation).toBe(CriminalRecordCheckExplanation.IdentityMismatch);
        expect(statusOf(response, CriminalRecordCheck.Identity).explanationParams).toEqual({ name: 'Jan Janssens' });
    });

    it('matches a name that only differs by accents, hyphens and casing', async () => {
        const response = await checkCriminalRecordExtractContent({
            data: extractPdf({ lastName: 'Naam: DE LETTER', firstName: "Voorna(a)m(en): JEAN-NOËL" }),
            member: { firstName: "Jean noel", lastName: 'de-letter', birthDay: member.birthDay },
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(statusOf(response, CriminalRecordCheck.Identity).status).toBe(CriminalRecordCheckStatus.Passed);
    });

    it('rejects another model than 596.2', async () => {
        const response = await checkCriminalRecordExtractContent({
            data: extractPdf({ purposeValue: 'Artikel 595 - model 596.1 - andere finaliteit' }),
            member,
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(response.status).toBe(CriminalRecordStatus.AutomaticallyRejected);
        expect(statusOf(response, CriminalRecordCheck.Model).explanation).toBe(CriminalRecordCheckExplanation.ModelMismatch);
    });

    it('rejects an extract older than one month', async () => {
        const response = await checkCriminalRecordExtractContent({
            data: extractPdf(),
            member,
            deliveredAt: new Date(Date.UTC(2026, 10, 16)),
            authentic: signatureVerified,
        });

        expect(response.status).toBe(CriminalRecordStatus.AutomaticallyRejected);
        expect(statusOf(response, CriminalRecordCheck.Age).explanation).toBe(CriminalRecordCheckExplanation.AgeTooOld);
    });

    it('accepts an extract that is exactly at the age limit', async () => {
        const response = await checkCriminalRecordExtractContent({
            data: extractPdf(),
            member,
            deliveredAt: new Date(Date.UTC(2026, 10, 15, 23, 0)),
            authentic: signatureVerified,
        });

        expect(statusOf(response, CriminalRecordCheck.Age).status).toBe(CriminalRecordCheckStatus.Passed);
    });

    it('rejects a document we could not read, without blaming the member', async () => {
        const response = await checkCriminalRecordExtractContent({
            data: new Uint8Array(Buffer.from('not a pdf')),
            member,
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(response.status).toBe(CriminalRecordStatus.AutomaticallyRejected);
        expect(statusOf(response, CriminalRecordCheck.Identity).explanation).toBe(CriminalRecordCheckExplanation.DocumentNotReadable);
        expect(statusOf(response, CriminalRecordCheck.Identity).explanationParams).toEqual({ code: 'INVALID_PDF' });
    });

    it('rejects a pdf that is not signed by FOD Justitie, without reading it', async () => {
        const response = await checkCriminalRecordExtract({ data: extractPdf(), member, deliveredAt });

        expect(response.status).toBe(CriminalRecordStatus.AutomaticallyRejected);
        expect(statusOf(response, CriminalRecordCheck.Authentic).explanation).toBe(CriminalRecordCheckExplanation.SignatureInvalid);
        expect(statusOf(response, CriminalRecordCheck.Authentic).explanationParams).toEqual({ code: 'no_signature' });

        // The text of a document we cannot place is not worth reading
        expect(response.checks.slice(1).map(c => c.status)).toEqual(Array(4).fill(CriminalRecordCheckStatus.NotStarted));
    });
});
