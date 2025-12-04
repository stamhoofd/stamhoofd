import { BalanceItemType, EmailRecipientFilter, EmailRecipientFilterType, EmailRecipientsStatus, EmailRecipient as EmailRecipientStruct, EmailRecipientSubfilter, EmailStatus, LimitedFilteredRequest, OrganizationMetaData, PaginatedResponse } from '@stamhoofd/structures';
import { Email } from './Email.js';
import { EmailRecipient } from './EmailRecipient.js';
import { EmailMocker } from '@stamhoofd/email';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { OrganizationFactory } from '../factories/OrganizationFactory.js';
import { Platform } from './Platform.js';
import { BalanceItemFactory, MemberFactory, UserFactory } from '../factories/index.js';
import { CachedBalance } from './CachedBalance.js';
import { Formatter } from '@stamhoofd/utility';

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
    model.html = data.html ?? '<p>This is a test email</p> {{unsubscribeUrl}}';
    model.text = data.text ?? 'This is a test email {{unsubscribeUrl}}';
    model.json = data.json ?? {};
    model.status = data.status ?? EmailStatus.Draft;
    model.attachments = [];
    model.fromAddress = data.fromAddress ?? 'test@stamhoofd.be';
    model.fromName = data.fromName ?? null;
    model.emailType = data.emailType ?? null;

    await model.save();

    return model;
}

/**
 * An email that won't be able to fetch recipients
 */
