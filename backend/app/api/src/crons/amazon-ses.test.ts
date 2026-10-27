import { readHeaders } from './amazon-ses.js';

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
