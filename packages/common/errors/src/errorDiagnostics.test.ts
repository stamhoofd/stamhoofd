import { expect, it } from 'vitest';
import { errorDiagnostics } from './errorDiagnostics.js';

it('keeps source locations and HTTP status without logging an SDK payload or multiline message', () => {
    const error = Object.assign(
        new TypeError('private payload\n    at /repo/backend/private.ts:1:2'),
        {
            code: 'private-code',
            statusCode: 429,
            response: { email: 'private@example.org' },
        },
    );
    error.stack = `${error}\n    at send (/repo/backend/app/api/src/mail.ts:12:3)`;
    expect(errorDiagnostics(error)).toEqual({
        errorType: 'TypeError',
        status: 429,
        code: undefined,
        frames: ['backend/app/api/src/mail.ts:12:3'],
    });
});

it('handles non-Error exceptions and inaccessible error fields', () => {
    expect(errorDiagnostics('private message')).toEqual({ errorType: 'unknown' });
    const error = Object.defineProperty(new Error(), 'stack', {
        get() {
            throw new Error('unavailable');
        },
    });
    expect(errorDiagnostics(error)).toEqual({ errorType: 'unknown' });
});
