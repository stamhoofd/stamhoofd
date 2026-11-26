import { isSimpleError, isSimpleErrors, SimpleError } from '@common/errors';
import type { User } from '@stamhoofd/models';
import {
    BelcotaxConnection,
    BelcotaxSubmission,
    Document,
    DocumentTemplate,
    Organization,
    User as UserModel,
} from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import {
    DocumentStatus,
    EmailTemplateType,
    JsonlExportResult,
    Replacement,
} from '@stamhoofd/structures';
import { getBelcotaxCompanyNumber } from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';
import type { BelcotaxSubmissionIssue } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import {
    BelcotaxDocumentStatus,
    BelcotaxSubmissionContent,
    BelcotaxSubmissionStatus,
    BelcotaxSubmitPreview,
    BelcotaxSubmittedDocument,
} from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { Formatter, sleep } from '@stamhoofd/utility';

import { Context } from '../../helpers/Context.js';
import { sendEmailTemplate } from '../../helpers/EmailBuilder.js';
import { WebmasterReport } from '../../helpers/WebmasterReport.js';
import type { BelcotaxDeletion, BelcotaxFiche } from './BelcotaxJsonlService.js';
import { BelcotaxJsonlService } from './BelcotaxJsonlService.js';
import {
    isBelcotaxFeedback,
    mapBelcotaxFeedbackIssues,
    parseValidationStatus,
} from './BelcotaxFeedback.js';
import type { BelcotaxApi } from './connection/BelcotaxConnectionService.js';
import { BelcotaxConnectionService } from './connection/BelcotaxConnectionService.js';
import { BelcotaxConfig } from './connection/BelcotaxConfig.js';
import { describeError } from './connection/BelcotaxHttp.js';
import type { JsonlExportBuild } from './JsonlExportService.js';
import { describe, JsonlExportService } from './JsonlExportService.js';

/**
 * How long Belcotax takes to check the business rules is not documented
 */
const maximumValidationTime = 24 * 60 * 60 * 1000;

/**
 * A process that stopped while sending leaves a submission behind that will never get an answer
 */
const maximumSendingTime = 30 * 60 * 1000;

/**
 * Polls of the cron, after the follow-up of the submission itself
 */
const cronPollInterval = 4 * 60 * 1000;

const submitTimeout = 2 * 60 * 1000;

type Changes = {
    fiches: { fiche: BelcotaxFiche; isNew: boolean }[];
    deletions: BelcotaxDeletion[];
    unchangedCount: number;
};

/**
 * Sends the documents of a fiscal template that Belcotax has not accepted yet, and follows the result up.
 * Never automatic: a submission always starts with an administrator choosing "Doorsturen".
 */
export class BelcotaxSubmissionService {
    /**
     * Polls right after a submission, so the administrator sees the result while waiting. The cron takes over after.
     */
    static followUpDelays = [
        2_000, 3_000, 5_000, 10_000, 20_000, 30_000, 60_000, 60_000, 120_000, 120_000, 300_000,
    ];

    static async getTemplate(id: string) {
        const template = await DocumentTemplate.getByID(id);
        if (
            !template ||
            !(await Context.auth.canAccessDocumentTemplate(template, PermissionLevel.Full))
        ) {
            throw Context.auth.notFoundOrNoAccess($t('%EK'));
        }
        JsonlExportService.assertSupported(template);
        if (template.status !== DocumentStatus.Published) {
            throw new SimpleError({
                code: 'belcotax_template_not_published',
                message: 'Only the documents of a published template can be sent to Belcotax',
                human: $t('Publiceer de attesten voor je ze doorstuurt naar Belcotax.'),
            });
        }
        return template;
    }

    static async preview(template: DocumentTemplate, organization: Organization) {
        const { build, companyNumber, changes } = await this.prepare(template, organization);
        const connection = await BelcotaxConnection.getFor(organization.id, companyNumber);
        const company = organization.meta.companies.find(
            (c) => getBelcotaxCompanyNumber(c) === companyNumber,
        );
        const openSubmission = await this.getOpenSubmission(template.id, companyNumber);

        return BelcotaxSubmitPreview.create({
            newCount: changes.fiches.filter((f) => f.isNew).length,
            changedCount: changes.fiches.filter((f) => !f.isNew).length,
            deletedCount: changes.deletions.length,
            unchangedCount: changes.unchangedCount,
            check: JsonlExportResult.create({
                documentCount: changes.fiches.length,
                deletedCount: changes.deletions.length,
                issues: build.issues,
                incompleteDocuments: build.incompleteDocuments,
            }),
            companyNumber,
            companyId: company?.id ?? null,
            connection: connection?.getStructure() ?? null,
            openSubmission: openSubmission?.getStructure() ?? null,
        });
    }

