import nock from 'nock';
import { PayconiqMocker } from './PayconiqMocker.js';

export function resetNock() {
    nock.cleanAll();
    PayconiqMocker.setup();
}
