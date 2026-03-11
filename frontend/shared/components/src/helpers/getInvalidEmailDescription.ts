import { EmailInformation } from '@stamhoofd/structures';

export function getInvalidEmailDescription(emailInformation: EmailInformation) {
    if (emailInformation.unsubscribedAll) {
        return $t('%1Mg');
    }

    if (emailInformation.markedAsSpam) {
        return $t('%1Mh');
    }

    if (emailInformation.hardBounce) {
        return $t('%1Mi');
    }

    return null;
}