    static async submit(
        template: DocumentTemplate,
        organization: Organization,
        user: User,
    ): Promise<BelcotaxSubmission> {
        const { build, companyNumber, changes } = await this.prepare(template, organization);

        const blocking = build.issues.find((issue) => issue.documentId === null);
        if (blocking) {
            throw new SimpleError({
                code: 'belcotax_blocked',
                message: 'Belcotax would refuse the whole file: ' + blocking.message,
                human: blocking.message,
            });
        }

        if (changes.fiches.length === 0 && changes.deletions.length === 0) {
            throw new SimpleError({
                code: 'belcotax_nothing_to_send',
                message: 'Every document was already accepted by Belcotax',
                human: $t(
                    'Belcotax aanvaardde alle attesten al. Er is niets nieuws om door te sturen.',
                ),
            });
        }

        const connection = await BelcotaxConnection.getFor(organization.id, companyNumber);
        if (!connection?.isValid) {
            throw BelcotaxConnectionService.expiredError();
        }

        await JsonlExportService.reportIssues(template, organization, build.issues);

        const fiches = changes.fiches.map((f) => f.fiche);
        const { jsonl, lineKeys } = BelcotaxJsonlService.toJsonl({
            // Delete lines refer to nothing
            resources: fiches.length ? build.result.resources : [],
            fiches,
            deletions: changes.deletions,
        });

        const submission = await BelcotaxConnectionService.run(
            connection,
            async (api) => {
                // Inside the queue of the company, so two administrators can't both pass this check
                const open = await this.getOpenSubmission(template.id, companyNumber);
                if (open) {
                    throw new SimpleError({
                        code: 'belcotax_submission_open',
                        message: 'There is already an open submission for this template or company',
                        human: $t(
                            'Belcotax controleert nog een zending van deze organisator. Wacht op het resultaat voor je opnieuw doorstuurt.',
                        ),
                    });
                }

                const submission = new BelcotaxSubmission();
                submission.organizationId = organization.id;
                submission.templateId = template.id;
                submission.companyNumber = companyNumber;
                submission.userId = user.id;
                submission.submittedBy = user.name || user.email;
                submission.ficheCount = fiches.length;
                submission.deletedCount = changes.deletions.length;
                submission.content = BelcotaxSubmissionContent.create({
                    documents: [
                        ...fiches.map((f) =>
                            BelcotaxSubmittedDocument.create({
                                documentId: f.documentId,
                                hash: f.hash,
                            }),
                        ),
                        ...changes.deletions.map((d) =>
                            BelcotaxSubmittedDocument.create({
                                documentId: d.documentId,
                                hash: d.hash,
                                deleted: true,
                            }),
                        ),
                    ],
                    lineKeys,
                });
                await submission.save();

                await this.send(api, submission, jsonl, build);
                return submission;
            },
            { userId: user.id },
        );

        if (submission.status === BelcotaxSubmissionStatus.Validating) {
            this.followUp(submission.id);
        }
        return submission;
    }

    /**
     * Sending again is always safe: Belcotax overwrites a fiche or resource of the same sender with the same key
     */
    private static async send(
        api: BelcotaxApi,
        submission: BelcotaxSubmission,
        jsonl: string,
        build: JsonlExportBuild,
    ) {
        const form = new FormData();
        form.append(
            'content',
            new Blob([jsonl], { type: 'application/jsonl' }),
            `${submission.id}.jsonl`,
        );

        let response: Awaited<ReturnType<BelcotaxApi['request']>>;
        try {
            response = await api.request({
                method: 'POST',
                path: '/bulks/submit',
                body: form,
                timeout: submitTimeout,
            });
        } catch (e) {
            await this.finish(submission, BelcotaxSubmissionStatus.Failed, {
                errorMessage:
                    (isSimpleError(e) || isSimpleErrors(e) ? e.getHuman() + ' ' : '') +
                    $t(
                        'Het is niet zeker of Belcotax het bestand ontving. Stuur gerust opnieuw: Belcotax overschrijft wat het al heeft.',
                    ),
            });
            return;
        }

        const json = response.json as { id?: unknown } | null;
        if (
            response.status === 200 &&
            (typeof json?.id === 'string' || typeof json?.id === 'number')
        ) {
            submission.bulkId = String(json.id);
            submission.status = BelcotaxSubmissionStatus.Validating;
            await submission.save();
            await Document.update()
                .set('belcotaxStatus', BelcotaxDocumentStatus.Sent)
                .where('id', this.getDocumentIds(submission))
                .update();
            return;
        }

        if (response.status === 400 && isBelcotaxFeedback(response.json)) {
            await this.finish(submission, BelcotaxSubmissionStatus.Rejected, {
                issues: this.mapIssues(response.json, submission, build.documents),
            });
            return;
        }

        await this.finish(submission, BelcotaxSubmissionStatus.Failed, {
            errorMessage: $t('Belcotax weigerde het bestand ({reason}).', {
                reason: describeError(response.json) || 'HTTP ' + response.status,
            }),
        });
    }

