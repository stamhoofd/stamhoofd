import { EmailRecipientFilter, EmailRecipientFilterType, EmailRecipientsStatus, EmailRecipient as EmailRecipientStruct, EmailRecipientSubfilter, EmailStatus, LimitedFilteredRequest, PaginatedResponse } from '@stamhoofd/structures';
import { Email } from './Email';
import { EmailRecipient } from './EmailRecipient';
import { EmailMocker } from '@stamhoofd/email';
import { TestUtils } from '@stamhoofd/test-utils';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { Platform } from './Platform';

async function buildEmail(data: {
    recipients: EmailRecipientStruct[];
} & Partial<Email>) {
    Email.recipientLoaders.set(EmailRecipientFilterType.Members, {
        fetch: async (query: LimitedFilteredRequest) => {
            return Promise.resolve(
                new PaginatedResponse<EmailRecipientStruct[], LimitedFilteredRequest>({
                    results: data.recipients,
                    next: undefined,
                }),
            );
        },

        count: async (query: LimitedFilteredRequest) => {
            return data.recipients.length;
        },
    });

    const model = new Email();
    model.userId = null;
    model.organizationId = data.organizationId ?? null;
    model.recipientFilter = EmailRecipientFilter.create({
        filters: [
            EmailRecipientSubfilter.create({
                type: EmailRecipientFilterType.Members,
                filter: { id: { $in: ['test'] } },
            }),
        ],
    });

    model.subject = data.subject ?? 'This is a test email';
    model.html = data.html ?? '<p>This is a test email</p>';
    model.text = data.text ?? 'This is a test email';
    model.json = data.json ?? {};
    model.status = data.status ?? EmailStatus.Draft;
    model.attachments = [];
    model.fromAddress = data.fromAddress ?? 'test@stamhoofd.be';
    model.fromName = data.fromName ?? 'Stamhoofd Test Suite';

    await model.save();

    return model;
}

