import { EmailPreview, EmailStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export function useEmailStatus() {
    return (email: EmailPreview) => {
        if (email.deletedAt) {
            return {
                text: $t('94337d0a-0522-43be-b337-73ddcf7fdd45'),
                theme: 'theme-error',
            };
        }

        switch (email.status) {
            case EmailStatus.Draft:
                return {
                    text: $t('6def054b-5748-43ea-ae84-28c53941b78a'),
                    icon: 'edit',
                    theme: 'theme-secundary',
                };
            case EmailStatus.Sending:
                if (!email.sendAsEmail) {
                    return {
                        text: $t('f30a5ed7-b35f-4a96-9a6a-bc27022d85ff'),
                        theme: 'theme-secundary',
                        progress: email.emailRecipientsCount ? Math.min(1, (email.succeededCount + email.failedCount + email.softFailedCount) / email.emailRecipientsCount) : undefined,
                    };
                }
                return {
                    text: $t('f5eb4dcd-ddc1-4952-a40e-845cda2b88ce'),
                    theme: 'theme-secundary',
                    progress: email.emailRecipientsCount ? Math.min(1, (email.succeededCount + email.failedCount + email.softFailedCount) / email.emailRecipientsCount) : undefined,
                };
            case EmailStatus.Queued:
                if (!email.sendAsEmail) {
                    return {
                        text: $t('926052ce-f1bd-4bbc-9c86-314bdba8d244'),
                        theme: 'theme-secundary',
                        progress: 0,
                    };
                }
                return {
                    text: $t('742236ac-6217-4060-99b6-ec62ffdbd4fb'),
                    theme: 'theme-secundary',
                    progress: 0,
                };
            case EmailStatus.Sent:
                return {
                    text: email.sentAt ? (Formatter.dateTimeWithDay(email.sentAt, false, false)) : $t('5101ef12-a812-4748-91dd-778c0a3fe482'),
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
