import { Migration } from '@simonbackx/simple-database';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { EmailRecipient } from '@stamhoofd/models';

function stringToError(message: string) {
    if (message === 'Recipient has hard bounced') {
        return new SimpleErrors(
            new SimpleError({
                code: 'email_skipped_hard_bounce',
                message: 'The recipient has hard bounced. This means that the email address is invalid or no longer exists.',
                human: $t(`%ws`),
            }),
        );
    }

    if (message === 'Recipient has marked as spam') {
        return new SimpleErrors(
            new SimpleError({
                code: 'email_skipped_spam',
                message: 'Recipient has marked as spam',
                human: $t(`%wt`),
            }),
        );
    }

    if (message === 'Recipient has unsubscribed') {
        return new SimpleErrors(
            new SimpleError({
                code: 'email_skipped_unsubscribed',
                message: 'Recipient has unsubscribed',
                human: $t('%1E3'),
            }),
        );
    }

    if (message === 'Recipient has unsubscribed from marketing') {
        return new SimpleErrors(
            new SimpleError({
                code: 'email_skipped_unsubscribed',
                message: 'Recipient has unsubscribed from marketing',
                human: $t('%1E3'),
            }),
        );
    }

    if (message === 'All recipients are filtered due to hard bounce or spam') {
        return new SimpleErrors(
            new SimpleError({
                code: 'all_filtered',
                message: 'All recipients are filtered due to hard bounce or spam',
                human: $t('%1E4'),
            }),
        );
    }

    if (message === 'Invalid email address') {
        return new SimpleErrors(
            new SimpleError({
                code: 'invalid_email_address',
                message: 'Invalid email address',
                human: $t(`%1Mi`),
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
