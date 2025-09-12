/* eslint-disable jest/no-conditional-expect */
import { Request } from '@simonbackx/simple-endpoints';
import { Email, EmailRecipient, MemberFactory, Organization, OrganizationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { AccessRight, EmailRecipientFilter, EmailRecipientFilterType, EmailRecipientSubfilter, EmailStatus, Email as EmailStruct, OrganizationEmail, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, UserPermissions, Version } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer';
import { PatchEmailEndpoint } from './PatchEmailEndpoint';
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';

// Import recipient loaders to initialize them
import '../../../email-recipient-loaders/members';
import '../../../email-recipient-loaders/registrations';
import '../../../email-recipient-loaders/orders';
import '../../../email-recipient-loaders/receivable-balances';
import { Formatter } from '@stamhoofd/utility';

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
        TestUtils.setEnvironment('userMode', 'platform');

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

    test('Should send email to members list with correct replacements and recipients', async () => {
        // First, we need to import the GroupFactory to create groups that the user has access to
        const { GroupFactory } = await import('@stamhoofd/models');

        // Create test groups
        const testGroup = await new GroupFactory({
            organization,
        }).create();

        // Update the user to have group permissions
        if (!user.permissions) {
            user.permissions = UserPermissions.create({});
        }

        // Get existing organization permissions
        // Create new organization permissions if they don't exist
        user.permissions.organizationPermissions.set(organization.id, Permissions.create({
            level: PermissionLevel.None,
            resources: new Map([
                [PermissionsResourceType.Senders, new Map([[sender.id, ResourcePermissions.create({
                    resourceName: sender.name!,
                    level: PermissionLevel.None,
                    accessRights: [AccessRight.SendMessages],
                })]])],
                [PermissionsResourceType.Groups, new Map([[testGroup.id, ResourcePermissions.create({
                    resourceName: testGroup.settings.name.toString(),
                    level: PermissionLevel.Read, // Need at least Read access to access group members through registrations
                    accessRights: [],
                })]])],
            ]),
        }));
        await user.save();

        // Create test users - one with email and one without
        const userWithEmail = await new UserFactory({
            organization,
            email: 'member-with-email@test.com',
        }).create();

        const userWithoutEmail = await new UserFactory({
            organization,
            email: 'user-without-email@test.com', // User has email but member won't
        }).create();

        // Create members - one with email address and one without
        const memberWithEmail = await new MemberFactory({
            organization,
            user: userWithEmail,
        }).create();
        memberWithEmail.details.email = 'member-with-email@test.com';
        await memberWithEmail.save();

        const memberWithoutEmail = await new MemberFactory({
            organization,
            user: userWithoutEmail,
        }).create();
        // Explicitly ensure this member has no email
        memberWithoutEmail.details.email = null;
        await memberWithoutEmail.save();

        // Create registrations for both members in the test group so they can be found by the recipient loader
        const { RegistrationFactory } = await import('@stamhoofd/models');

        await new RegistrationFactory({
            member: memberWithEmail,
            group: testGroup,
        }).create();

        await new RegistrationFactory({
            member: memberWithoutEmail,
            group: testGroup,
        }).create();

        // No mocking needed - we'll use the real recipient loading logic

        // Create an email with recipient filter targeting these specific members
        const email = new Email();
        email.subject = 'Test Email with Replacements {{firstName}}';
        email.status = EmailStatus.Draft;
        email.text = 'Hello {{firstName}} {{lastName}}, this is a test email. {{unsubscribeUrl}} {{loginDetails}}';
        email.html = `<!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8" />
        <title>Test Email</title>
        </head>
        <body>
        <p>Hello {{firstName}} {{lastName}}, this is a test email.</p>
        <p>Login details: {{loginDetails}}</p>
        <p>Unsubscribe: <a href="{{unsubscribeUrl}}">Click here</a></p>
        <p>Member firstname: {{firstNameMember}}</p>
        </body>
        </html>`;
        email.json = {};

        email.userId = user.id;
        email.organizationId = organization.id;
        email.senderId = sender.id;

        // Set up recipient filter to target our specific members
        email.recipientFilter = EmailRecipientFilter.create({
            filters: [
                EmailRecipientSubfilter.create({
                    type: EmailRecipientFilterType.Members,
                    filter: {
                        id: { $in: [memberWithEmail.id, memberWithoutEmail.id] },
                    },
                }),
            ],
        });

        await email.save();

        // Instead of using the queue system (which has context issues), test the recipient loading directly
        // This tests the core functionality without the complexity of the queue system

        // First try to build recipients with proper context by calling through the endpoint
        const body = EmailStruct.patch({
            id: email.id,
            status: EmailStatus.Sending,
        });

        // This should start the recipient building process in the background
        const response = await patchEmail(body, token, organization);
        expect(response.status).toBe(200);

        // Wait for the background process to complete (or fail)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Refresh the email to check the status
        await email.refresh();

        // Check that EmailRecipient records were created correctly
        const recipients = await EmailRecipient.select()
            .where('emailId', email.id)
            .fetch();

        expect(recipients).toHaveLength(3);

        // Two recipients with null email for both members
        const recipientsWithoutEmail = recipients.filter(r => r.email === null);
        expect(recipientsWithoutEmail).toHaveLength(2);

        // Check one extra recipient with the email = memberWithEmail's email
        const recipientWithEmail = recipients.find(r => r.email === userWithEmail.email);
        expect(recipientWithEmail).toBeDefined();
        expect(recipientWithEmail?.memberId).toBe(memberWithEmail.id);

        for (const recipient of recipients) {
            // Check {{greeting}} replacement
            const greeting = recipient.replacements.find(r => r.token === 'greeting');
            expect(greeting).toBeDefined();
            expect(greeting?.value).toEqual('Dag ' + recipient.firstName + ',');

            // Check loginDetails replacement includes email address
            const loginDetails = recipient.replacements.find(r => r.token === 'loginDetails');
            expect(loginDetails).toBeDefined();

            if (recipient.email) {
                expect(loginDetails?.html).toContain(recipient.email || ''); // If no email, won't contain it
            }
            else {
                // Cehck loginDetails is an empty string
                expect(loginDetails?.html).toBe(undefined);
                expect(loginDetails?.value).toBe('');
            }

            const balanceTable = recipient.replacements.find(r => r.token === 'balanceTable');
            expect(balanceTable).toBeDefined();
            expect(balanceTable?.html).toInclude($t('4c4f6571-f7b5-469d-a16f-b1547b43a610'));

            // Outstanding balance
            const outstandingBalance = recipient.replacements.find(r => r.token === 'outstandingBalance');
            expect(outstandingBalance).toBeDefined();
            expect(outstandingBalance?.value).toBe(Formatter.price(0));

            // firstNameMember
            const firstNameMember = recipient.replacements.find(r => r.token === 'firstNameMember');
            expect(firstNameMember).toBeDefined();
            if (recipient.memberId === memberWithEmail.id) {
                expect(firstNameMember?.value).toBe(memberWithEmail.details.firstName);
            }
            else if (recipient.memberId === memberWithoutEmail.id) {
                expect(firstNameMember?.value).toBe(memberWithoutEmail.details.firstName);
            }
            else {
                throw new Error('Recipient has unexpected memberId ' + recipient.memberId);
            }

            // Check lastNameMember is not present, because it is not used in the html
            const lastNameMember = recipient.replacements.find(r => r.token === 'lastNameMember');
            expect(lastNameMember).toBeUndefined();
        }
    });
});
