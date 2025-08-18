import { EmailPreview, EmailStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export function useEmailStatus() {
    return (email: EmailPreview) => {
        switch (email.status) {
            case EmailStatus.Draft:
                return {
                    text: $t('Concept'),
                    icon: 'edit',
                    theme: 'theme-secundary',
                };
            case EmailStatus.Sending:
                return {
                    text: $t('Bezig met verzenden'),
                    icon: 'reverse',
                    theme: 'theme-secundary',
                };
            case EmailStatus.Sent:
                return {
                    text: email.sentAt ? (Formatter.dateWithDay(email.sentAt, false)) : $t('Verzonden'),
                };
            case EmailStatus.Failed:
                return {
                    text: $t('Mislukt'),
                    icon: 'error',
                    theme: 'theme-error',
                };
            default:
                return null;
        }
    };
}