    static async poll(submission: BelcotaxSubmission) {
        if (submission.status !== BelcotaxSubmissionStatus.Validating || !submission.bulkId) {
            return;
        }
        const bulkId = submission.bulkId;

        if (Date.now() - submission.createdAt.getTime() > maximumValidationTime) {
            await this.finish(submission, BelcotaxSubmissionStatus.Unknown, {
                errorMessage: $t(
                    'Belcotax gaf binnen 24 uur geen resultaat. Stuur opnieuw: Belcotax overschrijft wat het al heeft.',
                ),
            });
            return;
        }

        const connection = await BelcotaxConnection.getFor(
            submission.organizationId,
            submission.companyNumber,
        );
        try {
            if (!connection?.isValid) {
                throw BelcotaxConnectionService.expiredError();
            }
            await BelcotaxConnectionService.run(
                connection,
                async (api) => {
                    await submission.refresh();
                    if (submission.status !== BelcotaxSubmissionStatus.Validating) {
                        return;
                    }

                    const path = `/bulks/${encodeURIComponent(bulkId)}/validations/last`;
                    const response = await api.request({ method: 'GET', path });
                    submission.lastPolledAt = new Date();

                    const status =
                        response.status === 200 ? parseValidationStatus(response.json) : null;
                    if (status === 'accepted') {
                        await this.finish(submission, BelcotaxSubmissionStatus.Accepted);
                        return;
                    }
                    if (status === 'rejected') {
                        const feedback = await api.request({
                            method: 'GET',
                            path: path + '/feedback',
                        });
                        const documents = await this.getDocuments(submission);
                        const issues =
                            feedback.status === 200
                                ? this.mapIssues(feedback.json, submission, documents)
                                : [];
                        await this.finish(submission, BelcotaxSubmissionStatus.Rejected, {
                            issues,
                            errorMessage: issues.length
                                ? null
                                : $t('Belcotax gaf geen details over de fouten.'),
                        });
                        return;
                    }
                    await submission.save();
                },
                { userId: submission.userId },
            );
        } catch (e) {
            if (isSimpleError(e) && e.code === 'belcotax_connection_expired') {
                await this.finish(submission, BelcotaxSubmissionStatus.Unknown, {
                    errorMessage:
                        e.getHuman() +
                        ' ' +
                        $t('Daardoor kan het resultaat van Belcotax niet meer opgevraagd worden.'),
                });
                return;
            }
            // FOD unreachable: the next poll tries again
            console.error('Polling Belcotax submission ' + submission.id + ' failed', e);
        }
    }

    /**
     * Runs in this process: on a restart the cron continues
     */
    static followUp(submissionId: string) {
        const delays = [...this.followUpDelays];
        (async () => {
            for (const delay of delays) {
                await sleep(delay);
                const submission = await BelcotaxSubmission.getByID(submissionId);
                if (submission?.status !== BelcotaxSubmissionStatus.Validating) {
                    return;
                }
                await this.poll(submission);
            }
        })().catch((e) => {
            console.error('Following up Belcotax submission ' + submissionId + ' failed', e);
        });
    }

