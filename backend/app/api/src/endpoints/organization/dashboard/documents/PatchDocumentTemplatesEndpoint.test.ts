import { PatchableArray } from '@simonbackx/simple-encoding';
import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { DocumentTemplate, DocumentTemplateFactory, Organization, OrganizationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { DocumentPrivateSettings, DocumentStatus, DocumentTemplateDefinition, DocumentTemplatePrivate, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchDocumentTemplatesEndpoint } from './PatchDocumentTemplatesEndpoint.js';

const baseUrl = `/organization/document-templates`;
const endpoint = new PatchDocumentTemplatesEndpoint();
type EndpointType = typeof endpoint;
type Body = EndpointType extends Endpoint<any, any, infer B, any> ? B : never;

describe('Endpoint.PatchDocumentTemplatesEndpoint', () => {
    let period: RegistrationPeriod;
    let organization: Organization;
    let user: User;
    let token: Token;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();

        organization = await new OrganizationFactory({ period })
            .create();

        user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        token = await Token.createToken(user);
    });

    describe('put fiscal document', () => {
        it('should throw if already has fiscal document in year', async () => {
            // create existing fiscal document in same year
            await new DocumentTemplateFactory({
                organizationId: organization.id,
                type: 'fiscal',
                groups: [],
                year: 2022,
            }).create();

            // create new fiscal document in same year
            const arr: Body = new PatchableArray();
            const newDocumentModel: DocumentTemplate = (await new DocumentTemplateFactory({
                organizationId: organization.id,
                type: 'fiscal',
                groups: [],
                year: 2022,
            }).createWithoutSave());

            const newDocument = newDocumentModel.getPrivateStructure();
            arr.addPut(newDocument);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;

            await expect(testServer.test(endpoint, request))
                .rejects
                .toThrow(STExpect.errorWithCode('double_fiscal_document'));
        });

        it('should not throw if first fiscal document in year', async () => {
            // delete existing docs from organization
            await SQL.delete().from(SQL.table(DocumentTemplate.table)).where('organizationId', organization.id);

            const arr: Body = new PatchableArray();
            const newDocumentModel: DocumentTemplate = (await new DocumentTemplateFactory({
                organizationId: organization.id,
                type: 'fiscal',
                groups: [],
                year: 2022,
            }).createWithoutSave());

            const newDocument = newDocumentModel.getPrivateStructure();
            arr.addPut(newDocument);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;

            const result = await testServer.test(endpoint, request);

            expect(result).toBeDefined();
            expect(result.status).toBe(200);
        });
    });

    describe('patch fiscal document', () => {
        describe('change type to fiscal', () => {
            it('should throw if already has fiscal document in year', async () => {
                // create existing fiscal document in same year
                await new DocumentTemplateFactory({
                    organizationId: organization.id,
                    type: 'fiscal',
                    groups: [],
                    year: 2022,
                }).create();

                // create new fiscal document in same year
                const arr: Body = new PatchableArray();

                // create new participation document in same year
                const newDocumentModel: DocumentTemplate = (await new DocumentTemplateFactory({
                    organizationId: organization.id,
                    type: 'participation',
                    groups: [],
                    year: 2022,
                }).create());

                // change type to fiscal
                arr.addPatch(DocumentTemplatePrivate.patch({
                    id: newDocumentModel.id,
                    privateSettings: DocumentPrivateSettings.patch({
                        templateDefinition: DocumentTemplateDefinition.patch({
                            type: 'fiscal',
                        }),
                    }),
                }));

                const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                request.headers.authorization = 'Bearer ' + token.accessToken;

                await expect(testServer.test(endpoint, request))
                    .rejects
                    .toThrow(STExpect.errorWithCode('double_fiscal_document'));
            });

            it('should not throw if first fiscal document in year', async () => {
                // delete existing docs from organization
                await SQL.delete().from(SQL.table(DocumentTemplate.table)).where('organizationId', organization.id);

                // create new fiscal document in same year
                const arr: Body = new PatchableArray();

                // create new participation document in same year
                const newDocumentModel: DocumentTemplate = (await new DocumentTemplateFactory({
                    organizationId: organization.id,
                    type: 'participation',
                    groups: [],
                    year: 2022,
                }).create());

                // change type to fiscal
                arr.addPatch(DocumentTemplatePrivate.patch({
                    id: newDocumentModel.id,
                    privateSettings: DocumentPrivateSettings.patch({
                        templateDefinition: DocumentTemplateDefinition.patch({
                            type: 'fiscal',
                        }),
                    }),
                }));

                const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                request.headers.authorization = 'Bearer ' + token.accessToken;

                const result = await testServer.test(endpoint, request);

                expect(result).toBeDefined();
                expect(result.status).toBe(200);
            });
        });

        describe('change year', () => {
            it('should throw if already has fiscal document in year', async () => {
                // create existing fiscal document in same year
                await new DocumentTemplateFactory({
                    organizationId: organization.id,
                    type: 'fiscal',
                    groups: [],
                    year: 2022,
                }).create();

                // create new fiscal document in same year
                const arr: Body = new PatchableArray();

                // create new participation document in other year
                const newDocumentModel: DocumentTemplate = (await new DocumentTemplateFactory({
                    organizationId: organization.id,
                    type: 'fiscal',
                    groups: [],
                    year: 2021,
                }).create());

                // change year to same year as other existing document
                arr.addPatch(DocumentTemplatePrivate.patch({
                    id: newDocumentModel.id,
                    year: 2022,
                }));

                const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                request.headers.authorization = 'Bearer ' + token.accessToken;

                await expect(testServer.test(endpoint, request))
                    .rejects
                    .toThrow(STExpect.errorWithCode('double_fiscal_document'));
            });

            it('should not throw if first fiscal document in year', async () => {
                // delete existing docs from organization
                await SQL.delete().from(SQL.table(DocumentTemplate.table)).where('organizationId', organization.id);

                // create new fiscal document in same year
                const arr: Body = new PatchableArray();

                // create new participation document in other year
                const newDocumentModel: DocumentTemplate = (await new DocumentTemplateFactory({
                    organizationId: organization.id,
                    type: 'fiscal',
                    groups: [],
                    year: 2021,
                }).create());

                // change year to same year as other existing document
                arr.addPatch(DocumentTemplatePrivate.patch({
                    id: newDocumentModel.id,
                    year: 2022,
                }));

                const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                request.headers.authorization = 'Bearer ' + token.accessToken;

                const result = await testServer.test(endpoint, request);

                expect(result).toBeDefined();
                expect(result.status).toBe(200);
            });
        });

        describe('do not change type or year of existing fiscal document', () => {
            it('should not throw if multiple fiscal documents in year', async () => {
                // delete existing docs from organization
                await SQL.delete().from(SQL.table(DocumentTemplate.table)).where('organizationId', organization.id);

                // create existing fiscal document in same year
                await new DocumentTemplateFactory({
                    organizationId: organization.id,
                    type: 'fiscal',
                    groups: [],
                    year: 2022,
                }).create();

                // create new fiscal document in same year
                const arr: Body = new PatchableArray();

                // create double fiscal document in same year
                const newDocumentModel: DocumentTemplate = (await new DocumentTemplateFactory({
                    organizationId: organization.id,
                    type: 'fiscal',
                    groups: [],
                    year: 2022,
                }).create());

                // change status to published (do not change year or type)
                arr.addPatch(DocumentTemplatePrivate.patch({
                    id: newDocumentModel.id,
                    status: DocumentStatus.Published,
                }));

                const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                request.headers.authorization = 'Bearer ' + token.accessToken;

                const result = await testServer.test(endpoint, request);

                expect(result).toBeDefined();
                expect(result.status).toBe(200);
                expect(result.body.length).toBe(1);
                expect(result.body[0].status).toBe(DocumentStatus.Published);
            });
        });
    });
});
