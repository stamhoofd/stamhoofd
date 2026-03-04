import { EmailInformation } from '@stamhoofd/structures';

export function getInvalidEmailDescription(emailInformation: EmailInformation) {
    if (emailInformation.unsubscribedAll) {
        return $t('f352be58-4216-43ad-8956-67d610ef376e');
    }

    if (emailInformation.markedAsSpam) {
        return $t('7d078da7-7f90-4eb7-a87b-b30434d25bed');
    }

    if (emailInformation.hardBounce) {
        return $t('4737b9ce-06b0-4fa7-b63a-703245f347e2');
    }

    return null;
}