    /**
     * Called by the cron. Only polls submissions an administrator started, for at most 24 hours.
     */
    static async pollOpenSubmissions() {
        if (!BelcotaxConfig.isConfigured) {
            return;
        }

        const validating = await BelcotaxSubmission.select()
            .where('status', BelcotaxSubmissionStatus.Validating)
            .andWhere(
                SQL.where('lastPolledAt', null)
                    .or('lastPolledAt', '<', new Date(Date.now() - cronPollInterval))
                    .or('createdAt', '<', new Date(Date.now() - maximumValidationTime)),
            )
            .fetch();
        for (const submission of validating) {
            await this.poll(submission);
        }

        const interrupted = await BelcotaxSubmission.select()
            .where('status', BelcotaxSubmissionStatus.Sending)
            .andWhere('createdAt', '<', new Date(Date.now() - maximumSendingTime))
            .fetch();
        for (const submission of interrupted) {
            await this.finish(submission, BelcotaxSubmissionStatus.Failed, {
                errorMessage: $t(
                    'Het versturen werd onderbroken. Stuur gerust opnieuw: Belcotax overschrijft wat het al heeft.',
                ),
            });
        }
    }

    private static async prepare(template: DocumentTemplate, organization: Organization) {
        const build = await JsonlExportService.build(template, organization);
        const companyNumber = getBelcotaxCompanyNumber({
            companyNumber: build.organiser.companyNumber,
        });
        if (!companyNumber) {
            throw new SimpleError({
                code: 'belcotax_missing_company_number',
                message: 'The organiser has no valid KBO number',
                human: $t('Het ondernemingsnummer van de organisator is ongeldig.'),
            });
        }
        return { build, companyNumber, changes: this.getChanges(build) };
    }

    /**
     * Strictest case: Belcotax refuses a whole file for one error, so everything it did not accept goes again
     */
    private static getChanges(build: JsonlExportBuild): Changes {
        const documents = new Map(build.documents.map((d) => [d.id, d]));
        const changes: Changes = { fiches: [], deletions: [], unchangedCount: 0 };

        for (const fiche of build.result.fiches) {
            const accepted = documents.get(fiche.documentId)?.belcotaxHash ?? null;
            if (accepted === fiche.hash) {
                changes.unchangedCount += 1;
                continue;
            }
            changes.fiches.push({ fiche, isNew: accepted === null });
        }

        for (const deletion of build.result.deletions) {
            const accepted = documents.get(deletion.documentId)?.belcotaxHash ?? null;
            // Also when we never sent it: the fiche may have been uploaded with the download, and Belcotax accepts
            // the deletion of a key it doesn't know
            if (accepted !== deletion.hash) {
                changes.deletions.push(deletion);
            }
        }
        return changes;
    }

    static async getOpenSubmission(templateId: string, companyNumber: string) {
        return await BelcotaxSubmission.select()
            .where('status', [
                BelcotaxSubmissionStatus.Sending,
                BelcotaxSubmissionStatus.Validating,
            ])
            .andWhere(SQL.where('templateId', templateId).or('companyNumber', companyNumber))
            .first(false);
    }

    private static getDocumentIds(submission: BelcotaxSubmission) {
        return submission.content.documents.map((d) => d.documentId);
    }

    private static async getDocuments(submission: BelcotaxSubmission) {
        const ids = this.getDocumentIds(submission);
        return ids.length ? await Document.select().where('id', ids).fetch() : [];
    }

    private static mapIssues(
        json: unknown,
        submission: BelcotaxSubmission,
        documents: Document[],
    ): BelcotaxSubmissionIssue[] {
        const ids = new Set(this.getDocumentIds(submission));
        return mapBelcotaxFeedbackIssues(json, {
            lineKeys: submission.content.lineKeys,
            descriptions: new Map(
                documents.filter((d) => ids.has(d.id)).map((d) => [d.id, describe(d)]),
            ),
        });
    }

    private static async finish(
        submission: BelcotaxSubmission,
        status: BelcotaxSubmissionStatus,
        result: { issues?: BelcotaxSubmissionIssue[]; errorMessage?: string | null } = {},
    ) {
        submission.status = status;
        submission.issues = result.issues ?? [];
        submission.errorMessage = result.errorMessage ?? null;
        submission.finishedAt = new Date();
        await submission.save();

        await this.updateDocuments(submission);
        await this.notify(submission);
    }

