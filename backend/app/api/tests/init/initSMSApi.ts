import { TestUtils } from '@stamhoofd/test-utils';
import { SMSMocker } from '../helpers/SMSMocker.js';

export function initSMSApi(): SMSMocker {
    const mocker = new SMSMocker();

    mocker.start();

    TestUtils.scheduleAfterThisTest(() => {
        mocker.stop();
    });

    return mocker;
}
