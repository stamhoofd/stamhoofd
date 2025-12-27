import { TestUtils } from '@stamhoofd/test-utils';
import { UitpasMocker } from '../helpers/UitpasApiMocker.js';

export async function initUitpasApi() {
    const uitpasMocker = new UitpasMocker();

    uitpasMocker.start();

    TestUtils.scheduleAfterThisTest(() => {
        uitpasMocker.stop();
    });

    return { uitpasMocker };
}
