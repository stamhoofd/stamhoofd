import { SimpleError } from '@simonbackx/simple-errors';
import { Document, DocumentTemplateFactory, Organization } from '@stamhoofd/models';
import { Address, DocumentData, DocumentStatus, File, Image, OrganizationMetaData, PlatformConfig, Platform as PlatformStruct, RecordSettings, RecordTextAnswer, RecordType } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { DocumentRenderService } from './DocumentRenderService.js';

function createImage(id: string) {
    return Image.create({
        id,
        source: new File({
            id,
            server: 'https://files.example.com',
            path: id + '.png',
            size: 100,
        }),
    });
}

/**
 * An organization that is not saved in the database: enough to build a context with.
 */
function createOrganization(meta?: Partial<{ horizontalLogo: Image | null; squareLogo: Image | null }>) {
    const organization = new Organization();
    organization.name = 'Test organization';
    organization.meta = OrganizationMetaData.create({
        horizontalLogo: meta?.horizontalLogo ?? null,
        squareLogo: meta?.squareLogo ?? null,
    });
    organization.address = Address.create({
        street: 'Demostraat',
        number: '12',
        city: 'Gent',
        postalCode: '9000',
        country: Country.Belgium,
    });
    return organization;
}

function createDocument() {
    const document = new Document();
    document.data = DocumentData.create({ name: 'Test document' });
    return document;
}

function createPlatform(config: Partial<{ logoDocuments: Image | null; horizontalLogo: Image | null; squareLogo: Image | null }>) {
    return PlatformStruct.create({
        config: PlatformConfig.create({
            logoDocuments: config.logoDocuments ?? null,
            horizontalLogo: config.horizontalLogo ?? null,
            squareLogo: config.squareLogo ?? null,
        }),
    });
}

/**
 * An answer that cannot be mapped onto the context object, so building the context throws.
 */
function createInvalidFieldAnswers() {
    return new Map([
        ['', RecordTextAnswer.create({
            settings: RecordSettings.create({ id: '', type: RecordType.Text }),
            value: 'Some value',
        })],
    ]);
}

const xmlExport = '<documents>{{#each documents}}<document>{{{this.number}}}</document>{{/each}}</documents>';

/**
 * Builds a locked template: a locked template makes buildAll return the documents unchanged, so the
 * numbers set up here are exactly what the renumbering logic gets to see.
 */
async function createTemplateWithDocuments(numbers: number[], options?: { xmlExport?: string | null; lockDocuments?: boolean }) {
    const template = await new DocumentTemplateFactory({
        groups: [],
        status: DocumentStatus.Published,
    }).createWithoutSave();

    template.privateSettings.templateDefinition.xmlExport = options?.xmlExport === undefined ? xmlExport : options.xmlExport;
    await template.save();

    const documents: Document[] = [];
    for (const number of numbers) {
        const document = new Document();
        document.organizationId = template.organizationId;
        document.templateId = template.id;
        document.status = DocumentStatus.Published;
        document.number = number;
        document.data = DocumentData.create({ name: 'Test document' });
        await document.save();

        if (options?.lockDocuments) {
            document.isLocked = true;
            await document.save({ forceSave: true });
        }
        documents.push(document);
    }

    // Lock last: a locked template can no longer be saved normally
    template.isLocked = true;
    await template.save({ forceSave: true });

    const organization = (await Organization.getByID(template.organizationId))!;
    return { template, organization, documents };
}

