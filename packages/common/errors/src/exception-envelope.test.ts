import { afterEach, expect, it, vi } from 'vitest';
import { captureExceptionEnvelope, setExceptionEnvelopeSink } from './exception-envelope.js';
import { SimpleError } from './SimpleError.js';
import { SimpleErrors } from './SimpleErrors.js';

afterEach(() => setExceptionEnvelopeSink(undefined));

it('does not inspect exceptions without an explicit sink', () => {
    const inspect = vi.fn();
    captureExceptionEnvelope('backend.request', new Proxy(new Error(), { get: inspect }));
    expect(inspect).not.toHaveBeenCalled();
});

it('serializes only one bounded event, irrespective of SDK-like context, stack and cause', () => {
    const send = vi.fn();
    setExceptionEnvelopeSink(send);
    const error = Object.assign(
        new TypeError('canary-member', { cause: new Error('canary-key') }),
        {
            name: 'canary-name',
            stack: 'at canary-payment (https://canary.invalid/?health=canary-key:4:2)',
            request: { headers: { Authorization: 'canary-bearer' } },
            user: 'canary-email',
            attachments: ['canary-body'],
            breadcrumbs: ['canary-console'],
            release: 'canary-release',
        },
    );
    captureExceptionEnvelope('backend.request', error);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ boundary: 'backend.request', type: 'TypeError' }, error);
});

it('drops expected, malformed, non-Error and unsupported native input; delivery failure never escapes', async () => {
    const send = vi.fn();
    setExceptionEnvelopeSink(send);
    const expected = new SimpleError({
        code: 'invalid',
        message: 'canary-member',
        meta: { token: 'canary' },
    });
    for (const value of [
        expected,
        new SimpleErrors(expected),
        new SimpleErrors(),
        'canary-secret',
        null,
        new Proxy(new Error(), {
            has() {
                throw new Error('canary-transform');
            },
        }),
    ]) {
        captureExceptionEnvelope('backend.rejection', value);
    }
    // @ts-expect-error Native SDK envelopes are not supported.
    captureExceptionEnvelope('ios.native', new Error('canary-native'));
    expect(send).not.toHaveBeenCalled();
    send.mockImplementationOnce(() => {
        throw new Error('canary-sink');
    });
    send.mockRejectedValueOnce(new Error('canary-rejection'));
    captureExceptionEnvelope('backend.rejection', new Error());
    captureExceptionEnvelope('backend.rejection', new Error());
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(2);
});
