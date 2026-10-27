import { renderTemplate } from './AuditLogRenderer.js';

describe('renderTemplate variables', () => {
    test('keeps variable values and quoted arguments distinct', () => {
        const value = { value: 'member' };
        expect(renderTemplate('{{member}} {{"member"}}', {
            type: 'text', context: new Map([['member', value]]), helpers: new Map(),
        })).toEqual([value, ' member']);
    });

    test('preserves missing and falsy variable behavior', () => {
        expect(renderTemplate('{{empty}}{{missing}}{{zero}}', {
            type: 'text', context: new Map<string, unknown>([['empty', ''], ['zero', 0]]), helpers: new Map(),
        })).toEqual([undefined, undefined, undefined]);
    });
});

describe('renderTemplate helpers', () => {
    test('passes variables and quoted arguments to registered helpers', () => {
        expect(renderTemplate('{{join member "!"}}', {
            type: 'text', context: new Map([['member', 'Jan']]),
            helpers: new Map([['join', (_context, ...args) => [args.join('')]]]),
        })).toEqual(['Jan!']);
    });
});
