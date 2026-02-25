import { registerCron } from '@stamhoofd/crons';
import { CachedBalance, Email, EmailRecipient, Organization, User } from '@stamhoofd/models';
import { IterableSQLSelect, readDynamicSQLExpression, SQL, SQLCalculation, SQLPlusSign } from '@stamhoofd/sql';
import { EmailRecipientFilter, EmailRecipientFilterType, EmailRecipientSubfilter, EmailTemplateType, OrganizationEmail, ReceivableBalanceType, StamhoofdFilter } from '@stamhoofd/structures';
import { ContextInstance } from '../helpers/Context.js';

registerCron('balanceEmails', balanceEmails);

let lastFullRun = new Date(0);
let savedIterator: IterableSQLSelect<Organization> | null = null;

const bootAt = new Date();

async function balanceEmails() {
    // Do not run within 30 minutes after boot to avoid creating multiple email models for emails that failed to send
    if (bootAt.getTime() > new Date().getTime() - 1000 * 60 * 30 && STAMHOOFD.environment !== 'development') {
        return;
    }

    if (lastFullRun.getTime() > new Date().getTime() - 1000 * 60 * 60 * 12) {
        return;
    }

    if ((new Date().getHours() > 10 || new Date().getHours() < 6) && STAMHOOFD.environment !== 'development') {
        return;
    }

    // Get the next x organization to send e-mails for
    if (savedIterator === null) {
        console.log('Starting new iterator');
        savedIterator = Organization.select().limit(10).all();
    }

    const systemUser = await User.getSystem();

    for await (const organization of savedIterator.maxQueries(5)) {
        if (!organization.privateMeta.balanceNotificationSettings.enabled || organization.privateMeta.balanceNotificationSettings.maximumReminderEmails <= 0 || organization.privateMeta.balanceNotificationSettings.minimumDaysBetween <= 0) {
            continue;
        }

        const enabledForOrganizations = organization.privateMeta.featureFlags.includes('organization-receivable-balances') && Object.keys(organization.privateMeta.balanceNotificationSettings.organizationContactsFilter).includes('meta');

        const selectedEmailAddress = organization.privateMeta.balanceNotificationSettings.emailId ? organization.privateMeta.emails.find(e => e.id === organization.privateMeta.balanceNotificationSettings.emailId) : null;
        const emailAddress = selectedEmailAddress ?? organization.privateMeta.emails.find(e => e.default) ?? null;

        if (!emailAddress) {
            // No emailadres set
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
                $or: [
                    // The amount has increased since the last reminder
                    { reminderAmountIncreased: true },

                    // Or we didn't send a reminder at all yet (since the last time it was zero)
                    { reminderEmailCount: 0 },
                ],
            },
        });

        if (enabledForOrganizations) {
            await sendTemplate({
                objectType: ReceivableBalanceType.organization,
                organization,
                emailAddress,
                systemUser,
                templateType: EmailTemplateType.OrganizationBalanceIncreaseNotification,
                filter: {
                    $or: [
                        // The amount has increased since the last reminder
                        { reminderAmountIncreased: true },

                        // Or we didn't send a reminder at all yet (since the last time it was zero)
                        { reminderEmailCount: 0 },
                    ],
                },
                subfilter: organization.privateMeta.balanceNotificationSettings.organizationContactsFilter,
            });
        }
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

            if (enabledForOrganizations) {
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
                    subfilter: organization.privateMeta.balanceNotificationSettings.organizationContactsFilter,
                });
            }
        }
    }

    if (savedIterator.isDone) {
        savedIterator = null;
        lastFullRun = new Date();
    }
}

async function sendTemplate({
    organization,
    emailAddress,
    systemUser,
    templateType,
    filter,
    objectType,
    subfilter,
}: {
    objectType: ReceivableBalanceType;
    organization: Organization;
    emailAddress: OrganizationEmail;
    systemUser: User;
    templateType: EmailTemplateType;
    filter: StamhoofdFilter;
    subfilter?: StamhoofdFilter;
}) {
    // Do not send to persons that already received a similar email before this date
    const weekAgo = new Date(
        new Date().getTime() - 1000 * 60 * 60 * 24 * Math.max(1, organization.privateMeta.balanceNotificationSettings.minimumDaysBetween)
            + 12 * 1000 * 60 * 60, // Add a half day offset so we don't get trapped in small differences in time of sending
    ); // 5 instead of 7 so the email received is on another working day

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
                    ],

                },
                subfilter,
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
            return await model.queueForSending(true);
        });

        if (!upToDate) {
            console.log('No recipients found for organization', organization.name, organization.id);
        }
        else {
            const now = new Date();
            now.setMilliseconds(0);

            // Set last balance amount for all these recipients
            for await (const batch of EmailRecipient.select().where('emailId', upToDate.id).limit(100).allBatched()) {
                const balanceItemIds = batch.flatMap(b => b.objectId ? [b.objectId] : []);

                console.log('Marking balances as reminded...');
                await CachedBalance.update()
                    .set('lastReminderEmail', now)
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
                    .where(SQL.where('lastReminderEmail', '<', now).or('lastReminderEmail', null)) // prevent increasing the count multiple times if multiple recipients received the email
                    .update();
            }
        }
    }
    catch (e) {
        console.error('Error sending email for organization', e, organization.name, organization.id);
    }
}
