import { Request } from '@simonbackx/simple-endpoints';
import { Email, Organization, OrganizationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from "@stamhoofd/models";
import { EmailStatus, Email as EmailStruct, PermissionLevel, Permissions, Version } from "@stamhoofd/structures";
import { TestUtils } from "@stamhoofd/test-utils";
import { testServer } from "../../../../tests/helpers/TestServer";
import { PatchEmailEndpoint } from "./PatchEmailEndpoint";

const baseUrl = `/v${Version}/email`;

describe('Endpoint.PatchEmailEndpoint', () => {
    const endpoint = new PatchEmailEndpoint();
    let period: RegistrationPeriod;
    let organization: Organization;
    let token: Token;
    let user: User;

    const patchEmail = async (email: EmailStruct, token: Token, organization?: Organization) => {
        const id = email.id;
        const request = Request.buildJson('PATCH', `${baseUrl}/${id}`, organization?.getApiHost(), email);
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

        organization = await new OrganizationFactory({ period })
        .create();

        user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Read,
            }),
        })
        .create();

        token = await Token.createToken(user);
    });

    test('Should throw error if no unsubscribe button in email html', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email {{unsubscribeUrl}}';
        email.html =  `<!DOCTYPE html>
        <html>

        <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>test</title>
        </head>

        <body>
        <p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>
        </body>

        </html>`;
        email.json = {
            "content": [
              {
                "content": [
                  {
                    "text": "test email",
                    "type": "text"
                  }
                ],
                "type": "paragraph"
              }
            ],
            "type": "doc"
        };
        email.userId = user.id;
        email.organizationId = organization.id;

        await email.save();

        const body = EmailStruct.create({...email, fromAddress:'test@test.be', status: EmailStatus.Sending})

        await expect(async () => await patchEmail(body, token, organization))
        .rejects
        .toThrow('Missing unsubscribe button');
    })

    test('Should throw error if no unsubscribe button in email text', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email';
        email.html =  `<!DOCTYPE html>
        <html>

        <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>test</title>
        </head>

        <body>
        <p style="margin: 0; padding: 0; line-height: 1.4;">test email {{unsubscribeUrl}}</p>
        </body>

        </html>`;
        email.json = {
            "content": [
              {
                "content": [
                  {
                    "text": "test email",
                    "type": "text"
                  }
                ],
                "type": "paragraph"
              }
            ],
            "type": "doc"
        };
        email.userId = user.id;
        email.organizationId = organization.id;

        await email.save();

        const body = EmailStruct.create({...email, fromAddress:'test@test.be', status: EmailStatus.Sending})

        await expect(async () => await patchEmail(body, token, organization))
        .rejects
        .toThrow('Missing unsubscribe button');
    })
})
