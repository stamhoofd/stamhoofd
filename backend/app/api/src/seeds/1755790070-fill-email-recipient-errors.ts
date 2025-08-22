import { Migration } from '@simonbackx/simple-database';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { EmailRecipient } from '@stamhoofd/models';

function stringToError(message: string) {
    if (message === 'Recipient has hard bounced') {
        return new SimpleErrors(
            new SimpleError({
                code: 'email_skipped_hard_bounce',
                message: 'The recipient has hard bounced. This means that the email address is invalid or no longer exists.',
                human: $t(`af49a569-ce88-48d9-ac37-81e594e16c03`),
            }),
        );
    }

    if (message === 'Recipient has marked as spam') {
        return new SimpleErrors(
            new SimpleError({
                code: 'email_skipped_spam',
                message: 'Recipient has marked as spam',
                human: $t(`e6523f56-397e-4127-8bf7-8396f6f25a62`),
            }),
        );
    }

    if (message === 'Recipient has unsubscribed') {
        return new SimpleErrors(
            new SimpleError({
                code: 'email_skipped_unsubscribed',
                message: 'Recipient has unsubscribed',
                human: $t('De ontvanger heeft zich afgemeld voor e-mails'),
            }),
        );
    }

    if (message === 'Recipient has unsubscribed from marketing') {
        return new SimpleErrors(
            new SimpleError({
                code: 'email_skipped_unsubscribed',
                message: 'Recipient has unsubscribed from marketing',
                human: $t('De ontvanger heeft zich afgemeld voor e-mails'),
            }),
        );
    }

    if (message === 'All recipients are filtered due to hard bounce or spam') {
        return new SimpleErrors(
            new SimpleError({
                code: 'all_filtered',
                message: 'All recipients are filtered due to hard bounce or spam',
                human: $t('Deze ontvanger komt voor op de gedeelde bounce of spamlijst. De ontvanger was eerder permanent onbereikbaar of heeft eerder een e-mail als spam gemarkeerd.'),
            }),
        );
    }

    return new SimpleErrors(
        new SimpleError({
            code: 'unknown_error',
            message: message,
        }),
    );
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start setting failError object on email recipients.');

    const batchSize = 100;
    let count = 0;

    for await (const r of EmailRecipient.select()
        .whereNot('failErrorMessage', null).limit(batchSize).all()) {
        if (!r.failErrorMessage) {
            continue;
        }
        r.failError = stringToError(r.failErrorMessage);
        await r.save();
        count++;
    }

    console.log('Finished saving ' + count + ' recipients with error object.');
});