describe('Model.Email', () => {
    it('Correctly whitelists email recipients', async () => {
        TestUtils.setEnvironment('WHITELISTED_EMAIL_DESTINATIONS', ['*@stamhoofd-allowed-domain-tests.be']);
        const model = await buildEmail({
            recipients: [
                EmailRecipientStruct.create({
                    firstName: 'Test',
                    lastName: 'Test',
                    email: 'example@not-whitelisted-domain.be',
                }),
                EmailRecipientStruct.create({
                    firstName: 'Test',
                    lastName: 'Test',
                    email: 'example2@stamhoofd-allowed-domain-tests.be',
                }),
            ],
        });
        await model.send();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.recipientCount).toBe(2);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(EmailMocker.broadcast.getSucceededCount()).toBe(1);
        expect(EmailMocker.broadcast.getFailedCount()).toBe(0); // never tried to send any failed emails (whitelist)

        // Load recipietns
        const recipients = await EmailRecipient.select().where('emailId', model.id).fetch();
        expect(recipients).toIncludeSameMembers([
            expect.objectContaining({
                email: 'example2@stamhoofd-allowed-domain-tests.be',
                sentAt: expect.any(Date),
                failCount: 0,
                failErrorMessage: null,
                firstFailedAt: null,
                lastFailedAt: null,
            }),
            expect.objectContaining({
                email: 'example@not-whitelisted-domain.be',
                sentAt: null,
                failCount: 1,
                failErrorMessage: 'All recipients are filtered due to environment',
                firstFailedAt: expect.any(Date),
                lastFailedAt: expect.any(Date),
            }),
        ]);
    }, 15_000);

    it('Retries emails on network errors', async () => {
        const model = await buildEmail({
            recipients: [
                EmailRecipientStruct.create({
                    firstName: 'Test',
                    lastName: 'Test',
                    email: 'example@domain.be',
                }),
                EmailRecipientStruct.create({
                    firstName: 'Test',
                    lastName: 'Test',
                    email: 'example2@domain.be',
                }),
            ],
        });

        // Only one failure (the first email)
        // It should automatically retry to send the email
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error'));

        await model.send();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.recipientCount).toBe(2);
        expect(model.status).toBe(EmailStatus.Sent);

        // Both have succeeded
        expect(EmailMocker.broadcast.getSucceededCount()).toBe(2);
        expect(EmailMocker.broadcast.getFailedCount()).toBe(1); // One retry

        // Load recipietns
        const recipients = await EmailRecipient.select().where('emailId', model.id).fetch();
        expect(recipients).toIncludeSameMembers([
            expect.objectContaining({
                email: 'example@domain.be',
                sentAt: expect.any(Date),
                failCount: 0,
            }),
            expect.objectContaining({
                email: 'example2@domain.be',
                sentAt: expect.any(Date),
                failCount: 0,
            }),
        ]);
    }, 15_000);

    it('Marks email recipient as failed if fails three times', async () => {
        const model = await buildEmail({
            recipients: [
                EmailRecipientStruct.create({
                    firstName: 'Test',
                    lastName: 'Test',
                    email: 'example@domain.be',
                }),
                EmailRecipientStruct.create({
                    firstName: 'Test',
                    lastName: 'Test',
                    email: 'example2@domain.be',
                }),
            ],
        });

        // Only one failure (the first email)
        // It should automatically retry to send the email
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 1'));
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 2'));
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 3'));
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 4'));
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 5'));
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 6'));

        await model.send();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.recipientCount).toBe(2);
        expect(model.status).toBe(EmailStatus.Sent);

        // Both have succeeded
        expect(EmailMocker.broadcast.getSucceededCount()).toBe(0);
        expect(EmailMocker.broadcast.getFailedCount()).toBe(6); // Two retries for each recipient

        // Load recipietns
        const recipients = await EmailRecipient.select().where('emailId', model.id).fetch();
        expect(recipients).toIncludeSameMembers([
            expect.objectContaining({
                email: 'example@domain.be',
                sentAt: null,
                failCount: 1,
                firstFailedAt: expect.any(Date),
                lastFailedAt: expect.any(Date),
            }),
            expect.objectContaining({
                email: 'example2@domain.be',
                sentAt: null,
                failCount: 1,
                firstFailedAt: expect.any(Date),
                lastFailedAt: expect.any(Date),
            }),
        ]);
    }, 15_000);

    it('Can handle recipients without name', async () => {
        const model = await buildEmail({
            recipients: [
                EmailRecipientStruct.create({
                    email: 'example@domain.be',
                }),
            ],
        });

        await model.send();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.recipientCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);

        // Both have succeeded
        expect(EmailMocker.broadcast.getSucceededCount()).toBe(1);
        expect(EmailMocker.broadcast.getFailedCount()).toBe(0);

        // Load recipietns
        const recipients = await EmailRecipient.select().where('emailId', model.id).fetch();
        expect(recipients).toIncludeSameMembers([
            expect.objectContaining({
                email: 'example@domain.be',
                sentAt: expect.any(Date),
                failCount: 0,
            }),
        ]);

        // Check to header
        expect(EmailMocker.broadcast.getSucceededEmail(0).to).toEqual('example@domain.be');
    }, 15_000);

    it('Includes recipient names in mail header', async () => {
        const model = await buildEmail({
            recipients: [
                EmailRecipientStruct.create({
                    firstName: 'John',
                    lastName: 'Von Doe',
                    email: 'example@domain.be',
                }),
            ],
        });

        await model.send();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.recipientCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);

        // Both have succeeded
        expect(EmailMocker.broadcast.getSucceededCount()).toBe(1);
        expect(EmailMocker.broadcast.getFailedCount()).toBe(0);

        // Load recipietns
        const recipients = await EmailRecipient.select().where('emailId', model.id).fetch();
        expect(recipients).toIncludeSameMembers([
            expect.objectContaining({
                firstName: 'John',
                lastName: 'Von Doe',
                email: 'example@domain.be',
                sentAt: expect.any(Date),
                failCount: 0,
            }),
        ]);

        // Check to header
        expect(EmailMocker.broadcast.getSucceededEmail(0).to).toEqual('"John Von Doe" <example@domain.be>');
    }, 15_000);

    it('Skips invalid email addresses', async () => {
        const model = await buildEmail({
            recipients: [
                EmailRecipientStruct.create({
                    firstName: 'John',
                    lastName: 'Von Doe',
                    email: 'invalid',
                }),
            ],
        });

        await model.send();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.recipientCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);

        // Both have succeeded
        expect(EmailMocker.broadcast.getSucceededCount()).toBe(0);
        expect(EmailMocker.broadcast.getFailedCount()).toBe(0);

        // Load recipietns
        const recipients = await EmailRecipient.select().where('emailId', model.id).fetch();
        expect(recipients).toIncludeSameMembers([
            expect.objectContaining({
                firstName: 'John',
                lastName: 'Von Doe',
                email: 'invalid',
                failCount: 1,
                failErrorMessage: 'Invalid email address',
                firstFailedAt: expect.any(Date),
                lastFailedAt: expect.any(Date),
            }),
        ]);
    }, 15_000);

    it('Skips empty email addresses while creating recipients', async () => {
        const model = await buildEmail({
            recipients: [
                EmailRecipientStruct.create({
                    firstName: '',
                    lastName: '',
                    email: '',
                }),
                EmailRecipientStruct.create({
                    firstName: '',
                    lastName: '',
                    email: 'valid@example.com',
                }),
            ],
        });

        await model.send();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.recipientCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);

        // Both have succeeded
        expect(EmailMocker.broadcast.getSucceededCount()).toBe(1);
        expect(EmailMocker.broadcast.getFailedCount()).toBe(0);

        // Load recipietns
        const recipients = await EmailRecipient.select().where('emailId', model.id).fetch();
        expect(recipients).toIncludeSameMembers([
            expect.objectContaining({
                email: 'valid@example.com',
                sentAt: expect.any(Date),
            }),
        ]);
    }, 15_000);

    it('Platform can send from default domain', async () => {
        TestUtils.setEnvironment('domains', {
            ...STAMHOOFD.domains,
            defaultTransactionalEmail: {
                '': 'my-platform.com',
            },
            defaultBroadcastEmail: {
                '': 'broadcast.my-platform.com',
            },
        });

        const model = await buildEmail({
            recipients: [
                EmailRecipientStruct.create({
                    email: 'example@domain.be',
                }),
            ],
            fromAddress: 'info@my-platform.com',
            fromName: 'My Platform',
        });

        await model.send();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.recipientCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);

        // Both have succeeded
        expect(EmailMocker.broadcast.getSucceededCount()).toBe(1);
        expect(EmailMocker.broadcast.getFailedCount()).toBe(0);

        // Check to header
        expect(EmailMocker.broadcast.getSucceededEmail(0)).toMatchObject({
            to: 'example@domain.be',
            from: '"My Platform" <info@my-platform.com>',
            replyTo: undefined,
        });
    }, 15_000);

    it('Platform cannot send from unsupported domain', async () => {
        TestUtils.setEnvironment('domains', {
            ...STAMHOOFD.domains,
            defaultTransactionalEmail: {
                '': 'my-platform.com',
            },
            defaultBroadcastEmail: {
                '': 'broadcast.my-platform.com',
            },
        });

        const model = await buildEmail({
            recipients: [
                EmailRecipientStruct.create({
                    email: 'example@domain.be',
                }),
            ],
            fromAddress: 'info@other-platform.com',
            fromName: 'My Platform',
        });

        await model.send();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.recipientCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);

        // Both have succeeded
        expect(EmailMocker.broadcast.getSucceededCount()).toBe(1);
        expect(EmailMocker.broadcast.getFailedCount()).toBe(0);

        // Check to header
        expect(EmailMocker.broadcast.getSucceededEmail(0)).toMatchObject({
            to: 'example@domain.be',
            from: '"My Platform" <noreply@broadcast.my-platform.com>', // domain has changed here
            replyTo: '"My Platform" <info@other-platform.com>', // Reply to should be set
        });
    }, 15_000);

    it('Organization cannot send from platform domain', async () => {
        TestUtils.setEnvironment('domains', {
            ...STAMHOOFD.domains,
            defaultTransactionalEmail: {
                '': 'my-platform.com',
            },
            defaultBroadcastEmail: {
                '': 'broadcast.my-platform.com',
            },
        });

        const organization = await new OrganizationFactory({
            uri: 'uritest',
        }).create();

        const model = await buildEmail({
            organizationId: organization.id,
            recipients: [
                EmailRecipientStruct.create({
                    email: 'example@domain.be',
                }),
            ],
            fromAddress: 'info@my-platform.com',
            fromName: 'My Platform',
        });

        await model.send();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.recipientCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);

        // Both have succeeded
        expect(EmailMocker.broadcast.getSucceededCount()).toBe(1);
        expect(EmailMocker.broadcast.getFailedCount()).toBe(0);

        // Check to header
        expect(EmailMocker.broadcast.getSucceededEmail(0)).toMatchObject({
            to: 'example@domain.be',
            from: '"My Platform" <noreply-uritest@broadcast.my-platform.com>', // domain has changed here
            replyTo: '"My Platform" <info@my-platform.com>', // Reply to should be set
        });
    }, 15_000);

    it('Organization can send from platform domain if default membership organization', async () => {
        TestUtils.setEnvironment('domains', {
            ...STAMHOOFD.domains,
            defaultTransactionalEmail: {
                '': 'my-platform.com',
            },
            defaultBroadcastEmail: {
                '': 'broadcast.my-platform.com',
            },
        });

        const organization = await new OrganizationFactory({}).create();

        const platform = await Platform.getForEditing();
        platform.membershipOrganizationId = organization.id;
        await platform.save();

        const model = await buildEmail({
            organizationId: organization.id,
            recipients: [
                EmailRecipientStruct.create({
                    email: 'example@domain.be',
                }),
            ],
            fromAddress: 'info@my-platform.com',
            fromName: 'My Platform',
        });

        await model.send();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.recipientCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);

        // Both have succeeded
        expect(EmailMocker.broadcast.getSucceededCount()).toBe(1);
        expect(EmailMocker.broadcast.getFailedCount()).toBe(0);

        // Check to header
        expect(EmailMocker.broadcast.getSucceededEmail(0)).toMatchObject({
            to: 'example@domain.be',
            from: '"My Platform" <info@my-platform.com>', // domain has changed here
            replyTo: undefined,
        });
    }, 15_000);
});
