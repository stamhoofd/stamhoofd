import { Address, DocumentData, File, Image, OrganizationMetaData, PlatformConfig, Platform as PlatformStruct } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Document } from './Document.js';
import { Organization } from './Organization.js';

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

describe('Model.Document', () => {
    describe('buildContext', () => {
        test('The platform logo falls back from logoDocuments to horizontalLogo to squareLogo', () => {
            const logoDocuments = createImage('logo-documents');
            const horizontalLogo = createImage('horizontal-logo');
            const squareLogo = createImage('square-logo');

            const organization = createOrganization();
            const document = createDocument();

            const all = document.buildContext(organization, createPlatform({ logoDocuments, horizontalLogo, squareLogo }));
            expect(all['platform'].logo.id).toBe(logoDocuments.id);
            expect(all['logo'].id).toBe(logoDocuments.id);

            const withoutDocumentsLogo = document.buildContext(organization, createPlatform({ horizontalLogo, squareLogo }));
            expect(withoutDocumentsLogo['platform'].logo.id).toBe(horizontalLogo.id);
            expect(withoutDocumentsLogo['logo'].id).toBe(horizontalLogo.id);

            const onlySquareLogo = document.buildContext(organization, createPlatform({ squareLogo }));
            expect(onlySquareLogo['platform'].logo.id).toBe(squareLogo.id);
            expect(onlySquareLogo['logo'].id).toBe(squareLogo.id);
        });

        test('No logo is added to the context when the platform and the organization have none', () => {
            const context = createDocument().buildContext(createOrganization(), createPlatform({}));

            expect(context['platform']).toBeUndefined();
            expect(context['logo']).toBeUndefined();
            expect(context['organization'].logo).toBeUndefined();
        });

        test('The organization logo takes precedence over the platform logo', () => {
            const platformLogo = createImage('logo-documents');
            const organizationLogo = createImage('organization-horizontal-logo');

            const organization = createOrganization({ horizontalLogo: organizationLogo });
            const context = createDocument().buildContext(organization, createPlatform({ logoDocuments: platformLogo }));

            expect(context['logo'].id).toBe(organizationLogo.id);
            expect(context['organization'].logo.id).toBe(organizationLogo.id);

            // The platform logo remains available separately
            expect(context['platform'].logo.id).toBe(platformLogo.id);
        });
    });
});
