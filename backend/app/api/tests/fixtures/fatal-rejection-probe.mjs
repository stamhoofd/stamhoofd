import '@stamhoofd/test-utils/environment';
import nock from 'nock';

nock.disableNetConnect();
const register = process.on;
// Dispatch at registration, before any boot module can start a worker or network listener.
process.on = function (event, listener) {
    const result = register.call(this, event, listener);
    if (event === 'unhandledRejection') {
        this.emit(
            event,
            new RangeError('canary-member', { cause: new Error('canary-health-key') }),
            Promise.resolve(),
        );
    }
    return result;
};
