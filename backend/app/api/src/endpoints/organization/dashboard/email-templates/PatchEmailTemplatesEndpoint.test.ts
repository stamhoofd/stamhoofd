import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import { EmailTemplate, GroupFactory, Organization, OrganizationFactory, Platform, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { EmailTemplate as EmailTemplateStruct, EmailTemplateType, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
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
});