async function buildFailEmail(data: {
    recipients: EmailRecipientStruct[];
} & Partial<Email>) {
    Email.recipientLoaders.set(EmailRecipientFilterType.Members, {
        fetch: async (query: LimitedFilteredRequest) => {
            throw new Error('This is a simulated error while fetching recipients');
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
    model.html = data.html ?? '<p>This is a test email</p> {{unsubscribeUrl}}';
    model.text = data.text ?? 'This is a test email {{unsubscribeUrl}}';
    model.json = data.json ?? {};
    model.status = data.status ?? EmailStatus.Draft;
    model.attachments = [];
    model.fromAddress = data.fromAddress ?? 'test@stamhoofd.be';
    model.fromName = data.fromName ?? null;
    model.emailType = data.emailType ?? null;

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
        await model.queueForSending(true);
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.emailRecipientsCount).toBe(2);
        expect(model.succeededCount).toBe(1);
        expect(model.failedCount).toBe(1);
        expect(model.emailErrors).toBe(null);
        expect(model.recipientsErrors).toBe(null);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(await EmailMocker.getSucceededCount()).toBe(1);
        expect(await EmailMocker.getFailedCount()).toBe(0); // never tried to send any failed emails (whitelist)

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

        await model.queueForSending(true);
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.emailRecipientsCount).toBe(2);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(model.succeededCount).toBe(2);
        expect(model.failedCount).toBe(0);
        expect(model.softFailedCount).toBe(0);

        // Both have succeeded
        expect(await EmailMocker.getSucceededCount()).toBe(2);
        expect(await EmailMocker.getFailedCount()).toBe(1); // One retry

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

    it('Email changes to failed state if email recipients fails to build', async () => {
        const model = await buildFailEmail({
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

        await expect(model.queueForSending(true)).toReject();
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.NotCreated);
        expect(model.recipientsErrors).toEqual(STExpect.simpleErrors([{
            code: 'unknown_error',
            message: 'This is a simulated error while fetching recipients',
        }]));

        expect(model.emailRecipientsCount).toBe(null);
        expect(model.status).toBe(EmailStatus.Failed);
        expect(model.succeededCount).toBe(0);
        expect(model.failedCount).toBe(0);
        expect(model.softFailedCount).toBe(0);

        // Both have succeeded
        expect(await EmailMocker.getSucceededCount()).toBe(0);
        expect(await EmailMocker.getFailedCount()).toBe(0); // One retry
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

        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 1'));
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 2'));
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 3'));
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 4'));
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 5'));
        EmailMocker.broadcast.failNext(new Error('This is a simulated network error 6'));

        await model.queueForSending(true);
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.emailRecipientsCount).toBe(2);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(model.succeededCount).toBe(0);
        expect(model.failedCount).toBe(2);
        expect(model.softFailedCount).toBe(0);

        // Both have succeeded
        expect(await EmailMocker.getSucceededCount()).toBe(0);
        expect(await EmailMocker.getFailedCount()).toBe(6); // Two retries for each recipient

        // Load recipietns
        const recipients = await EmailRecipient.select().where('emailId', model.id).fetch();
        expect(recipients).toIncludeSameMembers([
            expect.objectContaining({
                email: 'example@domain.be',
                sentAt: null,
                failCount: 1,
                failError: STExpect.simpleErrors([{
                    message: /This is a simulated network error (3|4|5|6)/,
                }]),
                firstFailedAt: expect.any(Date),
                lastFailedAt: expect.any(Date),
            }),
            expect.objectContaining({
                email: 'example2@domain.be',
                sentAt: null,
                failCount: 1,
                failError: STExpect.simpleErrors([{
                    message: /This is a simulated network error (3|4|5|6)/,
                }]),
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

        await model.queueForSending(true);
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.emailRecipientsCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(model.succeededCount).toBe(1);
        expect(model.failedCount).toBe(0);
        expect(model.softFailedCount).toBe(0);

        // Both have succeeded
        expect(await EmailMocker.getSucceededCount()).toBe(1);
        expect(await EmailMocker.getFailedCount()).toBe(0);

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
        expect(EmailMocker.getSucceededEmail(0).to).toEqual('example@domain.be');
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

        await model.queueForSending(true);
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.emailRecipientsCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(model.succeededCount).toBe(1);
        expect(model.failedCount).toBe(0);
        expect(model.softFailedCount).toBe(0);

        // Both have succeeded
        expect(await EmailMocker.getSucceededCount()).toBe(1);
        expect(await EmailMocker.getFailedCount()).toBe(0);

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
        expect(EmailMocker.getSucceededEmail(0).to).toEqual('"John Von Doe" <example@domain.be>');
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

        await model.queueForSending(true);
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.emailRecipientsCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(model.succeededCount).toBe(0);
        expect(model.failedCount).toBe(1);
        expect(model.softFailedCount).toBe(0);

        // Both have succeeded
        expect(await EmailMocker.getSucceededCount()).toBe(0);
        expect(await EmailMocker.getFailedCount()).toBe(0);

        // Load recipietns
        const recipients = await EmailRecipient.select().where('emailId', model.id).fetch();
        expect(recipients).toIncludeSameMembers([
            expect.objectContaining({
                firstName: 'John',
                lastName: 'Von Doe',
                email: 'invalid',
                failCount: 1,
                failError: STExpect.simpleErrors([{
                    code: 'invalid_email_address',
                    message: 'Invalid email address',
                }]),
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

        await model.queueForSending(true);
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.emailRecipientsCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(model.succeededCount).toBe(1);
        expect(model.failedCount).toBe(0);
        expect(model.softFailedCount).toBe(0);

        // Both have succeeded
        expect(await EmailMocker.getSucceededCount()).toBe(1);
        expect(await EmailMocker.getFailedCount()).toBe(0);

        // Load recipietns
        const recipients = await EmailRecipient.select().where('emailId', model.id).fetch();
        expect(recipients).toIncludeSameMembers([
            expect.objectContaining({
                email: 'valid@example.com',
                sentAt: expect.any(Date),
                failError: null,
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

        await model.queueForSending(true);
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.emailRecipientsCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(model.succeededCount).toBe(1);
        expect(model.failedCount).toBe(0);
        expect(model.softFailedCount).toBe(0);

        // Both have succeeded
        expect(await EmailMocker.getSucceededCount()).toBe(1);
        expect(await EmailMocker.getFailedCount()).toBe(0);

        // Check to header
        expect(EmailMocker.getSucceededEmail(0)).toMatchObject({
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

        await model.queueForSending(true);
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.emailRecipientsCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(model.succeededCount).toBe(1);
        expect(model.failedCount).toBe(0);
        expect(model.softFailedCount).toBe(0);

        // Both have succeeded
        expect(await EmailMocker.getSucceededCount()).toBe(1);
        expect(await EmailMocker.getFailedCount()).toBe(0);

        // Check to header
        expect(EmailMocker.getSucceededEmail(0)).toMatchObject({
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

        await model.queueForSending(true);
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.emailRecipientsCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(model.succeededCount).toBe(1);
        expect(model.failedCount).toBe(0);
        expect(model.softFailedCount).toBe(0);

        // Both have succeeded
        expect(await EmailMocker.getSucceededCount()).toBe(1);
        expect(await EmailMocker.getFailedCount()).toBe(0);

        // Check to header
        expect(EmailMocker.getSucceededEmail(0)).toMatchObject({
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

        await model.queueForSending(true);
        await model.refresh();

        // Check if it was sent correctly
        expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
        expect(model.emailRecipientsCount).toBe(1);
        expect(model.status).toBe(EmailStatus.Sent);
        expect(model.succeededCount).toBe(1);
        expect(model.failedCount).toBe(0);
        expect(model.softFailedCount).toBe(0);

        // Both have succeeded
        expect(await EmailMocker.getSucceededCount()).toBe(1);
        expect(await EmailMocker.getFailedCount()).toBe(0);

        // Check to header
        expect(EmailMocker.getSucceededEmail(0)).toMatchObject({
            to: 'example@domain.be',
            from: '"My Platform" <info@my-platform.com>', // domain has changed here
            replyTo: undefined,
        });
    }, 15_000);

    describe('Replacements', () => {
        it('[Regression] When sending an email the organization fromAddress is replaced to the reply-to if it is not allowed to be sent from', async () => {
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

            const model = await buildEmail({
                organizationId: organization.id,
                recipients: [
                    EmailRecipientStruct.create({
                        email: 'example@domain.be',
                    }),
                ],
                fromAddress: 'custom@customdomain.com',
                fromName: 'Custom Name',
                html: '{{fromAddress}}',
                text: '{{fromAddress}}',
                subject: '{{fromAddress}}',
                emailType: 'system-test', // Makes sure we don't need to include unsubscribeUrl
            });

            await model.queueForSending(true);
            await model.refresh();

            // Check if it was sent correctly
            expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
            expect(model.emailRecipientsCount).toBe(1);
            expect(model.status).toBe(EmailStatus.Sent);

            // Both have succeeded
            expect(await EmailMocker.getSucceededCount()).toBe(1);
            expect(await EmailMocker.getFailedCount()).toBe(0);

            // Check to header
            expect(EmailMocker.getSucceededEmail(0)).toMatchObject({
                to: 'example@domain.be',
                from: '"Custom Name" <noreply-' + organization.uri + '@broadcast.my-platform.com>',
                replyTo: '"Custom Name" <custom@customdomain.com>', // domain has changed here
                subject: 'custom@customdomain.com',
                html: 'custom@customdomain.com',
                text: 'custom@customdomain.com',
            });
        }, 15_000);

        it('Default organization replacements work as expected', async () => {
            TestUtils.setEnvironment('domains', {
                ...STAMHOOFD.domains,
                defaultTransactionalEmail: {
                    '': 'my-platform.com',
                },
                defaultBroadcastEmail: {
                    '': 'broadcast.my-platform.com',
                },
            });

            const brightYellow = '#FFD700';
            const expectedContrastColor = '#000'; // black

            const organization = await new OrganizationFactory({
                meta: OrganizationMetaData.create({
                    color: brightYellow,
                }),
            }).create();

            const model = await buildEmail({
                organizationId: organization.id,
                recipients: [
                    EmailRecipientStruct.create({
                        email: 'example@domain.be',
                    }),
                ],
                fromAddress: 'custom@customdomain.com',
                html: '{{primaryColor}};{{primaryColorContrast}};{{organizationName}};{{fromName}}',
                text: '{{primaryColor}};{{primaryColorContrast}};{{organizationName}};{{fromName}}',
                subject: '{{primaryColor}};{{primaryColorContrast}};{{organizationName}};{{fromName}}',
                emailType: 'system-test', // Makes sure we don't need to include unsubscribeUrl
            });

            await model.queueForSending(true);
            await model.refresh();

            // Check if it was sent correctly
            expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
            expect(model.emailRecipientsCount).toBe(1);
            expect(model.status).toBe(EmailStatus.Sent);

            // Both have succeeded
            expect(await EmailMocker.getSucceededCount()).toBe(1);
            expect(await EmailMocker.getFailedCount()).toBe(0);

            // Check to header
            expect(EmailMocker.getSucceededEmail(0)).toMatchObject({
                subject: `${brightYellow};${expectedContrastColor};${organization.name};${organization.name}`,
                html: `${brightYellow};${expectedContrastColor};${organization.name};${organization.name}`,
                text: `${brightYellow};${expectedContrastColor};${organization.name};${organization.name}`,
            });
        }, 15_000);

        it('Organization replacements default to platform replacements if not set', async () => {
            TestUtils.setEnvironment('domains', {
                ...STAMHOOFD.domains,
                defaultTransactionalEmail: {
                    '': 'my-platform.com',
                },
                defaultBroadcastEmail: {
                    '': 'broadcast.my-platform.com',
                },
            });

            const brightBlue = '#0000FF';
            const expectedContrastColor = '#fff'; // white

            const platform = await Platform.getForEditing();
            platform.config.color = brightBlue;
            await platform.save();

            const organization = await new OrganizationFactory({
                meta: OrganizationMetaData.create({
                    color: null,
                }),
            }).create();

            const model = await buildEmail({
                organizationId: organization.id,
                recipients: [
                    EmailRecipientStruct.create({
                        email: 'example@domain.be',
                    }),
                ],
                fromAddress: 'custom@customdomain.com',
                fromName: 'Custom Name',
                html: '{{primaryColor}};{{primaryColorContrast}};{{organizationName}};{{fromName}}',
                text: '{{primaryColor}};{{primaryColorContrast}};{{organizationName}};{{fromName}}',
                subject: '{{primaryColor}};{{primaryColorContrast}};{{organizationName}};{{fromName}}',
                emailType: 'system-test', // Makes sure we don't need to include unsubscribeUrl
            });

            await model.queueForSending(true);
            await model.refresh();

            // Check if it was sent correctly
            expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
            expect(model.emailRecipientsCount).toBe(1);
            expect(model.status).toBe(EmailStatus.Sent);

            // Both have succeeded
            expect(await EmailMocker.getSucceededCount()).toBe(1);
            expect(await EmailMocker.getFailedCount()).toBe(0);

            // Check to header
            expect(EmailMocker.getSucceededEmail(0)).toMatchObject({
                subject: `${brightBlue};${expectedContrastColor};${organization.name};Custom Name`,
                html: `${brightBlue};${expectedContrastColor};${organization.name};Custom Name`,
                text: `${brightBlue};${expectedContrastColor};${organization.name};Custom Name`,
            });
        }, 15_000);

        it('Platform replacements are used for platform level emails', async () => {
            TestUtils.setEnvironment('domains', {
                ...STAMHOOFD.domains,
                defaultTransactionalEmail: {
                    '': 'my-platform.com',
                },
                defaultBroadcastEmail: {
                    '': 'broadcast.my-platform.com',
                },
            });

            const darkRed = '#8B0000';
            const expectedContrastColor = '#fff'; // white

            const platform = await Platform.getForEditing();
            platform.config.color = darkRed;
            await platform.save();

            const model = await buildEmail({
                recipients: [
                    EmailRecipientStruct.create({
                        email: 'example@domain.be',
                    }),
                ],
                fromAddress: 'custom@customdomain.com',
                html: '{{primaryColor}};{{primaryColorContrast}};{{organizationName}};{{fromName}}',
                text: '{{primaryColor}};{{primaryColorContrast}};{{organizationName}};{{fromName}}',
                subject: '{{primaryColor}};{{primaryColorContrast}};{{organizationName}};{{fromName}}',
                emailType: 'system-test', // Makes sure we don't need to include unsubscribeUrl
            });

            await model.queueForSending(true);
            await model.refresh();

            // Check if it was sent correctly
            expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
            expect(model.emailRecipientsCount).toBe(1);
            expect(model.status).toBe(EmailStatus.Sent);

            // Both have succeeded
            expect(await EmailMocker.getSucceededCount()).toBe(1);
            expect(await EmailMocker.getFailedCount()).toBe(0);

            // Check to header
            expect(EmailMocker.getSucceededEmail(0)).toMatchObject({
                subject: `${darkRed};${expectedContrastColor};${platform.config.name};${platform.config.name}`,
                html: `${darkRed};${expectedContrastColor};${platform.config.name};${platform.config.name}`,
                text: `${darkRed};${expectedContrastColor};${platform.config.name};${platform.config.name}`,
            });
        }, 15_000);

        describe('User based replacements', () => {
            it('The balance is added for existing users', async () => {
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
                const existingUser = await new UserFactory({
                    organization,
                }).create();

                // Add outstanding balance items for this user
                const balanceItem = await new BalanceItemFactory({
                    userId: existingUser.id,
                    organizationId: organization.id,
                    type: BalanceItemType.Other,
                    amount: 2,
                    unitPrice: 12_99,
                    description: 'Test balance item',
                }).create();
                await CachedBalance.updateForUsers(organization.id, [existingUser.id]);

                const model = await buildEmail({
                    organizationId: organization.id,
                    recipients: [
                        EmailRecipientStruct.create({
                            email: existingUser.email,
                            userId: existingUser.id,
                        }),
                    ],
                    fromAddress: 'custom@customdomain.com',
                    html: '<p>{{outstandingBalance}}</p>{{balanceTable}}',
                    subject: '{{outstandingBalance}}',
                    emailType: 'system-test', // Makes sure we don't need to include unsubscribeUrl
                });

                await model.queueForSending(true);
                await model.refresh();

                // Check if it was sent correctly
                expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
                expect(model.emailRecipientsCount).toBe(1);
                expect(model.status).toBe(EmailStatus.Sent);

                // Both have succeeded
                expect(await EmailMocker.getSucceededCount()).toBe(1);
                expect(await EmailMocker.getFailedCount()).toBe(0);

                const expectedAmount = Formatter.price(balanceItem.unitPrice * balanceItem.amount);

                // Check to header
                expect(EmailMocker.getSucceededEmail(0)).toMatchObject({
                    subject: `${expectedAmount}`,
                });

                expect(EmailMocker.getSucceededEmail(0).html).toInclude('<p>' + expectedAmount + '</p>');
                expect(EmailMocker.getSucceededEmail(0).text).toInclude(expectedAmount);

                // Check if the table is correct
                expect(EmailMocker.getSucceededEmail(0).html).toInclude('<table');
                expect(EmailMocker.getSucceededEmail(0).html).toInclude('2 x '); // amount
                expect(EmailMocker.getSucceededEmail(0).html).toInclude(Formatter.price(12_99)); // unit price
                expect(EmailMocker.getSucceededEmail(0).html).toInclude('<td>' + expectedAmount); // total price in table
                expect(EmailMocker.getSucceededEmail(0).html).toInclude('Test balance item'); // description

                expect(EmailMocker.getSucceededEmail(0).text).toInclude('2 x '); // amount
                expect(EmailMocker.getSucceededEmail(0).text).toInclude(Formatter.price(12_99)); // unit price
                expect(EmailMocker.getSucceededEmail(0).text).toInclude(expectedAmount); // total price in table
                expect(EmailMocker.getSucceededEmail(0).text?.toLowerCase()).toInclude('test balance item'); // description
            }, 15_000);

            it('The balance is zero for unknown users', async () => {
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

                const model = await buildEmail({
                    organizationId: organization.id,
                    recipients: [
                        EmailRecipientStruct.create({
                            email: 'unknown-user@example.com',
                        }),
                    ],
                    fromAddress: 'custom@customdomain.com',
                    html: '<p>{{outstandingBalance}}</p>{{balanceTable}}',
                    subject: '{{outstandingBalance}}',
                    emailType: 'system-test', // Makes sure we don't need to include unsubscribeUrl
                });

                await model.queueForSending(true);
                await model.refresh();

                // Check if it was sent correctly
                expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
                expect(model.emailRecipientsCount).toBe(1);
                expect(model.status).toBe(EmailStatus.Sent);

                // Both have succeeded
                expect(await EmailMocker.getSucceededCount()).toBe(1);
                expect(await EmailMocker.getFailedCount()).toBe(0);

                const expectedAmount = Formatter.price(0);

                // Check to header
                expect(EmailMocker.getSucceededEmail(0)).toMatchObject({
                    subject: `${expectedAmount}`,
                });

                expect(EmailMocker.getSucceededEmail(0).html).toInclude('<p>' + expectedAmount + '</p>');
                expect(EmailMocker.getSucceededEmail(0).text).toInclude(expectedAmount);

                // Check if the table is correct
                expect(EmailMocker.getSucceededEmail(0).html).not.toInclude('<table');
                expect(EmailMocker.getSucceededEmail(0).html).not.toInclude(' x '); // amount
                expect(EmailMocker.getSucceededEmail(0).html).toInclude('<p class="description">' + $t('4c4f6571-f7b5-469d-a16f-b1547b43a610') + '</p>');

                expect(EmailMocker.getSucceededEmail(0).text).not.toInclude(' x '); // amount
                expect(EmailMocker.getSucceededEmail(0).text?.toLowerCase()).toInclude($t('4c4f6571-f7b5-469d-a16f-b1547b43a610').toLowerCase());
            }, 15_000);

            it('loginDetails are added for existing users without password', async () => {
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
                const existingUser = await new UserFactory({
                    organization,
                    password: null,
                }).create();

                const model = await buildEmail({
                    organizationId: organization.id,
                    recipients: [
                        EmailRecipientStruct.create({
                            email: existingUser.email,
                            userId: existingUser.id,
                        }),
                    ],
                    fromAddress: 'custom@customdomain.com',
                    html: '{{loginDetails}}',
                    emailType: 'system-test', // Makes sure we don't need to include unsubscribeUrl
                });

                await model.queueForSending(true);
                await model.refresh();

                // Check if it was sent correctly
                expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
                expect(model.emailRecipientsCount).toBe(1);
                expect(model.status).toBe(EmailStatus.Sent);

                // Both have succeeded
                expect(await EmailMocker.getSucceededCount()).toBe(1);
                expect(await EmailMocker.getFailedCount()).toBe(0);

                expect(EmailMocker.getSucceededEmail(0).html).toInclude(
                    $t('3ab6ddc1-7ddc-4671-95d2-64994a5d36cc', { email: existingUser.email }),
                );
                expect(EmailMocker.getSucceededEmail(0).text).toInclude(
                    $t('3ab6ddc1-7ddc-4671-95d2-64994a5d36cc', { email: existingUser.email }),
                );
            }, 15_000);

            it('loginDetails are added for inexisting users', async () => {
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

                const model = await buildEmail({
                    organizationId: organization.id,
                    recipients: [
                        EmailRecipientStruct.create({
                            email: 'unknown@example.com',
                        }),
                    ],
                    fromAddress: 'custom@customdomain.com',
                    html: '{{loginDetails}}',
                    emailType: 'system-test', // Makes sure we don't need to include unsubscribeUrl
                });

                await model.queueForSending(true);
                await model.refresh();

                // Check if it was sent correctly
                expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
                expect(model.emailRecipientsCount).toBe(1);
                expect(model.status).toBe(EmailStatus.Sent);

                // Both have succeeded
                expect(await EmailMocker.getSucceededCount()).toBe(1);
                expect(await EmailMocker.getFailedCount()).toBe(0);

                expect(EmailMocker.getSucceededEmail(0).html).toInclude(
                    $t('3ab6ddc1-7ddc-4671-95d2-64994a5d36cc', { email: 'unknown@example.com' }),
                );
                expect(EmailMocker.getSucceededEmail(0).text).toInclude(
                    $t('3ab6ddc1-7ddc-4671-95d2-64994a5d36cc', { email: 'unknown@example.com' }),
                );
            }, 15_000);

            it('loginDetails are added for existing users with password', async () => {
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
                const existingUser = await new UserFactory({
                    organization,
                    password: 'existing',
                }).create();

                const model = await buildEmail({
                    organizationId: organization.id,
                    recipients: [
                        EmailRecipientStruct.create({
                            email: existingUser.email,
                            userId: existingUser.id,
                        }),
                    ],
                    fromAddress: 'custom@customdomain.com',
                    html: '{{loginDetails}}',
                    emailType: 'system-test', // Makes sure we don't need to include unsubscribeUrl
                });

                await model.queueForSending(true);
                await model.refresh();

                // Check if it was sent correctly
                expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
                expect(model.emailRecipientsCount).toBe(1);
                expect(model.status).toBe(EmailStatus.Sent);

                // Both have succeeded
                expect(await EmailMocker.getSucceededCount()).toBe(1);
                expect(await EmailMocker.getFailedCount()).toBe(0);

                expect(EmailMocker.getSucceededEmail(0).html).toInclude(
                    $t('5403b466-98fe-48ac-beff-38acf7c9734d', { email: existingUser.email }),
                );
                expect(EmailMocker.getSucceededEmail(0).text).toInclude(
                    $t('5403b466-98fe-48ac-beff-38acf7c9734d', { email: existingUser.email }),
                );
            }, 15_000);

            it('loginDetails include member security keys for existing users without password', async () => {
                TestUtils.setEnvironment('userMode', 'platform');
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
                const existingUser = await new UserFactory({
                    organization,
                    password: null,
                }).create();
                const member = await new MemberFactory({
                    organization,
                    user: existingUser,
                }).create();
                member.details.securityCode = '123456790123456'; // 16 chars
                await member.save();

                // Add a linked member

                const model = await buildEmail({
                    organizationId: organization.id,
                    recipients: [
                        EmailRecipientStruct.create({
                            email: existingUser.email,
                            userId: existingUser.id,
                        }),
                    ],
                    fromAddress: 'custom@customdomain.com',
                    html: '{{loginDetails}}',
                    emailType: 'system-test', // Makes sure we don't need to include unsubscribeUrl
                });

                await model.queueForSending(true);
                await model.refresh();

                // Check if it was sent correctly
                expect(model.recipientsStatus).toBe(EmailRecipientsStatus.Created);
                expect(model.emailRecipientsCount).toBe(1);
                expect(model.status).toBe(EmailStatus.Sent);

                // Both have succeeded
                expect(await EmailMocker.getSucceededCount()).toBe(1);
                expect(await EmailMocker.getFailedCount()).toBe(0);

                expect(EmailMocker.getSucceededEmail(0).html).toInclude(
                    $t('e2519632-c495-4629-9ddb-334a4f00e272', {
                        firstName: Formatter.escapeHtml(member.firstName),
                        securityCode: `<span class="style-inline-code">${Formatter.escapeHtml(Formatter.spaceString(member.details.securityCode ?? '', 4, '-'))}</span>`,
                    }),
                );
                expect(EmailMocker.getSucceededEmail(0).text).toInclude(
                    $t('e2519632-c495-4629-9ddb-334a4f00e272', {
                        firstName: member.firstName,
                        securityCode: Formatter.spaceString(member.details.securityCode ?? '', 4, '-'),
                    }),
                );
            }, 15_000);
        });
    });
});
