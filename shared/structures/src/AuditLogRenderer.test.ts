import { renderTemplate } from './AuditLogRenderer.js';

describe('renderTemplate variables', () => {
    test('keeps variable values and quoted arguments distinct', () => {
        const value = { value: 'member' };
        expect(renderTemplate('{{member}} {{"member"}}', {
            type: 'text', context: new Map([['member', value]]), helpers: {},
        })).toEqual([value, ' member']);
    });

    test('preserves missing and falsy variable behavior', () => {
        expect(renderTemplate('{{empty}}{{missing}}{{zero}}', {
            type: 'text', context: new Map<string, unknown>([['empty', ''], ['zero', 0]]), helpers: {},
        })).toEqual([undefined, undefined, undefined]);
    });
});