    private static async updateDocuments(submission: BelcotaxSubmission) {
        const ids = this.getDocumentIds(submission);
        if (!ids.length) {
            return;
        }

        switch (submission.status) {
            case BelcotaxSubmissionStatus.Accepted:
                for (const document of submission.content.documents) {
                    await Document.update()
                        .set('belcotaxStatus', BelcotaxDocumentStatus.Accepted)
                        .set('belcotaxHash', document.hash)
                        .where('id', document.documentId)
                        .update();
                }
                return;
            case BelcotaxSubmissionStatus.Rejected:
                await Document.update()
                    .set('belcotaxStatus', BelcotaxDocumentStatus.Rejected)
                    .where('id', ids)
                    .update();
                return;
            case BelcotaxSubmissionStatus.Unknown:
                // Back to what we know: the version Belcotax accepted earlier, if any
                await Document.update()
                    .set('belcotaxStatus', BelcotaxDocumentStatus.Accepted)
                    .where('id', ids)
                    .andWhere('belcotaxHash', '!=', null)
                    .update();
                await Document.update()
                    .set('belcotaxStatus', null)
                    .where('id', ids)
                    .andWhere('belcotaxHash', null)
                    .update();
                return;
        }
    }

    /**
     * The administrator may have closed the sheet, so the result also goes by email. The team hears of every
     * rejection: most come from our mapping.
     */
    private static async notify(submission: BelcotaxSubmission) {
        const organization = await Organization.getByID(submission.organizationId);
        const template = await DocumentTemplate.getByID(submission.templateId);
        if (!organization || !template) {
            return;
        }

        if (submission.status !== BelcotaxSubmissionStatus.Accepted) {
            await WebmasterReport.group(
                `Belcotax-zending ${organization.name} (${template.year}): ${submission.status}`,
                async () => {
                    if (submission.errorMessage) {
                        WebmasterReport.report(submission.errorMessage, {
                            organizationId: organization.id,
                            templateId: template.id,
                            submissionId: submission.id,
                            bulkId: submission.bulkId,
                        });
                    }
                    for (const issue of submission.issues) {
                        WebmasterReport.report(issue.message, {
                            organizationId: organization.id,
                            templateId: template.id,
                            submissionId: submission.id,
                            bulkId: submission.bulkId,
                            documentId: issue.documentId,
                            key: issue.key,
                            line: issue.line,
                            code: issue.code,
                        });
                    }
                },
            );
        }

        // A failed submission is shown right away to the administrator who is waiting for it
        if (submission.status === BelcotaxSubmissionStatus.Failed || !submission.userId) {
            return;
        }
        const user = await UserModel.getByID(submission.userId);
        if (!user) {
            return;
        }

        const types: Partial<Record<BelcotaxSubmissionStatus, EmailTemplateType>> = {
            [BelcotaxSubmissionStatus.Accepted]: EmailTemplateType.BelcotaxSubmissionAccepted,
            [BelcotaxSubmissionStatus.Rejected]: EmailTemplateType.BelcotaxSubmissionRejected,
            [BelcotaxSubmissionStatus.Unknown]: EmailTemplateType.BelcotaxSubmissionUnknown,
        };
        const type = types[submission.status];
        if (!type) {
            return;
        }

        await sendEmailTemplate(null, {
            template: { type },
            recipients: [user.createRecipient()],
            defaultReplacements: this.getEmailReplacements(submission, organization, template),
            type: 'transactional',
        });
    }

    static getEmailReplacements(
        submission: BelcotaxSubmission,
        organization: Organization,
        template: DocumentTemplate,
    ) {
        return [
            Replacement.create({ token: 'organizationName', value: organization.name }),
            Replacement.create({
                token: 'platformName',
                value: Formatter.capitalizeFirstLetter(STAMHOOFD.platformName ?? 'Stamhoofd'),
            }),
            Replacement.create({
                token: 'documentTemplateName',
                value: template.settings.name,
            }),
            Replacement.create({
                token: 'submissionDate',
                value: Formatter.dateTime(submission.createdAt),
            }),
            Replacement.create({
                token: 'documentCount',
                value: (submission.ficheCount + submission.deletedCount).toString(),
            }),
            Replacement.create({
                token: 'issueCount',
                value: submission.issues.length.toString(),
            }),
            Replacement.create({
                token: 'unknownReason',
                value: submission.errorMessage ?? '',
            }),
            Replacement.create({
                token: 'submissionUrl',
                value:
                    'https://' +
                    organization.getDashboardHost() +
                    '/documenten/' +
                    template.id +
                    '?belcotax_submission=' +
                    submission.id,
            }),
        ];
    }
}
