import { registerCron } from '@stamhoofd/crons';
import { CachedBalance, Email, EmailRecipient, Organization, Platform, User } from '@stamhoofd/models';
import { IterableSQLSelect, readDynamicSQLExpression, SQL, SQLCalculation, SQLPlusSign } from '@stamhoofd/sql';
import { EmailRecipientFilter, EmailRecipientFilterType, EmailRecipientSubfilter, EmailTemplateType, OrganizationEmail, ReceivableBalanceType, StamhoofdFilter } from '@stamhoofd/structures';
import { ContextInstance } from '../helpers/Context';

registerCron('balanceEmails', balanceEmails);

let lastFullRun = new Date(0);
let savedIterator: IterableSQLSelect<Organization> | null = null;

const bootAt = new Date();

async function balanceEmails() {
    // Do not run within 30 minutes after boot to avoid creating multiple email models for emails that failed to send
    if (bootAt.getTime() > new Date().getTime() - 1000 * 60 * 30 && STAMHOOFD.environment !== 'development') {
        console.log('Boot time is too recent, skipping.');
        return;
    }

    if (lastFullRun.getTime() > new Date().getTime() - 1000 * 60 * 60 * 12 && STAMHOOFD.environment !== 'development') {
        console.log('Already ran today, skipping.');
        return;
    }

    if ((new Date().getHours() > 10 || new Date().getHours() < 6) && STAMHOOFD.environment !== 'development') {
        console.log('Not between 6 and 10 AM, skipping.');
        return;
    }

    // Get the next x organization to send e-mails for
    if (savedIterator === null) {
        console.log('Starting new iterator');
        savedIterator = Organization.select().limit(10).all();
    }

    const platform = await Platform.getSharedPrivateStruct();

    if (!platform.config.featureFlags.includes('balance-emails')) {
        console.log('Feature flag not enabled, skipping.');
        return;
    }
    const systemUser = await User.getSystem();

    for await (const organization of savedIterator.maxQueries(5)) {
        if (!organization.privateMeta.balanceNotificationSettings.enabled || organization.privateMeta.balanceNotificationSettings.maximumReminderEmails <= 0 || organization.privateMeta.balanceNotificationSettings.minimumDaysBetween <= 0) {
            continue;
        }

        const selectedEmailAddress = organization.privateMeta.balanceNotificationSettings.emailId ? organization.privateMeta.emails.find(e => e.id === organization.privateMeta.balanceNotificationSettings.emailId) : null;
        const emailAddress = selectedEmailAddress ?? organization.privateMeta.emails.find(e => e.default) ?? null;

        if (!emailAddress) {
            // No emailadres set
            console.warn('Skipped organization', organization.id, 'because no email address is set');
            continue;
        }

        // First emails
        await sendTemplate({
            objectType: ReceivableBalanceType.user,
            organization,
            emailAddress,
            systemUser,
            templateType: EmailTemplateType.UserBalanceIncreaseNotification,
            filter: {
                reminderAmountIncreased: true,
                reminderEmailCount: 0,
            },
        });
        await sendTemplate({
            objectType: ReceivableBalanceType.organization,
            organization,
            emailAddress,
            systemUser,
            templateType: EmailTemplateType.OrganizationBalanceIncreaseNotification,
            filter: {
                reminderAmountIncreased: true,
                reminderEmailCount: 0,
            },
        });
        const maximumEmailCount = organization.privateMeta.balanceNotificationSettings.maximumReminderEmails;

        // Reminder emails
        if (maximumEmailCount > 1) {
            await sendTemplate({
                objectType: ReceivableBalanceType.user,
                organization,
                emailAddress,
                systemUser,
                templateType: EmailTemplateType.UserBalanceReminder,
                filter: {
                    $and: [
                        {
                            reminderEmailCount: { $gt: 0 },
                        }, {
                            reminderEmailCount: { $lt: maximumEmailCount },
                        },
                    ],
                },
            });
            await sendTemplate({
                objectType: ReceivableBalanceType.organization,
                organization,
                emailAddress,
                systemUser,
                templateType: EmailTemplateType.OrganizationBalanceReminder,
                filter: {
                    $and: [
                        {
                            reminderEmailCount: { $gt: 0 },
                        }, {
                            reminderEmailCount: { $lt: maximumEmailCount },
                        },
                    ],
                },
            });
        }
    }

    if (savedIterator.isDone) {
        savedIterator = null;
        lastFullRun = new Date();

        console.log('All done!');
    }
}

async function sendTemplate({
    organization,
    emailAddress,
    systemUser,
    templateType,
    filter,
    objectType,
}: {
    objectType: ReceivableBalanceType;
    organization: Organization;
    emailAddress: OrganizationEmail;
    systemUser: User;
    templateType: EmailTemplateType;
    filter: StamhoofdFilter;
}) {
    // Do not send to persons that already received a similar email before this date
    const weekAgo = new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * organization.privateMeta.balanceNotificationSettings.minimumDaysBetween); // 5 instead of 7 so the email received is on another working day

    const model = new Email();
    model.userId = null; // This is a system e-mail
    model.organizationId = organization?.id ?? null;
    model.emailType = templateType;

    model.recipientFilter = EmailRecipientFilter.create({
        filters: [
            EmailRecipientSubfilter.create({
                type: EmailRecipientFilterType.ReceivableBalances,
                filter: {
                    $and: [
                        {
                            amountOpen: { $gt: 0 },
                            objectType,
                        },
                        {
                            // Never send more than minimumDaysBetween
                            $or: [
                                { lastReminderEmail: null },
                                { lastReminderEmail: { $lt: weekAgo } },
                            ],
                        },
                        filter,
                        /* {
                            // Do not send if already received any email very recently
                            $not: {
                                emails: {
                                    $elemMatch: {
                                        sentAt: {
                                            $gt: weekAgo,
                                        },
                                    },
                                },
                            },
                        }, */
                    ],

                },
            }),
        ],
    });

    if (!await model.setFromTemplate(templateType)) {
        console.warn('Skipped organization: email template not found', organization.id);
        return;
    }

    model.fromAddress = emailAddress.email;
    model.fromName = emailAddress.name ?? organization.name;

    try {
        const upToDate = await ContextInstance.startForUser(systemUser, organization, async () => {
            return await model.send();
        });

        if (!upToDate) {
            console.log('No recipients found for organization', organization.name, organization.id);
        }
        else {
            // Set last balance amount for all these recipients
            for await (const batch of EmailRecipient.select().where('emailId', upToDate.id).limit(100).allBatched()) {
                const balanceItemIds = batch.flatMap(b => b.objectId ? [b.objectId] : []);

                console.log('Marking balances as reminded...');
                await CachedBalance.update()
                    .set('lastReminderEmail', new Date())
                    .set('lastReminderAmountOpen', SQL.column('amountOpen'))
                    .set(
                        'reminderEmailCount',
                        new SQLCalculation(
                            SQL.column('reminderEmailCount'),
                            new SQLPlusSign(),
                            readDynamicSQLExpression(1),
                        ),
                    )
                    .where('id', balanceItemIds)
                    .where('organizationId', organization.id)
                    .where('objectType', objectType)
                    .update();
            }
        }
    }
    catch (e) {
        console.error('Error sending email for organization', e, organization.name, organization.id);
    }
}
