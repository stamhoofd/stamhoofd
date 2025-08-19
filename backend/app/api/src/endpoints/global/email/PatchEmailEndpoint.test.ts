import { Request } from '@simonbackx/simple-endpoints';
import { Email, Organization, OrganizationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { AccessRight, EmailStatus, Email as EmailStruct, OrganizationEmail, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, Version } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer';
import { PatchEmailEndpoint } from './PatchEmailEndpoint';
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';

const baseUrl = `/v${Version}/email`;

describe('Endpoint.PatchEmailEndpoint', () => {
    const endpoint = new PatchEmailEndpoint();
    let period: RegistrationPeriod;
    let organization: Organization;
    let token: Token;
    let user: User;
    let sender: OrganizationEmail;
    let sender2: OrganizationEmail;

    let token2: Token;
    let user2: User;

    const patchEmail = async (email: AutoEncoderPatchType<EmailStruct>, token: Token, organization?: Organization) => {
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

        sender = OrganizationEmail.create({
            email: 'groepsleiding@voorbeeld.com',
            name: 'Groepsleiding',
        });
        sender2 = OrganizationEmail.create({
            email: 'kapoenen@voorbeeld.com',
            name: 'Kapoenen',
        });

        organization.privateMeta.emails.push(sender);
        organization.privateMeta.emails.push(sender2);
        await organization.save();

        user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                resources: new Map([
                    [PermissionsResourceType.Senders, new Map([[sender.id, ResourcePermissions.create({
                        resourceName: sender.name!,
                        level: PermissionLevel.None,
                        accessRights: [AccessRight.SendMessages],
                    })]])],
                ]),
            }),
        })
            .create();

        token = await Token.createToken(user);

        user2 = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                resources: new Map([
                    [PermissionsResourceType.Senders, new Map([[sender2.id, ResourcePermissions.create({
                        resourceName: sender.name!,
                        level: PermissionLevel.Write,
                        accessRights: [AccessRight.SendMessages],
                    })]])],
                ]),
            }),
        })
            .create();

        token2 = await Token.createToken(user2);
    });

    test('Should throw for invalid senderId', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email {{unsubscribeUrl}}';
        email.html = `<!DOCTYPE html>
        <html>

        <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>test</title>
        </head>

        <body>
        <p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>

        {{unsubscribeUrl}}
        </body>

        </html>`;
        email.json = {
            content: [
                {
                    content: [
                        {
                            text: 'test email',
                            type: 'text',
                        },
                    ],
                    type: 'paragraph',
                },
            ],
            type: 'doc',
        };
        email.userId = user.id;
        email.organizationId = organization.id;

        await email.save();

        const body = EmailStruct.patch({
            id: email.id,
            status: EmailStatus.Sending,
            senderId: 'invalid-sender-id',
        });

        await expect(async () => await patchEmail(body, token, organization))
            .rejects
            .toThrow(STExpect.errorWithCode('invalid_sender'));
    });

    test('Should throw when patching other users email without sender id', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email {{unsubscribeUrl}}';
        email.html = `<!DOCTYPE html>
        <html>

        <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>test</title>
        </head>

        <body>
        <p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>

        {{unsubscribeUrl}}
        </body>

        </html>`;
        email.json = {
            content: [
                {
                    content: [
                        {
                            text: 'test email',
                            type: 'text',
                        },
                    ],
                    type: 'paragraph',
                },
            ],
            type: 'doc',
        };
        email.userId = user2.id;
        email.organizationId = organization.id;

        await email.save();

        const body = EmailStruct.patch({
            id: email.id,
            subject: 'new subject',
        });

        await expect(async () => await patchEmail(body, token, organization))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('Should throw when patching other users email even when matching sender', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email {{unsubscribeUrl}}';
        email.html = `<!DOCTYPE html>
        <html>

        <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>test</title>
        </head>

        <body>
        <p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>

        {{unsubscribeUrl}}
        </body>

        </html>`;
        email.json = {
            content: [
                {
                    content: [
                        {
                            text: 'test email',
                            type: 'text',
                        },
                    ],
                    type: 'paragraph',
                },
            ],
            type: 'doc',
        };
        email.userId = user2.id;
        email.organizationId = organization.id;
        email.senderId = sender.id;

        await email.save();

        const body = EmailStruct.patch({
            id: email.id,
            subject: 'new subject',
        });

        await expect(async () => await patchEmail(body, token, organization))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('Should not throw when patching other users email when having write access to sender', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email {{unsubscribeUrl}}';
        email.html = `<!DOCTYPE html>
        <html>

        <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>test</title>
        </head>

        <body>
        <p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>

        {{unsubscribeUrl}}
        </body>

        </html>`;
        email.json = {
            content: [
                {
                    content: [
                        {
                            text: 'test email',
                            type: 'text',
                        },
                    ],
                    type: 'paragraph',
                },
            ],
            type: 'doc',
        };
        email.userId = user.id; // other user
        email.organizationId = organization.id;
        email.senderId = sender2.id; // write access to this sender

        await email.save();

        const body = EmailStruct.patch({
            id: email.id,
            subject: 'new subject',
        });

        await expect(patchEmail(body, token2, organization)).toResolve();
    });

    test('Should throw when patching if no permission for sender', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email {{unsubscribeUrl}}';
        email.html = `<!DOCTYPE html>
        <html>

        <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>test</title>
        </head>

        <body>
        <p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>

        {{unsubscribeUrl}}
        </body>

        </html>`;
        email.json = {
            content: [
                {
                    content: [
                        {
                            text: 'test email',
                            type: 'text',
                        },
                    ],
                    type: 'paragraph',
                },
            ],
            type: 'doc',
        };
        email.userId = user.id;
        email.organizationId = organization.id;

        await email.save();

        const body = EmailStruct.patch({
            id: email.id,
            senderId: sender2.id,
        });

        await expect(async () => await patchEmail(body, token, organization))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('Should throw when sending if no permission for sender', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email {{unsubscribeUrl}}';
        email.html = `<!DOCTYPE html>
        <html>

        <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>test</title>
        </head>

        <body>
        <p style="margin: 0; padding: 0; line-height: 1.4;">test email</p>

        {{unsubscribeUrl}}
        </body>

        </html>`;
        email.json = {
            content: [
                {
                    content: [
                        {
                            text: 'test email',
                            type: 'text',
                        },
                    ],
                    type: 'paragraph',
                },
            ],
            type: 'doc',
        };
        email.userId = user.id;
        email.organizationId = organization.id;
        email.senderId = sender2.id;

        await email.save();

        const body = EmailStruct.patch({
            id: email.id,
            status: EmailStatus.Sending,
        });

        await expect(async () => await patchEmail(body, token, organization))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('Should throw error if no unsubscribe button in email html', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email {{unsubscribeUrl}}';
        email.html = `<!DOCTYPE html>
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
            content: [
                {
                    content: [
                        {
                            text: 'test email',
                            type: 'text',
                        },
                    ],
                    type: 'paragraph',
                },
            ],
            type: 'doc',
        };
        email.userId = user.id;
        email.organizationId = organization.id;

        await email.save();

        const body = EmailStruct.patch({ id: email.id, senderId: sender.id, status: EmailStatus.Sending });

        await expect(async () => await patchEmail(body, token, organization))
            .rejects
            .toThrow(STExpect.errorWithCode('missing_unsubscribe_button'));
    });

    test('Should throw error if no unsubscribe button in email text', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email';
        email.html = `<!DOCTYPE html>
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
            content: [
                {
                    content: [
                        {
                            text: 'test email',
                            type: 'text',
                        },
                    ],
                    type: 'paragraph',
                },
            ],
            type: 'doc',
        };
        email.userId = user.id;
        email.organizationId = organization.id;

        await email.save();

        const body = EmailStruct.patch({ id: email.id, senderId: sender.id, status: EmailStatus.Sending });

        await expect(async () => await patchEmail(body, token, organization))
            .rejects
            .toThrow(STExpect.errorWithCode('missing_unsubscribe_button'));
    });

    test('Can send an email', async () => {
        const email = new Email();
        email.subject = 'test subject';
        email.status = EmailStatus.Draft;
        email.text = 'test email {{unsubscribeUrl}}';
        email.html = `<!DOCTYPE html>
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
            content: [
                {
                    content: [
                        {
                            text: 'test email',
                            type: 'text',
                        },
                    ],
                    type: 'paragraph',
                },
            ],
            type: 'doc',
        };
        email.userId = user.id;
        email.organizationId = organization.id;
        email.senderId = sender.id;

        await email.save();

        const body = EmailStruct.patch({ id: email.id, status: EmailStatus.Sending });

        await expect(patchEmail(body, token, organization)).toResolve();
    });
});
