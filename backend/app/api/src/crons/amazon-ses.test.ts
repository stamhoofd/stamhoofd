import { readHeaders } from './amazon-ses.js';

describe('SES header dictionary isolation', () => {
    test('retains special names as literal string headers', () => {
        const headers = readHeaders({ mail: { headers: [{ name: '__proto__', value: 'first' }, { name: 'constructor', value: 'second' }, { name: 'prototype', value: 'third' }] } });
        const get = (name: string) => headers.get(name);
        expect(get('__proto__')).toBe('first');
        expect(get('constructor')).toBe('second');
        expect(get('prototype')).toBe('third');
    });

    test('invalid object header values cannot supply inherited recipient identifiers', () => {
        const headers = readHeaders({ mail: { headers: [{ name: '__proto__', value: { 'x-email-id': 'forged', 'x-email-recipient-id': 'forged' } }] } });
        const get = (name: string) => headers.get(name);
        expect(get('x-email-id')).toBeUndefined();
        expect(get('x-email-recipient-id')).toBeUndefined();
    });
});

describe('SES header normalization', () => {
    test('normalizes case and retains the last nonempty string header', () => {
        const headers = readHeaders({ mail: { headers: [
            { name: 'X-Email-Id', value: 'first' },
            { name: 'x-email-id', value: 'last' },
            { name: 'X-Empty', value: '' },
            { name: '', value: 'ignored' },
            { name: 'X-Invalid', value: 42 },
            null,
        ] } });
        expect(headers).toEqual(new Map([['x-email-id', 'last']]));
    });

    test('returns independent empty Maps for missing or malformed header containers', () => {
        const first = readHeaders({});
        expect(first).toEqual(new Map());
        expect(readHeaders({ mail: { headers: 'invalid' } })).toEqual(new Map());
        expect(readHeaders(null)).toEqual(new Map());
        expect(readHeaders({})).not.toBe(first);
    });
});
