import { TestUtils } from '@stamhoofd/test-utils';
import { OpenAIMocker } from '../helpers/OpenAIMocker.js';

export function initOpenAIApi(): OpenAIMocker {
    const mocker = new OpenAIMocker();

    mocker.start();

    TestUtils.scheduleAfterThisTest(() => {
        mocker.stop();
    });

    return mocker;
}
