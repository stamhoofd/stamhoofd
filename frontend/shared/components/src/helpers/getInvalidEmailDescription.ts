import { EmailInformation } from '@stamhoofd/structures';

export function getInvalidEmailDescription(emailInformation: EmailInformation) {
    if (emailInformation.unsubscribedAll) {
        return $t('Heeft zich uitgeschreven voor e-mails');
    }

    if (emailInformation.markedAsSpam) {
        return $t('Heeft e-mail als spam gemarkeerd');
    }

    if (emailInformation.hardBounce) {
        return $t('Ongeldig e-mailadres');
    }

    return null;
}
