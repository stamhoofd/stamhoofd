import { EmailPreview, EmailStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export function useEmailStatus() {
    return (email: EmailPreview) => {
        switch (email.status) {
            case EmailStatus.Draft:
                return {
                    text: $t('6def054b-5748-43ea-ae84-28c53941b78a'),
                    icon: 'edit',
                    theme: 'theme-secundary',
                };
            case EmailStatus.Sending:
                return {
                    text: $t('f5eb4dcd-ddc1-4952-a40e-845cda2b88ce'),
                    theme: 'theme-secundary',
                    progress: email.recipientCount ? Math.min(1, (email.succeededCount + email.failedCount + email.softFailedCount) / email.recipientCount) : undefined,
                };
            case EmailStatus.Queued:
                return {
                    text: $t('In wachtrij om te verzenden'),
                    theme: 'theme-secundary',
                    progress: 0,
                };
            case EmailStatus.Sent:
                return {
                    text: email.sentAt ? (Formatter.dateWithDay(email.sentAt, false)) : $t('5101ef12-a812-4748-91dd-778c0a3fe482'),
                    progress: 1,
                };
            case EmailStatus.Failed:
                return {
                    text: $t('c147043d-f708-4aa8-aad6-0547f4fb425a'),
                    icon: 'error',
                    theme: 'theme-error',
                };
            default:
                return null;
        }
    };
}
