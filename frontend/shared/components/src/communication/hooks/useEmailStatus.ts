import type { EmailPreview} from '@stamhoofd/structures';
import { EmailStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export function useEmailStatus() {
    return (email: EmailPreview) => {
        if (email.deletedAt) {
            return {
                text: $t('%1FX'),
                theme: 'theme-error',
            };
        }

        switch (email.status) {
            case EmailStatus.Draft:
                return {
                    text: $t('%1D2'),
                    icon: 'edit',
                    theme: 'theme-secundary',
                };
            case EmailStatus.Sending:
                if (!email.sendAsEmail) {
                    return {
                        text: $t('%1FY'),
                        theme: 'theme-secundary',
                        progress: email.emailRecipientsCount ? Math.min(1, (email.succeededCount + email.failedCount + email.softFailedCount) / email.emailRecipientsCount) : undefined,
                    };
                }
                return {
                    text: $t('%1D3'),
                    theme: 'theme-secundary',
                    progress: email.emailRecipientsCount ? Math.min(1, (email.succeededCount + email.failedCount + email.softFailedCount) / email.emailRecipientsCount) : undefined,
                };
            case EmailStatus.Queued:
                if (!email.sendAsEmail) {
                    return {
                        text: $t('%1FZ'),
                        theme: 'theme-secundary',
                        progress: 0,
                    };
                }
                return {
                    text: $t('%1Fa'),
                    theme: 'theme-secundary',
                    progress: 0,
                };
            case EmailStatus.Sent:
                return {
                    text: email.sentAt ? (Formatter.dateTimeWithDay(email.sentAt, false, false)) : $t('%1D4'),
                    progress: 1,
                };
            case EmailStatus.Failed:
                return {
                    text: $t('%1D5'),
                    icon: 'error',
                    theme: 'theme-error',
                };
            default:
                return null;
        }
    };
}
