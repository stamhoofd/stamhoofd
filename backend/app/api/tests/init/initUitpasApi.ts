import { TestUtils } from '@stamhoofd/test-utils';
import { UitpasMocker } from '../helpers/UitpasApiMocker.js';

export function initUitpasApi(): UitpasMocker {
    const mocker = new UitpasMocker();

    mocker.start();

    TestUtils.scheduleAfterThisTest(() => {
        mocker.stop();
    });

    return mocker;
}
