import { createTestPdf } from '@stamhoofd/pdf-parse/testing/index.js';
import { JudicialRecordCheck, JudicialRecordCheckExplanation, JudicialRecordCheckResult, JudicialRecordCheckStatus, JudicialRecordStatus } from '@stamhoofd/structures';
import { blankExtractLines } from '../../../tests/helpers/JudicialRecordExtract.js';
import { checkJudicialRecordExtract, checkJudicialRecordExtractContent } from './checkJudicialRecordExtract.js';

const member = {
    firstName: 'Jan',
    lastName: 'Janssens',
    birthDay: new Date(Date.UTC(2006, 3, 5)),
};

/** The extract was issued on 15/10/2026 */
const deliveredAt = new Date(Date.UTC(2026, 9, 20, 10, 0));

const signatureVerified = JudicialRecordCheckResult.create({
    check: JudicialRecordCheck.Authentic,
    status: JudicialRecordCheckStatus.Passed,
    explanation: JudicialRecordCheckExplanation.SignedByJustice,
});

function extractPdf(overrides: Parameters<typeof blankExtractLines>[0] = {}): Uint8Array {
    return createTestPdf(blankExtractLines(overrides).map((text, index) => ({ text, y: 800 - index * 20 })));
}

function statusOf(response: { checks: JudicialRecordCheckResult[] }, check: JudicialRecordCheck) {
    return response.checks.find(c => c.check === check)!;
}

describe('checkJudicialRecordExtract', () => {
    it('approves a blank extract that passes every check', async () => {
        const response = await checkJudicialRecordExtractContent({ data: extractPdf(), member, deliveredAt, authentic: signatureVerified });

        expect(response.status).toBe(JudicialRecordStatus.Approved);
        expect(response.checks.map(c => c.status)).toEqual(Array(5).fill(JudicialRecordCheckStatus.Passed));
    });

    it('sends an extract that is not blank to a reviewer, without rejecting it', async () => {
        const response = await checkJudicialRecordExtractContent({
            data: extractPdf({ blankMarker: 'Antecedenten: veroordeeld op 01/02/2020' }),
            member,
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(response.status).toBe(JudicialRecordStatus.UnderReview);
        expect(statusOf(response, JudicialRecordCheck.Blank).explanation).toBe(JudicialRecordCheckExplanation.IsNotBlank);
    });

    it('never shows the blank check to the member', async () => {
        const response = await checkJudicialRecordExtractContent({
            data: extractPdf({ blankMarker: null }),
            member,
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(response.getMemberVisibleChecks().map(c => c.check)).toEqual([
            JudicialRecordCheck.Authentic,
            JudicialRecordCheck.Identity,
            JudicialRecordCheck.Model,
            JudicialRecordCheck.Age,
        ]);
    });

    it('rejects an extract of someone else', async () => {
        const response = await checkJudicialRecordExtractContent({
            data: extractPdf({ lastName: 'Naam: PEETERS' }),
            member,
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(response.status).toBe(JudicialRecordStatus.AutomaticallyRejected);
        expect(statusOf(response, JudicialRecordCheck.Identity).explanation).toBe(JudicialRecordCheckExplanation.IdentityMismatch);
        expect(statusOf(response, JudicialRecordCheck.Identity).explanationParams).toEqual({ name: 'Jan Janssens' });
    });

    it('matches a name that only differs by accents, hyphens and casing', async () => {
        const response = await checkJudicialRecordExtractContent({
            data: extractPdf({ lastName: 'Naam: DE LETTER', firstName: "Voorna(a)m(en): JEAN-NOËL" }),
            member: { firstName: "Jean noel", lastName: 'de-letter', birthDay: member.birthDay },
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(statusOf(response, JudicialRecordCheck.Identity).status).toBe(JudicialRecordCheckStatus.Passed);
    });

    it('rejects another model than 596.2', async () => {
        const response = await checkJudicialRecordExtractContent({
            data: extractPdf({ purposeValue: 'Artikel 595 - model 596.1 - andere finaliteit' }),
            member,
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(response.status).toBe(JudicialRecordStatus.AutomaticallyRejected);
        expect(statusOf(response, JudicialRecordCheck.Model).explanation).toBe(JudicialRecordCheckExplanation.ModelMismatch);
    });

    it('rejects a model that only mentions 596.2 in its purpose', async () => {
        const response = await checkJudicialRecordExtractContent({
            // The purpose has to start with the model number: naming it is not being it
            data: extractPdf({ purposeValue: '596.1 - model voor de gereglementeerde activiteiten, niet 596.2' }),
            member,
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(response.status).toBe(JudicialRecordStatus.AutomaticallyRejected);
        expect(statusOf(response, JudicialRecordCheck.Model).explanation).toBe(JudicialRecordCheckExplanation.ModelMismatch);
    });

    it('rejects an extract older than one month', async () => {
        const response = await checkJudicialRecordExtractContent({
            data: extractPdf(),
            member,
            deliveredAt: new Date(Date.UTC(2026, 10, 16)),
            authentic: signatureVerified,
        });

        expect(response.status).toBe(JudicialRecordStatus.AutomaticallyRejected);
        expect(statusOf(response, JudicialRecordCheck.Age).explanation).toBe(JudicialRecordCheckExplanation.AgeTooOld);
    });

    it('accepts an extract that is exactly at the age limit', async () => {
        const response = await checkJudicialRecordExtractContent({
            data: extractPdf(),
            member,
            deliveredAt: new Date(Date.UTC(2026, 10, 15, 23, 0)),
            authentic: signatureVerified,
        });

        expect(statusOf(response, JudicialRecordCheck.Age).status).toBe(JudicialRecordCheckStatus.Passed);
    });

    it('rejects a document we could not read, without blaming the member', async () => {
        const response = await checkJudicialRecordExtractContent({
            data: new Uint8Array(Buffer.from('not a pdf')),
            member,
            deliveredAt,
            authentic: signatureVerified,
        });

        expect(response.status).toBe(JudicialRecordStatus.AutomaticallyRejected);
        expect(statusOf(response, JudicialRecordCheck.Identity).explanation).toBe(JudicialRecordCheckExplanation.DocumentNotReadable);
        expect(statusOf(response, JudicialRecordCheck.Identity).explanationParams).toEqual({ code: 'invalid_pdf' });
    });

    it('rejects a pdf that is not signed by FOD Justitie, without reading it', async () => {
        const response = await checkJudicialRecordExtract({ data: extractPdf(), member, deliveredAt });

        expect(response.status).toBe(JudicialRecordStatus.AutomaticallyRejected);
        expect(statusOf(response, JudicialRecordCheck.Authentic).explanation).toBe(JudicialRecordCheckExplanation.SignatureInvalid);
        expect(statusOf(response, JudicialRecordCheck.Authentic).explanationParams).toEqual({ code: 'no_signature' });

        // The text of a document we cannot place is not worth reading
        expect(response.checks.slice(1).map(c => c.status)).toEqual(Array(4).fill(JudicialRecordCheckStatus.NotStarted));
    });
});
