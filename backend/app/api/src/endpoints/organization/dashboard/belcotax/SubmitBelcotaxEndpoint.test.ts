import { Database } from '@node/database';
import { Request } from '@node/endpoints';
import { EmailMocker } from '@stamhoofd/email';
import type { DocumentTemplate } from '@stamhoofd/models';
import { BelcotaxConnection, BelcotaxSubmission, Document, UserFactory } from '@stamhoofd/models';
import { DocumentStatus, LimitedFilteredRequest, Permissions } from '@stamhoofd/structures';
import type {
    BelcotaxSubmission as BelcotaxSubmissionStruct,
    BelcotaxSubmitPreview,
} from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import {
    BelcotaxDocumentStatus,
    BelcotaxSubmissionStatus,
} from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { Formatter } from '@stamhoofd/utility';
import { readFile } from 'node:fs/promises';
import type { BelcotaxFodMocker } from '../../../../../tests/helpers/BelcotaxFodMocker.js';
import {
    belcotaxCompanyNumber,
    belcotaxRequest,
    connectBelcotax,
    initBelcotaxApi,
    initBelcotaxOrganization,
} from '../../../../../tests/init/initBelcotax.js';
import {
    belcotaxAnswers,
    completeBelcotaxDocumentAnswers,
    createBelcotaxDocument,
    createBelcotaxTemplate,
} from '../../../../../tests/init/initBelcotaxTemplate.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../../services/SessionService.js';
import { BelcotaxSubmissionService } from '../../../../services/belcotax/BelcotaxSubmissionService.js';
import {
    BelcotaxMockBulks,
    BelcotaxMockOutcome,
} from '../../../../services/belcotax/local/BelcotaxBulkApiMockBulks.js';
import { GetDocumentsEndpoint } from '../documents/GetDocumentsEndpoint.js';
import { GetBelcotaxSubmissionEndpoint } from './GetBelcotaxSubmissionEndpoint.js';
import { GetBelcotaxSubmissionsEndpoint } from './GetBelcotaxSubmissionsEndpoint.js';
import { GetBelcotaxSubmitPreviewEndpoint } from './GetBelcotaxSubmitPreviewEndpoint.js';
import { SubmitBelcotaxEndpoint } from './SubmitBelcotaxEndpoint.js';

type Context = Awaited<ReturnType<typeof initBelcotaxOrganization>>;

