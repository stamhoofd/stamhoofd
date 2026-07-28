import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import type { Document, Organization } from '@stamhoofd/models';
import { DocumentTemplate, Platform } from '@stamhoofd/models';
import { render } from '@stamhoofd/models/helpers/Handlebars.js';
import type { Platform as PlatformStruct } from '@stamhoofd/structures';
import { DocumentStatus, Version } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

/**
 * Owns rendering documents and document templates into HTML/XML.
 *
 * Turning a row into a handlebars context and rendering that context is not data access: the context
 * mixes in the platform (for the fallback logo and, for an XML export, the document numbering), and
 * models have no request context to resolve the platform they belong to. So both context building and
 * the render calls live here instead of on Document/DocumentTemplate.
 *
 * Document and DocumentTemplate keep the rows themselves, including DocumentTemplate.buildAll which
 * is a document lifecycle operation and has its own callers.
 */
export class DocumentRenderService {
    /**
     * Build the handlebars context of a single document.
     */
    static buildDocumentContext(document: Document, organization: Organization, platform: PlatformStruct) {
        // Convert the field answers in a simplified javascript object
        const data: Record<string, any> = {
            id: document.id,
            name: document.data.name,
            number: document.number,
            created_at: document.createdAt,
            organization: {
                name: organization.name,
                companyName: organization.meta.companies[0]?.name || organization.name,
                companyNumber: organization.meta.companies[0]?.companyNumber || null,
                address: organization.address,
                companyAddress: organization.meta.companies[0]?.address ?? organization.address,
            },
        };
        const platformLogo = platform.config.logoDocuments ?? platform.config.horizontalLogo ?? platform.config.squareLogo;
        const organizationLogo = organization.meta.horizontalLogo ?? organization.meta.squareLogo;
        const logo = organizationLogo || platformLogo;

        if (organizationLogo) {
            data['organization'] = {
                ...data['organization'],
                logo: organizationLogo.encode({ version: Version }) ?? null,
            };
        }

        if (platformLogo) {
            data['platform'] = {
                logo: platformLogo.encode({ version: Version }) ?? null,
            };
        }

        if (logo) {
            data['logo'] = logo.encode({ version: Version }) ?? null;
        }

        for (const field of document.data.fieldAnswers.values()) {
            const keys = field.settings.id.split('.');
            let current = data;
            const lastKey = keys.pop()!;
            if (!lastKey) {
                throw new Error('Invalid field id');
            }
            for (const key of keys) {
                if (!current[key]) {
                    current[key] = {};
                }
                current = current[key];

                if (typeof current !== 'object') {
                    throw new Error('Invalid field type');
                }
            }
            current[lastKey] = field.objectValue;
        }
        return data;
    }

    /**
     * Build the handlebars context of a whole template.
     *
     * Note that this writes: an XML export is the moment the numbering becomes final, so any gaps
     * left by deleted documents are closed and the new numbers are saved.
     */
    private static async buildTemplateContext(template: DocumentTemplate, organization: Organization) {
        // Convert the field answers in a simplified javascript object
        const documents = (await template.buildAll({ generateNumbers: true })).filter(d => d.status === DocumentStatus.Published && !!d.number).sort((a, b) => Sorter.byNumberValue(b.number ?? 0, a.number ?? 0));

        // Check numbers are strictly increasing
        let lastNumber = 0;
        for (const document of documents) {
            if (document.number !== lastNumber + 1) {
                document.number = lastNumber + 1;
                await document.save();
            }
            lastNumber = document.number;
        }

        const platform = await Platform.getSharedStruct();

        const data: Record<string, any> = {
            id: template.id,
            created_at: template.createdAt,
            documents: documents.map(d => this.buildDocumentContext(d, organization, platform)),
            organization: {
                name: organization.name,
                companyName: organization.meta.companies[0]?.name || organization.name,
                companyNumber: organization.meta.companies[0]?.companyNumber || null,
                address: organization.address,
                companyAddress: organization.meta.companies[0]?.address ?? organization.address,
            },
        };

        for (const field of template.settings.fieldAnswers.values()) {
            const keys = field.settings.id.split('.');
            let current = data;
            const lastKey = keys.pop()!;
            if (!lastKey) {
                throw new Error('Invalid field id');
            }
            for (const key of keys) {
                if (!current[key]) {
                    current[key] = {};
                }
                current = current[key];

                if (typeof current !== 'object') {
                    throw new Error('Invalid field type');
                }
            }
            current[lastKey] = field.objectValue;
        }

        return data;
    }

    /**
     * Render a document with the html of the template it belongs to.
     */
    static async getRenderedHtml(document: Document, organization: Organization): Promise<string | null> {
        const template = await DocumentTemplate.getByID(document.templateId);
        if (!template) {
            return null;
        }

        return await this.getRenderedHtmlForTemplate(document, organization, template.html);
    }

    private static async getRenderedHtmlForTemplate(document: Document, organization: Organization, htmlTemplate: string): Promise<string | null> {
        try {
            const platform = await Platform.getSharedStruct();
            const context = this.buildDocumentContext(document, organization, platform);
            const renderedHtml = await render(htmlTemplate, context);
            return renderedHtml;
        } catch (e) {
            console.error('Failed to render document html', e);
            return null;
        }
    }

    /**
     * Render the XML export of a template, containing all its published documents.
     *
     * Unlike getRenderedHtml this rethrows SimpleErrors: building the context finalises the document
     * numbering, and a failure there (a locked document for example) has to reach the user instead of
     * silently turning into a missing export.
     */
    static async getRenderedXml(template: DocumentTemplate, organization: Organization): Promise<string | null> {
        if (!template.privateSettings.templateDefinition.xmlExport) {
            return null;
        }

        try {
            const context = await this.buildTemplateContext(template, organization);
            const renderedHtml = await render(template.privateSettings.templateDefinition.xmlExport, context);
            return renderedHtml;
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                throw e;
            }
            console.error('Failed to render document html', e);
            return null;
        }
    }
}
