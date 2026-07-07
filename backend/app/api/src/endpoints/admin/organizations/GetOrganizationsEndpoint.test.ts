import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Token } from '@stamhoofd/models';
import { DocumentTemplateFactory, OrganizationFactory, STPackageFactory, UserFactory } from '@stamhoofd/models';
import { DocumentStatus, LimitedFilteredRequest, OrganizationMetaData, OrganizationRecordsConfiguration, OrganizationType, PermissionLevel, Permissions, RecordCategory, RecordSettings, RecordType, STPackageBundle, type StamhoofdFilter, TranslatedString, UmbrellaOrganization } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initPlatformAdmin } from '../../../../tests/init/index.js';
import { initMembershipOrganization } from '../../../../tests/init/initMembershipOrganization.js';
import { GetOrganizationsEndpoint } from './GetOrganizationsEndpoint.js';

const baseUrl = `/admin/organizations`;
const endpoint = new GetOrganizationsEndpoint();

describe('Endpoint.GetOrganizationsEndpoint', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    beforeAll(async () => {
        await initMembershipOrganization();
    });

    const search = async (searchTerm: string, token: Token): Promise<string[]> => {
        const request = Request.get({
            path: baseUrl,
            // Platform admins are not scoped to an organization, so no host is required
            host: '',
            query: new LimitedFilteredRequest({
                search: searchTerm,
                limit: 100,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        const response = await testServer.test(endpoint, request);
        return response.body.results.map(o => o.id);
    };

    const filter = async (filter: StamhoofdFilter, token: Token): Promise<string[]> => {
        const request = Request.get({
            path: baseUrl,
            host: '',
            query: new LimitedFilteredRequest({
                filter,
                limit: 100,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        const response = await testServer.test(endpoint, request);
        return response.body.results.map(o => o.id);
    };

    // Creates an admin (user with permissions) for the given organization
    const createAdmin = async (organization: Organization, data: { firstName?: string; lastName?: string; email?: string }) => {
        return await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
            ...data,
        }).create();
    };

    test('Searches organizations by name', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ name: 'Bombilcious Tennis Club' }).create();

        expect(await search('Bombilcious Tennis Club', adminToken)).toContain(organization.id);
    });

    test('Searches organizations by uri', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ }).create();

        expect(await search(organization.uri, adminToken)).toContain(organization.id);
    });

    test('Does not search organizations by admin name', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ name: 'Halfnamed Club' }).create();
        await createAdmin(organization, { firstName: 'Zwervinkel' });

        expect(await search('Zwervinkel', adminToken)).not.toContain(organization.id);
    });

    test('Does not match users without permissions (non-admins)', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ name: 'Memberonly Club' }).create();

        // A regular user (no permissions) linked to the organization
        await new UserFactory({ organization, firstName: 'Solitary', lastName: 'Pangolin' }).create();

        expect(await search('Solitary Pangolin', adminToken)).not.toContain(organization.id);
    });

    test('Searches admins by email', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ name: 'Mailable Club' }).create();
        await createAdmin(organization, { email: 'findme@admin-search-test.com' });

        expect(await search('findme@admin-search-test.com', adminToken)).toContain(organization.id);
    });

    test('Does search the organization name when the search contains an @', async () => {
        const { adminToken } = await initPlatformAdmin();
        // The organization name itself contains an @, but there is no admin with a matching email
        const organization = await new OrganizationFactory({ name: 'weird@orgname-test.com' }).create();

        expect(await search('weird@orgname-test.com', adminToken)).toContain(organization.id);
    });

    test('Does not match admins of other organizations by email', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ name: 'Owner Club' }).create();
        const otherOrganization = await new OrganizationFactory({ name: 'Bystander Club' }).create();
        await createAdmin(organization, { email: 'unique-owner@admin-search-test.com' });

        const results = await search('unique-owner@admin-search-test.com', adminToken);
        expect(results).toContain(organization.id);
        expect(results).not.toContain(otherOrganization.id);
    });

    test('Filters organizations by active package type', async () => {
        const { adminToken } = await initPlatformAdmin();

        const membersOrg = await new OrganizationFactory({ name: 'Packaged Members Club' }).create();
        await new STPackageFactory({ organization: membersOrg, bundle: STPackageBundle.Members }).create();

        const webshopsOrg = await new OrganizationFactory({ name: 'Packaged Webshops Club' }).create();
        await new STPackageFactory({ organization: webshopsOrg, bundle: STPackageBundle.Webshops }).create();

        const results = await filter({
            packages: {
                $elemMatch: {
                    type: {
                        $in: ['Members'],
                    },
                },
            },
        }, adminToken);

        expect(results).toContain(membersOrg.id);
        expect(results).not.toContain(webshopsOrg.id);
    });

    test('Does not match organizations whose package is no longer valid', async () => {
        const { adminToken } = await initPlatformAdmin();

        const expiredOrg = await new OrganizationFactory({ name: 'Expired Members Club' }).create();
        // removeAt in the past => package is no longer active
        await new STPackageFactory({
            organization: expiredOrg,
            bundle: STPackageBundle.Members,
            removeAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        }).create();

        const results = await filter({
            packages: {
                $elemMatch: {
                    type: {
                        $in: ['Members'],
                    },
                },
            },
        }, adminToken);

        expect(results).not.toContain(expiredOrg.id);
    });

    // Creates an organization with a specific type and/or umbrella organization
    const createOrganizationWithMeta = async (name: string, metaPatch: { type?: OrganizationType; umbrellaOrganization?: UmbrellaOrganization | null }) => {
        const meta = OrganizationMetaData.create({
            type: metaPatch.type ?? OrganizationType.Other,
            umbrellaOrganization: metaPatch.umbrellaOrganization ?? null,
            defaultEndDate: new Date(),
            defaultStartDate: new Date(),
            defaultPrices: [],
        });
        return await new OrganizationFactory({ name, meta }).create();
    };

    test('Filters organizations by type', async () => {
        const { adminToken } = await initPlatformAdmin();
        const youthOrg = await createOrganizationWithMeta('Youthful Club', { type: OrganizationType.Youth });
        const sportOrg = await createOrganizationWithMeta('Sporty Club', { type: OrganizationType.Sport });

        const results = await filter({ type: { $in: [OrganizationType.Youth] } }, adminToken);
        expect(results).toContain(youthOrg.id);
        expect(results).not.toContain(sportOrg.id);
    });

    test('Filters organizations by umbrella organization', async () => {
        const { adminToken } = await initPlatformAdmin();
        const scoutsOrg = await createOrganizationWithMeta('Scouts Club', { umbrellaOrganization: UmbrellaOrganization.ScoutsEnGidsenVlaanderen });
        const otherOrg = await createOrganizationWithMeta('No Umbrella Club', { umbrellaOrganization: null });

        const results = await filter({ umbrellaOrganization: { $in: [UmbrellaOrganization.ScoutsEnGidsenVlaanderen] } }, adminToken);
        expect(results).toContain(scoutsOrg.id);
        expect(results).not.toContain(otherOrg.id);
    });

    test('Filters organizations by country', async () => {
        const { adminToken } = await initPlatformAdmin();
        // OrganizationFactory creates organizations in Belgium by default
        const org = await new OrganizationFactory({ name: 'Belgian Club' }).create();

        expect(await filter({ country: { $in: [Country.Belgium] } }, adminToken)).toContain(org.id);
        expect(await filter({ country: { $in: [Country.Netherlands] } }, adminToken)).not.toContain(org.id);
    });

    test('Filters organizations by street', async () => {
        const { adminToken } = await initPlatformAdmin();
        // OrganizationFactory uses 'Demostraat' as the street
        const org = await new OrganizationFactory({ name: 'Streeted Club' }).create();

        expect(await filter({ street: { $contains: 'Demostraat' } }, adminToken)).toContain(org.id);
        expect(await filter({ street: { $contains: 'Nonexistentstreet' } }, adminToken)).not.toContain(org.id);
    });

    test('Filters organizations by creation date', async () => {
        const { adminToken } = await initPlatformAdmin();
        const org = await new OrganizationFactory({ name: 'Freshly Created Club' }).create();

        const anHourAgo = new Date(Date.now() - 1000 * 60 * 60);
        const inAnHour = new Date(Date.now() + 1000 * 60 * 60);

        expect(await filter({ createdAt: { $gt: anHourAgo } }, adminToken)).toContain(org.id);
        expect(await filter({ createdAt: { $gt: inAnHour } }, adminToken)).not.toContain(org.id);
    });

    // Creates an organization with the given record categories (questionnaires) in its records configuration
    const createOrganizationWithRecordCategories = async (name: string, recordCategories: RecordCategory[]) => {
        const meta = OrganizationMetaData.create({
            type: OrganizationType.Other,
            umbrellaOrganization: null,
            defaultEndDate: new Date(),
            defaultStartDate: new Date(),
            defaultPrices: [],
            recordsConfiguration: OrganizationRecordsConfiguration.create({
                recordCategories,
            }),
        });
        return await new OrganizationFactory({ name, meta }).create();
    };

    const createTextRecord = (nameValue: string) => {
        return RecordSettings.create({
            name: TranslatedString.create(nameValue),
            type: RecordType.Text,
        });
    };

    test('Filters organizations by record category name', async () => {
        const { adminToken } = await initPlatformAdmin();

        const medicalOrg = await createOrganizationWithRecordCategories('Medical Questionnaire Club', [
            RecordCategory.create({ name: TranslatedString.create('Medische fiche') }),
        ]);
        const consentOrg = await createOrganizationWithRecordCategories('Consent Questionnaire Club', [
            RecordCategory.create({ name: TranslatedString.create('Toestemmingen') }),
        ]);

        const results = await filter({ recordCategoryName: { $contains: 'Medische' } }, adminToken);
        expect(results).toContain(medicalOrg.id);
        expect(results).not.toContain(consentOrg.id);
    });

    test('Matches questionnaire name regardless of the language of a translated name', async () => {
        const { adminToken } = await initPlatformAdmin();

        // A name that is stored as a multi-language object (not a plain string)
        const org = await createOrganizationWithRecordCategories('Multilingual Questionnaire Club', [
            RecordCategory.create({
                name: TranslatedString.create({ nl: 'Gezondheidsvragen', en: 'Health questions' }),
            }),
        ]);

        expect(await filter({ recordCategoryName: { $contains: 'Gezondheidsvragen' } }, adminToken)).toContain(org.id);
        expect(await filter({ recordCategoryName: { $contains: 'Health questions' } }, adminToken)).toContain(org.id);
    });

    test('Does not match a record name or child category name when filtering on record category name', async () => {
        const { adminToken } = await initPlatformAdmin();

        const org = await createOrganizationWithRecordCategories('Precise Questionnaire Club', [
            RecordCategory.create({
                name: TranslatedString.create('Algemeen'),
                childCategories: [
                    RecordCategory.create({
                        name: TranslatedString.create('Subcategorie'),
                        records: [createTextRecord('Bloedgroep')],
                    }),
                ],
            }),
        ]);

        // The top-level questionnaire name matches
        expect(await filter({ recordCategoryName: { $contains: 'Algemeen' } }, adminToken)).toContain(org.id);
        // A child category name is not a questionnaire
        expect(await filter({ recordCategoryName: { $contains: 'Subcategorie' } }, adminToken)).not.toContain(org.id);
        // A record name is not a questionnaire
        expect(await filter({ recordCategoryName: { $contains: 'Bloedgroep' } }, adminToken)).not.toContain(org.id);
    });

    test('Filters organizations by a record name in a top-level record categories', async () => {
        const { adminToken } = await initPlatformAdmin();

        const org = await createOrganizationWithRecordCategories('Direct Question Club', [
            RecordCategory.create({
                name: TranslatedString.create('Algemeen'),
                records: [createTextRecord('Bloedgroep')],
            }),
        ]);
        const otherOrg = await createOrganizationWithRecordCategories('Other Question Club', [
            RecordCategory.create({
                name: TranslatedString.create('Algemeen'),
                records: [createTextRecord('Schoenmaat')],
            }),
        ]);

        const results = await filter({ recordName: { $contains: 'Bloedgroep' } }, adminToken);
        expect(results).toContain(org.id);
        expect(results).not.toContain(otherOrg.id);
    });

    test('Filters organizations by a record name nested in deep child categories', async () => {
        const { adminToken } = await initPlatformAdmin();

        // Category -> child -> child -> child, with the record at the deepest level
        const org = await createOrganizationWithRecordCategories('Deeply Nested Question Club', [
            RecordCategory.create({
                name: TranslatedString.create('Niveau 0'),
                childCategories: [
                    RecordCategory.create({
                        name: TranslatedString.create('Niveau 1'),
                        childCategories: [
                            RecordCategory.create({
                                name: TranslatedString.create('Niveau 2'),
                                childCategories: [
                                    RecordCategory.create({
                                        name: TranslatedString.create('Niveau 3'),
                                        records: [createTextRecord('Diepe vraag')],
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ]);

        const noMatchOrg = await createOrganizationWithRecordCategories('Shallow Question Club', [
            RecordCategory.create({
                name: TranslatedString.create('Niveau 0'),
                records: [createTextRecord('Oppervlakkige vraag')],
            }),
        ]);

        const results = await filter({ recordName: { $contains: 'Diepe vraag' } }, adminToken);
        expect(results).toContain(org.id);
        expect(results).not.toContain(noMatchOrg.id);
    });

    test('Filters organizations by a child (sub)category name', async () => {
        const { adminToken } = await initPlatformAdmin();

        const org = await createOrganizationWithRecordCategories('Child Category Club', [
            RecordCategory.create({
                name: TranslatedString.create('Algemeen'),
                childCategories: [
                    RecordCategory.create({
                        name: TranslatedString.create('Medische subcategorie'),
                        records: [createTextRecord('Bloedgroep')],
                    }),
                ],
            }),
        ]);
        const otherOrg = await createOrganizationWithRecordCategories('Other Child Category Club', [
            RecordCategory.create({
                name: TranslatedString.create('Algemeen'),
                childCategories: [
                    RecordCategory.create({
                        name: TranslatedString.create('Sportieve subcategorie'),
                        records: [createTextRecord('Bloedgroep')],
                    }),
                ],
            }),
        ]);

        const results = await filter({ recordChildCategoryName: { $contains: 'Medische subcategorie' } }, adminToken);
        expect(results).toContain(org.id);
        expect(results).not.toContain(otherOrg.id);
    });

    test('Does not match a top-level questionnaire name or record name when filtering on child category name', async () => {
        const { adminToken } = await initPlatformAdmin();

        const org = await createOrganizationWithRecordCategories('Precise Child Category Club', [
            RecordCategory.create({
                name: TranslatedString.create('Bovenliggende naam'),
                childCategories: [
                    RecordCategory.create({
                        name: TranslatedString.create('Onderliggende naam'),
                        records: [createTextRecord('Vraagnaam')],
                    }),
                ],
            }),
        ]);

        // The child category name matches
        expect(await filter({ recordChildCategoryName: { $contains: 'Onderliggende naam' } }, adminToken)).toContain(org.id);
        // A top-level questionnaire name is not a child category
        expect(await filter({ recordChildCategoryName: { $contains: 'Bovenliggende naam' } }, adminToken)).not.toContain(org.id);
        // A record name is not a child category
        expect(await filter({ recordChildCategoryName: { $contains: 'Vraagnaam' } }, adminToken)).not.toContain(org.id);
    });

    test('Filters organizations by a child category name nested in deep child categories', async () => {
        const { adminToken } = await initPlatformAdmin();

        // Category -> child -> child -> child, with the matching child category at the deepest level
        const org = await createOrganizationWithRecordCategories('Deeply Nested Child Category Club', [
            RecordCategory.create({
                name: TranslatedString.create('Niveau 0'),
                childCategories: [
                    RecordCategory.create({
                        name: TranslatedString.create('Niveau 1'),
                        childCategories: [
                            RecordCategory.create({
                                name: TranslatedString.create('Niveau 2'),
                                childCategories: [
                                    RecordCategory.create({
                                        name: TranslatedString.create('Diepe subcategorie'),
                                        records: [createTextRecord('Diepe vraag')],
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ]);

        const noMatchOrg = await createOrganizationWithRecordCategories('Shallow Child Category Club', [
            RecordCategory.create({
                name: TranslatedString.create('Niveau 0'),
                childCategories: [
                    RecordCategory.create({
                        name: TranslatedString.create('Oppervlakkige subcategorie'),
                    }),
                ],
            }),
        ]);

        const results = await filter({ recordChildCategoryName: { $contains: 'Diepe subcategorie' } }, adminToken);
        expect(results).toContain(org.id);
        expect(results).not.toContain(noMatchOrg.id);
    });

    test('Filters organizations by document template type', async () => {
        const { adminToken } = await initPlatformAdmin();

        const fiscalOrg = await new OrganizationFactory({ name: 'Fiscal Document Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: fiscalOrg.id, type: 'fiscal' }).create();

        const participationOrg = await new OrganizationFactory({ name: 'Participation Document Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: participationOrg.id, type: 'participation' }).create();

        const results = await filter({ documentTemplates: { $elemMatch: { type: { $in: ['fiscal'] } } } }, adminToken);
        expect(results).toContain(fiscalOrg.id);
        expect(results).not.toContain(participationOrg.id);
    });

    test('Filters organizations by document template year', async () => {
        const { adminToken } = await initPlatformAdmin();

        const org2024 = await new OrganizationFactory({ name: 'Document Year 2024 Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: org2024.id, year: 2024 }).create();

        const org2023 = await new OrganizationFactory({ name: 'Document Year 2023 Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: org2023.id, year: 2023 }).create();

        const results = await filter({ documentTemplates: { $elemMatch: { year: { $eq: 2024 } } } }, adminToken);
        expect(results).toContain(org2024.id);
        expect(results).not.toContain(org2023.id);
    });

    test('Filters organizations by document template status', async () => {
        const { adminToken } = await initPlatformAdmin();

        const publishedOrg = await new OrganizationFactory({ name: 'Published Document Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: publishedOrg.id, status: DocumentStatus.Published }).create();

        const draftOrg = await new OrganizationFactory({ name: 'Draft Document Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: draftOrg.id, status: DocumentStatus.Draft }).create();

        const results = await filter({ documentTemplates: { $elemMatch: { status: { $in: [DocumentStatus.Published] } } } }, adminToken);
        expect(results).toContain(publishedOrg.id);
        expect(results).not.toContain(draftOrg.id);
    });

    test('Filters organizations by document template isLocked', async () => {
        const { adminToken } = await initPlatformAdmin();

        const lockedOrg = await new OrganizationFactory({ name: 'Locked Document Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: lockedOrg.id, isLocked: true }).create();

        const unlockedOrg = await new OrganizationFactory({ name: 'Unlocked Document Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: unlockedOrg.id, isLocked: false }).create();

        const results = await filter({ documentTemplates: { $elemMatch: { isLocked: { $eq: true } } } }, adminToken);
        expect(results).toContain(lockedOrg.id);
        expect(results).not.toContain(unlockedOrg.id);
    });

    test('Filters organizations by document template updatesEnabled', async () => {
        const { adminToken } = await initPlatformAdmin();

        const noUpdatesOrg = await new OrganizationFactory({ name: 'No Updates Document Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: noUpdatesOrg.id, updatesEnabled: false }).create();

        const updatesOrg = await new OrganizationFactory({ name: 'Updates Document Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: updatesOrg.id, updatesEnabled: true }).create();

        const results = await filter({ documentTemplates: { $elemMatch: { updatesEnabled: { $eq: false } } } }, adminToken);
        expect(results).toContain(noUpdatesOrg.id);
        expect(results).not.toContain(updatesOrg.id);
    });

    test('Combines multiple document template conditions in a single $elemMatch', async () => {
        const { adminToken } = await initPlatformAdmin();

        const matchOrg = await new OrganizationFactory({ name: 'Matching Document Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: matchOrg.id, type: 'fiscal', year: 2025, status: DocumentStatus.Published }).create();

        // Same org, but the conditions are split over two different templates: should not match a single-template $elemMatch
        const splitOrg = await new OrganizationFactory({ name: 'Split Document Club' }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: splitOrg.id, type: 'fiscal', year: 2020, status: DocumentStatus.Published }).create();
        await new DocumentTemplateFactory({ groups: [], organizationId: splitOrg.id, type: 'participation', year: 2025, status: DocumentStatus.Published }).create();

        const results = await filter({
            documentTemplates: {
                $elemMatch: {
                    type: { $in: ['fiscal'] },
                    year: { $eq: 2025 },
                },
            },
        }, adminToken);
        expect(results).toContain(matchOrg.id);
        expect(results).not.toContain(splitOrg.id);
    });
});