describe('Endpoint.SubmitBelcotax', () => {
    let fod: BelcotaxFodMocker;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
        fod = initBelcotaxApi('local');
        // Every test uses the same KBO number, which can only have one open submission
        await BelcotaxSubmission.delete();
        // The default templates, as the migration adds them
        await Database.statement(
            await readFile(
                import.meta.dirname +
                    '/../../../../migrations/1795003342-default-belcotax-submission-email-templates.sql',
                { encoding: 'utf-8' },
            ),
        );
    });

    async function setup({ connect = true } = {}) {
        const context = await initBelcotaxOrganization();
        if (connect) {
            await connectBelcotax(fod, context, context.company.id);
        }
        const template = await createBelcotaxTemplate(context.organization);
        return { ...context, template };
    }

    async function preview(context: Context, template: DocumentTemplate) {
        const response = await belcotaxRequest<BelcotaxSubmitPreview>(
            new GetBelcotaxSubmitPreviewEndpoint(),
            'GET',
            `/organization/document-templates/${template.id}/belcotax/preview`,
            context.host,
            context.token,
        );
        return response.body;
    }

    async function submit(context: Context, template: DocumentTemplate) {
        const response = await belcotaxRequest<BelcotaxSubmissionStruct>(
            new SubmitBelcotaxEndpoint(),
            'POST',
            `/organization/document-templates/${template.id}/belcotax/submit`,
            context.host,
            context.token,
        );
        return response.body;
    }

    async function getSubmission(context: Context, id: string) {
        const response = await belcotaxRequest<BelcotaxSubmissionStruct>(
            new GetBelcotaxSubmissionEndpoint(),
            'GET',
            `/organization/belcotax/submissions/${id}`,
            context.host,
            context.token,
        );
        return response.body;
    }

    /**
     * What the follow-up and the cron do
     */
    async function poll(id: string) {
        await BelcotaxSubmissionService.poll((await BelcotaxSubmission.getByID(id))!);
    }

    function lastFile() {
        return BelcotaxMockBulks.files
            .at(-1)!
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line) as Record<string, unknown>);
    }

    async function getDocument(id: string) {
        return (await Document.getByID(id))!;
    }

    /**
     * Every token of the default template got a value
     */
    function expectFilledIn(text: string | undefined) {
        expect(text).toBeTruthy();
        expect(text).not.toContain('{{');
    }

    async function getEmails(subject: string) {
        return (await EmailMocker.transactional.getSucceededEmails()).filter((e) =>
            e.subject.includes(subject),
        );
    }

    test('sends the new documents, polls the result and only sends what changed afterwards', async () => {
        const context = await setup();
        const { template } = context;
        const noah = await createBelcotaxDocument(template, 'Noah');
        const lena = await createBelcotaxDocument(template, 'Lena');
        const incomplete = await createBelcotaxDocument(
            template,
            'Mila',
            DocumentStatus.MissingData,
        );
        // Never sent through the API, but its fiche may have been uploaded with the download
        const removed = await createBelcotaxDocument(template, 'Tom', DocumentStatus.Deleted);

        expect(await preview(context, template)).toMatchObject({
            newCount: 2,
            changedCount: 0,
            deletedCount: 1,
            unchangedCount: 0,
            companyNumber: belcotaxCompanyNumber,
            companyId: context.company.id,
            connection: { companyNumber: belcotaxCompanyNumber },
            openSubmission: null,
            check: { incompleteDocuments: [{ id: incomplete.id }] },
        });
        // The preview sends nothing
        expect(BelcotaxMockBulks.files).toHaveLength(0);

        const submission = await submit(context, template);
        expect(submission).toMatchObject({
            status: BelcotaxSubmissionStatus.Validating,
            ficheCount: 2,
            deletedCount: 1,
            submittedBy: context.admin.name || context.admin.email,
        });
        expect(submission.bulkId).toBeTruthy();
        const keys = lastFile().map((l) => l['k']);
        expect(keys.slice(0, 3)).toEqual([
            `STA-contact-${template.id}`,
            `STA-org-${context.company.id}`,
            `STA-cert-${template.id}`,
        ]);
        expect(keys.slice(3, -1).sort()).toEqual(
            [noah.id, lena.id]
                .flatMap((id) => [`STA-2026-${id}-b`, `STA-2026-${id}-c`, `STA-2026-${id}`])
                .sort(),
        );
        expect(lastFile().at(-1)).toEqual({ $s: 'urn:f:x:1', k: `STA-2026-${removed.id}` });
        expect((await getDocument(noah.id)).belcotaxStatus).toBe(BelcotaxDocumentStatus.Sent);

        // One submission per template at a time
        expect((await preview(context, template)).openSubmission?.id).toBe(submission.id);
        await expect(submit(context, template)).rejects.toThrow(
            STExpect.errorWithCode('belcotax_submission_open'),
        );

        // The mock answers inProgress once
        await poll(submission.id);
        expect((await getSubmission(context, submission.id)).status).toBe(
            BelcotaxSubmissionStatus.Validating,
        );
        await poll(submission.id);
        expect(await getSubmission(context, submission.id)).toMatchObject({
            status: BelcotaxSubmissionStatus.Accepted,
            issues: [],
        });

        const acceptedNoah = await getDocument(noah.id);
        expect(acceptedNoah.belcotaxStatus).toBe(BelcotaxDocumentStatus.Accepted);
        expect(acceptedNoah.belcotaxHash).toMatch(/^[0-9a-f]{64}$/);
        expect((await getDocument(removed.id)).belcotaxStatus).toBe(
            BelcotaxDocumentStatus.Accepted,
        );
        const accepted = await getEmails('Belcotax aanvaardde de fiscale attesten van Kamp 2026');
        expect(accepted).toHaveLength(1);
        expect(accepted[0].to).toContain(context.admin.email);
        expectFilledIn(accepted[0].text);
        expect(accepted[0].text).toContain(
            'Belcotax aanvaardde de zending van ' +
                Formatter.dateTime(submission.createdAt) +
                ' met 3 fiscale attesten van Kamp 2026 (' +
                context.organization.name +
                ').',
        );
        expect(accepted[0].html).toContain(
            '/documenten/' + template.id + '?belcotax_submission=' + submission.id,
        );

        expect(await preview(context, template)).toMatchObject({
            newCount: 0,
            changedCount: 0,
            unchangedCount: 2,
        });
        await expect(submit(context, template)).rejects.toThrow(
            STExpect.errorWithCode('belcotax_nothing_to_send'),
        );

        // A changed and a deleted document go again, the others and the accepted deletion not
        const changed = await getDocument(noah.id);
        changed.data.fieldAnswers = belcotaxAnswers({
            ...completeBelcotaxDocumentAnswers,
            'debtor.firstName': 'Els',
        });
        await changed.save();
        await Document.update().set('status', DocumentStatus.Deleted).where('id', lena.id).update();

        expect(await preview(context, template)).toMatchObject({
            newCount: 0,
            changedCount: 1,
            deletedCount: 1,
            unchangedCount: 0,
        });

        const second = await submit(context, template);
        expect(second).toMatchObject({ ficheCount: 1, deletedCount: 1 });
        expect(lastFile().map((l) => l['k'])).toEqual([
            `STA-contact-${template.id}`,
            `STA-org-${context.company.id}`,
            `STA-cert-${template.id}`,
            `STA-2026-${noah.id}-b`,
            `STA-2026-${noah.id}-c`,
            `STA-2026-${noah.id}`,
            `STA-2026-${lena.id}`,
        ]);
        expect(lastFile().at(-1)).toEqual({ $s: 'urn:f:x:1', k: `STA-2026-${lena.id}` });

        await poll(second.id);
        await poll(second.id);
        expect((await getSubmission(context, second.id)).status).toBe(
            BelcotaxSubmissionStatus.Accepted,
        );
        expect(await preview(context, template)).toMatchObject({
            newCount: 0,
            changedCount: 0,
            deletedCount: 0,
            unchangedCount: 1,
        });
    });

    test('format errors are refused right away and mapped to the document by line', async () => {
        const context = await setup();
        const { template } = context;
        const noah = await createBelcotaxDocument(template, 'Noah');
        const wrong = await createBelcotaxDocument(template, 'Formaatfout');

        const submission = await submit(context, template);

        expect(submission).toMatchObject({
            status: BelcotaxSubmissionStatus.Rejected,
            bulkId: null,
            issues: [
                {
                    documentId: wrong.id,
                    documentDescription: 'Formaatfout Claes, Kamp 2026',
                    key: `STA-2026-${wrong.id}`,
                    line: expect.any(Number),
                    code: 'InvalidFormat',
                },
            ],
        });
        // Belcotax refuses the whole file
        expect((await getDocument(noah.id)).belcotaxStatus).toBe(BelcotaxDocumentStatus.Rejected);
        expect((await getDocument(wrong.id)).belcotaxStatus).toBe(BelcotaxDocumentStatus.Rejected);
        expect((await getDocument(noah.id)).belcotaxHash).toBeNull();

        const email = await getEmails('Belcotax weigerde de fiscale attesten van Kamp 2026');
        expect(email).toHaveLength(1);
        expectFilledIn(email[0].text);
        expect(email[0].text).toContain('Aantal fouten van Belcotax: 1.');
        const report = await getEmails('Belcotax-zending');
        expect(report).toHaveLength(1);
        expect(report[0].html).toContain(wrong.id);

        // Everything that was not accepted goes again
        expect((await preview(context, template)).newCount).toBe(2);
    });

    test('business errors are polled and mapped to the document by key', async () => {
        const context = await setup();
        const { template } = context;
        const noah = await createBelcotaxDocument(template, 'Noah');
        const rejected = await createBelcotaxDocument(template, 'Geweigerd');

        const submission = await submit(context, template);
        expect(submission.status).toBe(BelcotaxSubmissionStatus.Validating);

        await poll(submission.id);
        await poll(submission.id);

        expect(await getSubmission(context, submission.id)).toMatchObject({
            status: BelcotaxSubmissionStatus.Rejected,
            issues: [
                {
                    documentId: rejected.id,
                    documentDescription: 'Geweigerd Claes, Kamp 2026',
                    key: `STA-2026-${rejected.id}`,
                    code: 'checkNumberOfDays86',
                    message:
                        'Het aantal dagen is groter dan het aantal dagen tussen begin- en einddatum (periode 1).',
                },
            ],
        });
        expect((await getDocument(noah.id)).belcotaxStatus).toBe(BelcotaxDocumentStatus.Rejected);
        expect(await getEmails('Belcotax weigerde de fiscale attesten van Kamp 2026')).toHaveLength(
            1,
        );
        expect(await getEmails('Belcotax-zending')).toHaveLength(1);

        // Documents table: column and filter
        const documents = await testServer.test(
            new GetDocumentsEndpoint(),
            Request.get({
                path: '/organization/documents',
                host: context.host,
                query: new LimitedFilteredRequest({
                    limit: 10,
                    filter: {
                        templateId: template.id,
                        belcotaxStatus: { $in: [BelcotaxDocumentStatus.Rejected, null] },
                    },
                }),
                headers: { authorization: 'Bearer ' + context.token.accessToken },
            }),
        );
        expect(documents.body.results.map((d) => d.id).sort()).toEqual(
            [noah.id, rejected.id].sort(),
        );
    });

    test('a submission that does not reach Belcotax changes no document', async () => {
        const context = await setup();
        const { template } = context;
        const noah = await createBelcotaxDocument(template, 'Noah');
        fod.forcedApiResponses.push({
            status: 503,
            body: {
                type: 'urn:problem-type:belgif:serviceUnavailable',
                title: 'Service Unavailable',
            },
        });

        const submission = await submit(context, template);

        expect(submission.status).toBe(BelcotaxSubmissionStatus.Failed);
        expect(submission.errorMessage).toContain('Service Unavailable');
        expect((await getDocument(noah.id)).belcotaxStatus).toBeNull();
        // Sending again is safe
        expect((await preview(context, template)).openSubmission).toBeNull();
        expect((await submit(context, template)).status).toBe(BelcotaxSubmissionStatus.Validating);
    });

    test('without a result after 24 hours the result is unknown and the documents go back', async () => {
        const context = await setup();
        const { template } = context;
        const noah = await createBelcotaxDocument(template, 'Noah');
        BelcotaxMockBulks.inProgressPolls = 1000;

        const submission = await submit(context, template);
        await poll(submission.id);
        expect((await getSubmission(context, submission.id)).status).toBe(
            BelcotaxSubmissionStatus.Validating,
        );

        const model = (await BelcotaxSubmission.getByID(submission.id))!;
        model.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
        await model.save();

        // The cron
        await BelcotaxSubmissionService.pollOpenSubmissions();

        expect(await getSubmission(context, submission.id)).toMatchObject({
            status: BelcotaxSubmissionStatus.Unknown,
        });
        expect((await getDocument(noah.id)).belcotaxStatus).toBeNull();
        const email = await getEmails('Geen resultaat van Belcotax voor Kamp 2026');
        expect(email).toHaveLength(1);
        expectFilledIn(email[0].text);
        expect(email[0].text).toContain('Belcotax gaf binnen 24 uur geen resultaat.');
    });

    test('an expired connection first has to be connected again', async () => {
        const context = await setup({ connect: false });
        await createBelcotaxDocument(context.template, 'Noah');

        expect(await preview(context, context.template)).toMatchObject({
            connection: null,
            companyId: context.company.id,
        });
        await expect(submit(context, context.template)).rejects.toThrow(
            STExpect.errorWithCode('belcotax_connection_expired'),
        );

        await connectBelcotax(fod, context, context.company.id);
        fod.expireRefreshTokens();
        await expect(submit(context, context.template)).rejects.toThrow(
            STExpect.errorWithCode('belcotax_connection_expired'),
        );
        expect(
            (await BelcotaxConnection.getFor(context.organization.id, belcotaxCompanyNumber))
                ?.isValid,
        ).toBe(false);
        expect(BelcotaxMockBulks.files).toHaveLength(0);
    });

    test('the mock outcome can be forced for every document', async () => {
        const context = await setup();
        const noah = await createBelcotaxDocument(context.template, 'Noah');
        BelcotaxMockBulks.outcome = BelcotaxMockOutcome.BusinessErrors;

        const submission = await submit(context, context.template);
        await poll(submission.id);
        await poll(submission.id);

        expect((await getSubmission(context, submission.id)).issues).toMatchObject([
            { documentId: noah.id },
        ]);
    });

    test('lists the submissions of a template', async () => {
        const context = await setup();
        await createBelcotaxDocument(context.template, 'Noah');
        const submission = await submit(context, context.template);

        const response = await belcotaxRequest<BelcotaxSubmissionStruct[]>(
            new GetBelcotaxSubmissionsEndpoint(),
            'GET',
            `/organization/document-templates/${context.template.id}/belcotax/submissions`,
            context.host,
            context.token,
        );
        expect(response.body.map((s) => s.id)).toEqual([submission.id]);
    });

    test('requires full access to documents and the feature flag', async () => {
        const context = await setup();
        await createBelcotaxDocument(context.template, 'Noah');

        const reader = await new UserFactory({
            organization: context.organization,
            permissions: Permissions.create({ level: PermissionLevel.Read }),
        }).create();
        const readerToken = await SessionService.createSession(reader);
        await expect(submit({ ...context, token: readerToken }, context.template)).rejects.toThrow(
            STExpect.errorWithCode('permission_denied'),
        );

        context.organization.privateMeta.featureFlags = [];
        await context.organization.save();
        await expect(submit(context, context.template)).rejects.toThrow(
            STExpect.errorWithCode('not_available'),
        );
        await expect(preview(context, context.template)).rejects.toThrow(
            STExpect.errorWithCode('not_available'),
        );
        expect(BelcotaxMockBulks.files).toHaveLength(0);
    });

    test('documents of other organizations are not listed or sent', async () => {
        const context = await setup();
        const other = await initBelcotaxOrganization();
        await expect(
            belcotaxRequest(
                new GetBelcotaxSubmitPreviewEndpoint(),
                'GET',
                `/organization/document-templates/${context.template.id}/belcotax/preview`,
                other.host,
                other.token,
            ),
        ).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });
});
