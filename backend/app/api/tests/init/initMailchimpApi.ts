import { TestUtils } from '@stamhoofd/test-utils';
import { MailchimpMocker } from '../helpers/MailchimpMocker.js';

export function initMailchimpApi(): MailchimpMocker {
    const mocker = new MailchimpMocker();
    mocker.start();

    TestUtils.scheduleAfterThisTest(() => {
        mocker.stop();
    });

    return mocker;
}