describe('DocumentRenderService', () => {
    describe('buildDocumentContext', () => {
        test('The platform logo falls back from logoDocuments to horizontalLogo to squareLogo', () => {
            const logoDocuments = createImage('logo-documents');
            const horizontalLogo = createImage('horizontal-logo');
            const squareLogo = createImage('square-logo');

            const organization = createOrganization();
            const document = createDocument();

            const all = DocumentRenderService.buildDocumentContext(document, organization, createPlatform({ logoDocuments, horizontalLogo, squareLogo }));
            expect(all['platform'].logo.id).toBe(logoDocuments.id);
            expect(all['logo'].id).toBe(logoDocuments.id);

            const withoutDocumentsLogo = DocumentRenderService.buildDocumentContext(document, organization, createPlatform({ horizontalLogo, squareLogo }));
            expect(withoutDocumentsLogo['platform'].logo.id).toBe(horizontalLogo.id);
            expect(withoutDocumentsLogo['logo'].id).toBe(horizontalLogo.id);

            const onlySquareLogo = DocumentRenderService.buildDocumentContext(document, organization, createPlatform({ squareLogo }));
            expect(onlySquareLogo['platform'].logo.id).toBe(squareLogo.id);
            expect(onlySquareLogo['logo'].id).toBe(squareLogo.id);
        });

        test('No logo is added to the context when the platform and the organization have none', () => {
            const context = DocumentRenderService.buildDocumentContext(createDocument(), createOrganization(), createPlatform({}));

            expect(context['platform']).toBeUndefined();
            expect(context['logo']).toBeUndefined();
            expect(context['organization'].logo).toBeUndefined();
        });

        test('The organization logo takes precedence over the platform logo', () => {
            const platformLogo = createImage('logo-documents');
            const organizationLogo = createImage('organization-horizontal-logo');

            const organization = createOrganization({ horizontalLogo: organizationLogo });
            const context = DocumentRenderService.buildDocumentContext(createDocument(), organization, createPlatform({ logoDocuments: platformLogo }));

            expect(context['logo'].id).toBe(organizationLogo.id);
            expect(context['organization'].logo.id).toBe(organizationLogo.id);

            // The platform logo remains available separately
            expect(context['platform'].logo.id).toBe(platformLogo.id);
        });
    });

    describe('getRenderedHtml', () => {
        test('It returns null and logs when building the context fails', async () => {
            const template = await new DocumentTemplateFactory({ groups: [] }).create();

            const document = createDocument();
            document.templateId = template.id;
            document.organizationId = template.organizationId;
            document.data.fieldAnswers = createInvalidFieldAnswers();

            const consoleError = vitest.spyOn(console, 'error').mockImplementation(() => {});

            try {
                await expect(DocumentRenderService.getRenderedHtml(document, createOrganization())).resolves.toBeNull();
                expect(consoleError).toHaveBeenCalledWith('Failed to render document html', expect.any(Error));
            } finally {
                consoleError.mockRestore();
            }
        });

        test('It returns null when the template no longer exists', async () => {
            const document = createDocument();
            document.templateId = '00000000-0000-4000-8000-000000000000';

            await expect(DocumentRenderService.getRenderedHtml(document, createOrganization())).resolves.toBeNull();
        });
    });

    describe('getRenderedXml', () => {
        test('It renumbers the published documents to be strictly increasing and saves them', async () => {
            const { template, organization, documents } = await createTemplateWithDocuments([1, 3, 7]);

            const xml = await DocumentRenderService.getRenderedXml(template, organization);

            expect(xml).toBe('<documents><document>1</document><document>2</document><document>3</document></documents>');

            // The gaps are closed in the database too
            for (const [index, document] of documents.entries()) {
                const reloaded = await Document.getByID(document.id);
                expect(reloaded!.number).toBe(index + 1);
            }
        });

        test('It rethrows a SimpleError instead of swallowing it', async () => {
            // A locked document cannot be renumbered: saving it throws a SimpleError
            const { template, organization } = await createTemplateWithDocuments([2], { lockDocuments: true });

            const error = await DocumentRenderService.getRenderedXml(template, organization).then(() => null, (e: unknown) => e);

            expect(error).toBeInstanceOf(SimpleError);
            expect((error as SimpleError).code).toBe('locked');
        });

        test('It returns null and logs for any other error', async () => {
            const { template, organization } = await createTemplateWithDocuments([1]);

            template.settings.fieldAnswers = createInvalidFieldAnswers();

            const consoleError = vitest.spyOn(console, 'error').mockImplementation(() => {});

            try {
                await expect(DocumentRenderService.getRenderedXml(template, organization)).resolves.toBeNull();
                expect(consoleError).toHaveBeenCalledWith('Failed to render document html', expect.any(Error));
            } finally {
                consoleError.mockRestore();
            }
        });

        test('It returns null without building anything when the template has no xml export', async () => {
            const { template, organization, documents } = await createTemplateWithDocuments([2], { xmlExport: null });

            await expect(DocumentRenderService.getRenderedXml(template, organization)).resolves.toBeNull();

            // No renumbering happened
            expect((await Document.getByID(documents[0]!.id))!.number).toBe(2);
        });
    });
});
