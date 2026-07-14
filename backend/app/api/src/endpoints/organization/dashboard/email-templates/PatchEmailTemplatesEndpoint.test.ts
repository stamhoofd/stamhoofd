import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray, PatchMap } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, RegistrationPeriod } from '@stamhoofd/models';
import { EmailTemplate, GroupFactory, OrganizationFactory, Platform, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { EmailContent, EmailTemplate as EmailTemplateStruct, EmailTemplateType, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions, Version } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchEmailTemplatesEndpoint } from './PatchEmailTemplatesEndpoint.js';

const baseUrl = `/v${Version}/email-templates`;

describe('Endpoint.PatchEmailTemplatesEndpoint', () => {
    const endpoint = new PatchEmailTemplatesEndpoint();
    let period: RegistrationPeriod;

    const patchEmailTemplates = async (body: PatchableArrayAutoEncoder<EmailTemplateStruct>, token: Token, organization?: Organization) => {
        const request = Request.buildJson('PATCH', baseUrl, organization?.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();
    });

    describe('User with platform role who has full permission for all organizations', () => {
        test('should be allowed to patch templates for organizations', async () => {
            const role = PermissionRoleDetailed.create({
                name: 'Beroepsmedewerker',
                resources: new Map([[PermissionsResourceType.OrganizationTags, new Map([[
                    '',
                    ResourcePermissions.create({
                        level: PermissionLevel.Full,
                    }),
                ]])]]),
            });

            const globalPermissions = Permissions.create({
                level: PermissionLevel.None,
                roles: [
                    role,
                ],
            });

            const platform = await Platform.getForEditing();
            platform.privateConfig.roles.push(role);
            await platform.save();

            const user = await new UserFactory({
                globalPermissions,
            })
                .create();

            const organization = await new OrganizationFactory({ period }).create();
            const group = await new GroupFactory({ organization }).create();

            const token = await Token.createToken(user);

            const template = new EmailTemplate();
            template.subject = 'test template 1';
            template.type = EmailTemplateType.RegistrationConfirmation;
            template.json = {};
            template.html = 'html test';
            template.text = 'text test';
            template.organizationId = organization.id;
            template.groupId = group.id;
            await template.save();

            const body: PatchableArrayAutoEncoder<EmailTemplateStruct> = new PatchableArray();

            body.addPatch(
                EmailTemplateStruct.patch(({
                    id: template.id,
                    subject: 'new subject',
                })),
            );

            const response = await patchEmailTemplates(body, token);
            expect(response.body).toBeDefined();
        });
    });

    describe('Translations', () => {
        const createOrganizationWithAdmin = async () => {
            const organization = await new OrganizationFactory({ period }).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            }).create();
            const token = await Token.createToken(user);
            return { organization, token };
        };

        const createTemplate = async (organization: Organization, translations?: Map<Language, EmailContent>) => {
            const template = new EmailTemplate();
            template.subject = 'Default subject';
            template.type = EmailTemplateType.SavedMembersEmail;
            template.json = {};
            template.html = '<p>Default</p>';
            template.text = 'Default';
            template.organizationId = organization.id;
            if (translations) {
                template.translations = translations;
            }
            await template.save();
            return template;
        };

        test('a template can be created with translations', async () => {
            const { organization, token } = await createOrganizationWithAdmin();

            const body: PatchableArrayAutoEncoder<EmailTemplateStruct> = new PatchableArray();
            body.addPut(EmailTemplateStruct.create({
                id: uuidv4(),
                subject: 'Default subject',
                html: '<p>Default</p>',
                text: 'Default',
                type: EmailTemplateType.SavedMembersEmail,
                translations: new Map([
                    [Language.French, EmailContent.create({ subject: 'Sujet français', html: '<p>Français</p>', text: 'Français' })],
                ]),
            }));

            const response = await patchEmailTemplates(body, token, organization);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].translations.get(Language.French)!.subject).toBe('Sujet français');

            const saved = await EmailTemplate.getByID(response.body[0].id);
            expect(saved!.translations.get(Language.French)!.subject).toBe('Sujet français');
        });

        test('a translation can be added to an existing template without changing other content', async () => {
            const { organization, token } = await createOrganizationWithAdmin();
            const template = await createTemplate(organization, new Map([
                [Language.English, EmailContent.create({ subject: 'English subject' })],
            ]));

            const body: PatchableArrayAutoEncoder<EmailTemplateStruct> = new PatchableArray();
            body.addPatch(EmailTemplateStruct.patch({
                id: template.id,
                translations: new PatchMap([[Language.French, EmailContent.create({ subject: 'Sujet français' })]]),
            }));

            const response = await patchEmailTemplates(body, token, organization);
            expect(response.body).toHaveLength(1);

            const saved = await EmailTemplate.getByID(template.id);
            expect(saved!.subject).toBe('Default subject');
            expect(saved!.translations.size).toBe(2);
            expect(saved!.translations.get(Language.English)!.subject).toBe('English subject');
            expect(saved!.translations.get(Language.French)!.subject).toBe('Sujet français');
        });

        test('a translation can be deleted', async () => {
            const { organization, token } = await createOrganizationWithAdmin();
            const template = await createTemplate(organization, new Map([
                [Language.English, EmailContent.create({ subject: 'English subject' })],
                [Language.French, EmailContent.create({ subject: 'Sujet français' })],
            ]));

            const body: PatchableArrayAutoEncoder<EmailTemplateStruct> = new PatchableArray();
            body.addPatch(EmailTemplateStruct.patch({
                id: template.id,
                translations: new PatchMap([[Language.French, null]]),
            }));

            await patchEmailTemplates(body, token, organization);

            const saved = await EmailTemplate.getByID(template.id);
            expect(saved!.translations.size).toBe(1);
            expect(saved!.translations.get(Language.French)).toBeUndefined();
            expect(saved!.translations.get(Language.English)!.subject).toBe('English subject');
        });

        test('patching only the subject keeps the translations', async () => {
            const { organization, token } = await createOrganizationWithAdmin();
            const template = await createTemplate(organization, new Map([
                [Language.French, EmailContent.create({ subject: 'Sujet français' })],
            ]));

            const body: PatchableArrayAutoEncoder<EmailTemplateStruct> = new PatchableArray();
            body.addPatch(EmailTemplateStruct.patch({
                id: template.id,
                subject: 'New default subject',
            }));

            await patchEmailTemplates(body, token, organization);

            const saved = await EmailTemplate.getByID(template.id);
            expect(saved!.subject).toBe('New default subject');
            expect(saved!.translations.get(Language.French)!.subject).toBe('Sujet français');
        });
    });
});
