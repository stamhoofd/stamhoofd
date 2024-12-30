import { registerCron } from '@stamhoofd/crons';
import { Email, Organization, Platform, User } from '@stamhoofd/models';
import { IterableSQLSelect } from '@stamhoofd/sql';
import { EmailRecipientFilter, EmailRecipientFilterType, EmailRecipientSubfilter, EmailTemplateType, ReceivableBalanceType } from '@stamhoofd/structures';
import { ContextInstance } from '../helpers/Context';

registerCron('balanceEmails', balanceEmails);

let lastFullRun = new Date(0);
let savedIterator: IterableSQLSelect<Organization> | null = null;

async function balanceEmails() {
    if (lastFullRun.getTime() > new Date().getTime() - 1000 * 60 * 60 * 12) {
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
        if (!organization.privateMeta.balanceNotificationSettings.enabled) {
            continue;
        }

        const selectedEmailAddress = organization.privateMeta.balanceNotificationSettings.emailId ? organization.privateMeta.emails.find(e => e.id === organization.privateMeta.balanceNotificationSettings.emailId) : null;
        const emailAddress = selectedEmailAddress ?? organization.privateMeta.emails.find(e => e.default) ?? null;

        if (!emailAddress) {
            // No emailadres set
            console.warn('Skipped organization', organization.id, 'because no email address is set');
            continue;
        }

        // Do not send to persons that already received a similar email before this date
        const skipAfter = new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 7);
        const model = new Email();
        model.userId = null; // This is a system e-mail
        model.organizationId = organization?.id ?? null;
        model.emailType = 'UserBalanceIncreaseNotification';
        model.recipientFilter = EmailRecipientFilter.create({
            filters: [
                EmailRecipientSubfilter.create({
                    type: EmailRecipientFilterType.ReceivableBalances,
                    filter: {
                        amountOpen: { $gt: 0 },
                        objectType: ReceivableBalanceType.user,

                        // Do not send if already received an email recently
                        $not: {
                            emails: {
                                $elemMatch: {
                                    sentAt: {
                                        $gt: skipAfter,
                                    },
                                },
                            },
                        },
                    },
                }),
            ],
        });

        if (!await model.setFromTemplate(EmailTemplateType.UserBalanceIncreaseNotification)) {
            console.warn('Skipped organization: email template not found', organization.id);
            continue;
        }

        model.fromAddress = emailAddress.email;
        model.fromName = emailAddress.name ?? organization.name;

        try {
            await ContextInstance.startForUser(systemUser, organization, async () => {
                await model.send().catch(console.error);

                if (model.recipientCount === 0) {
                    console.log('No recipients found for organization', organization.name, organization.id);
                }
            });
        }
        catch (e) {
            console.error('Error sending email for organization', e, organization.name, organization.id);
        }
    }

    if (savedIterator.isDone) {
        savedIterator = null;
        lastFullRun = new Date();

        console.log('All done!');
    }
}
