import { SimpleError } from '@common/errors';
import type { DocumentTemplate, Organization } from '@stamhoofd/models';
import { Document, Platform } from '@stamhoofd/models';
import type { RecordAnswer } from '@stamhoofd/structures';
import {
    JsonlExportDocument,
    JsonlExportIssue,
    JsonlExportResult,
    DocumentStatus,
    RecordAddressAnswer,
    RecordTextAnswer,
} from '@stamhoofd/structures';

import { WebmasterReport } from '../../helpers/WebmasterReport.js';
import { DocumentRenderService } from '../DocumentRenderService.js';
import type {
    BelcotaxContact,
    BelcotaxIssue,
    BelcotaxExport,
    BelcotaxOrganiser,
    FiscalDocumentContext,
} from './BelcotaxJsonlService.js';
import { BelcotaxJsonlService } from './BelcotaxJsonlService.js';

/**
 * Undefined when the template has no answer for this id, null when the answer is empty.
 */
function text(answers: Map<string, RecordAnswer>, id: string): string | null | undefined {
    const answer = answers.get(id);
    if (!(answer instanceof RecordTextAnswer)) {
        return undefined;
    }
    return answer.value?.trim() || null;
}

export function describe(document: Document): string {
    return document.data.description || document.data.name;
}

export type JsonlExportBuild = {
    organiser: BelcotaxOrganiser;
    result: BelcotaxExport;
    issues: JsonlExportIssue[];
    incompleteDocuments: JsonlExportDocument[];
    /**
     * Every document of the template, with the answers of the template applied
     */
    documents: Document[];
};

/**
 * Collects the published documents of a fiscal template and turns them into a Belcotax JSON-lines file.
 */
export class JsonlExportService {
    static assertSupported(template: DocumentTemplate) {
        if (
            template.privateSettings.templateDefinition.type !== 'fiscal' ||
            !BelcotaxJsonlService.isSupportedYear(template.year)
        ) {
            throw new SimpleError({
                code: 'jsonl_export_not_supported',
                message:
                    'The Belcotax export is only available for fiscal documents from income year 2026 onwards',
                human: $t(
                    'Dit bestand voor Belcotax is enkel beschikbaar voor fiscale attesten vanaf inkomstenjaar 2026.',
                ),
            });
        }

        if (template.updatesEnabled) {
            throw new SimpleError({
                code: 'updates_enabled',
                message: 'Disable automatic updates before exporting to Belcotax',
                human: $t('%1Kr'),
            });
        }
    }

    static async export(
        template: DocumentTemplate,
        organization: Organization,
    ): Promise<JsonlExportResult> {
        const build = await this.build(template, organization);
        await this.reportIssues(template, organization, build.result.issues);

        return JsonlExportResult.create({
            jsonl: build.result.jsonl,
            documentCount: build.result.includedDocumentIds.length,
            deletedCount: build.result.deletions.length,
            issues: build.issues,
            incompleteDocuments: build.incompleteDocuments,
        });
    }

    static async build(
        template: DocumentTemplate,
        organization: Organization,
    ): Promise<JsonlExportBuild> {
        const organiser = this.getOrganiser(template, organization);
        if (!organiser.companyNumber) {
            // Not an issue in the result: it is not a mapping error for the webmaster, and no change to the documents can solve it
            throw new SimpleError({
                code: 'jsonl_export_requires_company_number',
                message: 'The Belcotax export requires an organiser with a company number',
                human: $t(
                    'Het bestand voor Belcotax werkt enkel voor een organisator met een ondernemingsnummer. Heeft je vereniging een ondernemingsnummer? Vul het dan in bij de facturatiegegevens. Als feitelijke vereniging zonder ondernemingsnummer geef je de fiscale attesten rechtstreeks in op Belcotax-on-web.',
                ),
            });
        }

        // Updates the organiser and certification answers of the documents to the current template settings
        await template.buildAll();

        const documents = await Document.where({ templateId: template.id });
        const published = documents.filter((d) => d.status === DocumentStatus.Published);
        const deletedDocumentIds = documents
            .filter((d) => d.status === DocumentStatus.Deleted)
            .map((d) => d.id);

        const platform = await Platform.getSharedStruct();
        const result = BelcotaxJsonlService.build({
            year: template.year,
            templateId: template.id,
            organiser,
            contact: this.getContact(template),
            documents: published.map((document) => ({
                id: document.id,
                context: DocumentRenderService.buildDocumentContext(
                    document,
                    organization,
                    platform,
                ) as FiscalDocumentContext,
            })),
            deletedDocumentIds,
        });

        // The name is the same for every document of the template, the description names the child and activity
        const descriptions = new Map(published.map((d) => [d.id, describe(d)]));
        const issues = result.issues.map((issue) =>
            JsonlExportIssue.create({
                documentId: issue.documentId,
                documentDescription: issue.documentId
                    ? (descriptions.get(issue.documentId) ?? null)
                    : null,
                message: issue.message,
            }),
        );
        const incompleteDocuments = documents
            .filter((d) => d.status === DocumentStatus.MissingData)
            .map((d) => JsonlExportDocument.create({ id: d.id, description: describe(d) }));

        return { organiser, result, issues, incompleteDocuments, documents };
    }

    /**
     * Only the issues that point at our mapping: the organization fixes the others itself in the check before the
     * download, and would get a mail on every retry. The description names a child, so it stays out of the mail.
     */
    static async reportIssues(
        template: DocumentTemplate,
        organization: Organization,
        issues: BelcotaxIssue[],
    ) {
        const mappingIssues = issues.filter((issue) => issue.isMappingError);
        if (!mappingIssues.length) {
            return;
        }
        await WebmasterReport.group(
            `Belcotax-export ${organization.name} (${template.year})`,
            async () => {
                for (const issue of mappingIssues) {
                    WebmasterReport.report(issue.message, {
                        organizationId: organization.id,
                        templateId: template.id,
                        documentId: issue.documentId,
                    });
                }
            },
        );
    }

    /**
     * Same source as the PDF: the organization answers saved on the template, with the first company as fallback
     * for templates that were not saved since an answer was added. An empty company number also falls back, so a
     * company number added to the billing details later on is used without saving the template again.
     */
    private static getOrganiser(
        template: DocumentTemplate,
        organization: Organization,
    ): BelcotaxOrganiser {
        const answers = template.settings.fieldAnswers;
        const company = organization.meta.companies[0] ?? null;
        const addressAnswer = answers.get('organization.companyAddress');

        return {
            id: company?.id ?? organization.id,
            name: text(answers, 'organization.companyName') ?? company?.name ?? organization.name,
            companyNumber:
                text(answers, 'organization.companyNumber') ??
                (company?.companyNumber?.trim() || null),
            address:
                addressAnswer instanceof RecordAddressAnswer
                    ? addressAnswer.address
                    : (company?.address ?? organization.address),
        };
    }

    private static getContact(template: DocumentTemplate): BelcotaxContact {
        const answers = template.settings.fieldAnswers;
        return {
            name: text(answers, 'organization.contactName') ?? '',
            phone: text(answers, 'organization.phone') ?? null,
            email: text(answers, 'organization.email') ?? '',
        };
    }
}
